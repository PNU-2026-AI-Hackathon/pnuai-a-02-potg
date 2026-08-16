from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any

from program_case_semantic_search.config import (
    EMBEDDING_VERSION,
    MODEL_DIMENSION,
    MODEL_ID,
    MODEL_REVISION,
)
from program_case_semantic_search.kure_embedding_provider import KureEmbeddingProvider


PROFILES = ("title", "title+intro", "title+intro+target", "title+intro+target+curriculum")
# 한 번에 돌려줄 수 있는 결과 수의 상한. 파일럿은 코퍼스가 17건이라 그 수를 그대로 썼다.
# 검색 대상이 300건으로 늘었으므로 코퍼스 크기에 매이지 않는 값으로 둔다.
MAX_RESULT_LIMIT = 50

# 사서가 스튜디오에서 고를 수 있는 대상. 1차 필터로 후보를 좁히는 데 쓴다.
AUDIENCE_FILTERS = ("preschool", "elementary-lower", "elementary-upper", "adult", "everyone")

# 평가에서 살펴보는 순위 깊이. Hit@5보다 넉넉하게 두어 MRR이 잘리지 않게 한다.
EVALUATION_LIMIT = 20

# 파일럿(37건)에서 쓰던 열두 개에, 전체(351건)에서만 드러나는 것을 더했다.
# 닮은 프로그램이 떼로 있는 구간에서 대상과 기수를 가려내는지 보는 질의가 핵심이다.
EVALUATION_QUERIES = (
    # --- 파일럿에서 이어받은 질의 ---
    ("초등 저학년이 환경과 기후를 배우면서 만들기도 하는 수업", {4354}),
    ("아이와 함께 그림책을 읽고 클레이 활동을 하는 프로그램", {4351}),
    ("여름에 초등학생이 영어를 재미있게 배우는 강좌", {4353}),
    ("성인이 한 권의 책을 읽고 이야기를 나누는 독서 모임", {3052, 3105, 3130, 3276, 3355, 3390, 3408}),
    ("어린이가 관람할 수 있는 토끼 인형극", {4194}),
    ("크리스마스 장식을 직접 만드는 체험", {2990}),
    ("성인을 위한 지역 경제 인문학 강연", {2634}),
    ("초등 저학년이 직접 만들며 배우는 과학 실험 수업", {2488}),
    ("성인이 영상과 일상 표현으로 배우는 생활 영어", {2697}),
    ("초등 고학년이 친구들과 하는 보드게임 수업", {2701}),
    ("성인이 그림책으로 감정을 이해하는 테라피", {2484}),
    ("초등 저학년을 위한 파닉스 영어 읽기", {2703}),
    # --- 닮은 프로그램을 가려내는 질의 ---
    # 영어랑 놀자는 유아반과 초등반이 기수마다 있어 대상을 못 가리면 뒤섞인다.
    ("유아가 원어민 선생님과 영어로 놀며 배우는 수업", {3595, 3702, 3849, 3939, 4224, 4382}),
    ("초등 1~2학년이 원어민 선생님과 영어로 놀며 배우는 수업", {3596, 3703, 3850, 3938, 4225, 4383}),
    ("2026년 하반기에 하는 초등학생 과학 실험 교실", {4325}),
    # --- 대상이 갈리는 질의 ---
    ("성인이 유럽 미술관과 명화를 감상하는 인문학 강좌", {2887}),
    ("어르신이 삼국지로 한자를 배우는 수업", {2708}),
    ("초등 고학년이 유물과 유적으로 한국사를 배우는 수업", {2882}),
    ("초등 중학년이 교과서에 실린 명화를 다시 그려보는 수업", {2607}),
    ("유아가 글쓰기를 미리 연습해보는 수업", {2489}),
    # --- 주제가 갈리는 질의 ---
    ("초등학생이 칼림바를 배우는 음악 수업", {2812, 3000}),
    ("초등 고학년이 전기회로와 사물인터넷을 배우는 코딩 수업", {3093, 3393}),
    ("3D펜으로 생활 소품을 만드는 수업", {3392}),
    ("유아가 영어 그림책을 읽고 요리하는 수업", {3679}),
    ("초등 저학년이 책을 읽고 요리 활동을 하는 수업", {3096}),
    ("유아가 동화를 읽고 미술로 표현하는 수업", {2604}),
    ("초등 고학년이 메타버스와 메이커 활동을 하는 수업", {2808}),
    ("초등 중학년이 천천히 읽으며 메타인지를 기르는 독서 수업", {2490}),
    ("유아가 동시를 낭송하고 창작하는 수업", {3210}),
    ("유아가 클래식 음악과 작곡가 이야기를 동화로 배우는 수업", {3001}),
)

AUDIENCE_LABELS = {
    "adult": "성인",
    "elementary_lower": "초등 저학년",
    "elementary_upper": "초등 고학년",
    "elementary": "초등학생",
    "preschool": "유아",
    "child": "어린이",
    "youth": "청소년",
    "general": "누구나·지역주민",
}

CONCEPTS = {
    "topics": {
        "environment": ("환경", "기후", "생태", "탄소", "지구", "에너지"),
        "english": ("영어", "english", "파닉스", "main sentence"),
        "reading": ("독서", "책읽기", "책 읽기", "선정도서", "독서회"),
        "picturebook": ("그림책", "동화책", "동화나라", "동화구연"),
        "humanities": ("인문학", "시민인문", "지역경제"),
        "christmas": ("크리스마스", "산타", "호두까기"),
        "science": ("과학", "실험", "탐구", "행성", "별자리", "물리", "화석"),
        "art": ("미술", "그림", "표현력", "조형", "클레이"),
        "japanese": ("일본어", "일어", "히라가나", "가타카나"),
        "writing": ("글쓰기", "일기", "감상문", "논술"),
        "boardgame": ("보드게임", "보드 게임"),
    },
    "activities": {
        "craft": ("만들기", "클레이", "조형", "공예", "리스", "종이접기", "체험"),
        "discussion": ("토론", "토의", "이야기를 나누", "의견 나누", "독서 모임", "독서모임", "독서회"),
        "performance": ("인형극", "공연", "관람", "샌드아트"),
        "language": ("영어 수업", "영어수업", "영어동화", "파닉스", "문장", "sentence", "quiz", "game"),
        "lecture": ("강연", "아카데미"),
        "experiment": ("실험", "탐구", "관찰", "발굴"),
        "writing": ("글쓰기", "일기", "감상문", "논술", "써보는"),
        "boardgame": ("보드게임", "보드 게임", "게임 실습"),
    },
}


def text_concepts(text: str) -> dict[str, set[str]]:
    lower = text.lower()
    return {
        group: {name for name, terms in definitions.items() if any(term.lower() in lower for term in terms)}
        for group, definitions in CONCEPTS.items()
    }


def concept_adjustment(query: dict[str, set[str]], document: dict[str, set[str]]) -> tuple[float, float, list[str], list[str]]:
    requested = {(group, value) for group, values in query.items() for value in values}
    if not requested:
        return 0.0, 1.0, [], []
    matched = {(group, value) for group, value in requested if value in document[group]}
    missing = requested - matched
    score = sum(0.12 if group == "topics" else 0.08 for group, _ in matched)
    score -= sum(0.12 if group == "topics" else 0.08 for group, _ in missing)
    coverage = len(matched) / len(requested)
    return round(score, 8), coverage, sorted(value for _, value in matched), sorted(value for _, value in missing)


def query_audience(query: str) -> str | None:
    if re.search(r"초등\s*(?:저학년|1\s*[~～\-]\s*3학년)", query):
        return "elementary_lower"
    if re.search(r"초등\s*(?:고학년|4\s*[~～\-]\s*6학년)", query):
        return "elementary_upper"
    if re.search(r"초등", query):
        return "elementary"
    if re.search(r"유아|미취학|6\s*[~～\-]\s*7세|5\s*[~～\-]\s*7세", query):
        return "preschool"
    if re.search(r"청소년|중학생|고등학생", query):
        return "youth"
    if re.search(r"어린이|아동|아이(?:와|가|를|에게|들이)?", query):
        return "child"
    if re.search(r"성인|어른|직장인|대학생", query):
        return "adult"
    if re.search(r"누구나|전연령|전 연령|지역주민", query):
        return "general"
    return None


def document_audiences(target: str | None) -> set[str]:
    value = (target or "").replace(" ", "")
    result: set[str] = set()
    if re.search(r"누구나|연령제한없음|아이부터어른|지역주민", value):
        result.add("general")
    if re.search(r"성인|어른|대학생|직장인", value):
        result.add("adult")
    if re.search(r"초등|[1-6][~～\-][1-6]학년|[1-6]학년", value):
        result.add("elementary")
    if re.search(r"1[~～\-][23]학년", value):
        result.add("elementary_lower")
    if re.search(r"[34][~～\-]6학년", value):
        result.add("elementary_upper")
    if re.search(r"유아|미취학|[5-7][~～\-][5-7]세|19~20년생|20,21년생", value):
        result.add("preschool")
    if re.search(r"청소년|중학생|고등학생", value):
        result.add("youth")
    return result


def audience_adjustment(requested: str | None, candidates: set[str]) -> tuple[float, str]:
    if requested is None:
        return 0.0, "질의에 대상 조건 없음"
    if not candidates:
        return -0.02, "프로그램 대상 정보 없음"
    if requested == "general":
        return (0.08, "누구나·지역주민 대상 일치") if "general" in candidates else (-0.04, "특정 연령 대상")
    if requested == "adult":
        if "adult" in candidates:
            return 0.10, "요청 대상과 일치"
        if "general" in candidates:
            return 0.08, "누구나·지역주민으로 요청 대상 포함"
        return -0.25, "요청 대상과 호환되지 않음"
    if requested == "elementary_lower" and "elementary_upper" in candidates and "elementary_lower" not in candidates:
        return -0.25, "요청 학년과 호환되지 않음"
    if requested == "elementary_upper" and "elementary_lower" in candidates and "elementary_upper" not in candidates:
        return -0.25, "요청 학년과 호환되지 않음"
    compatible = {
        "elementary_lower": {"elementary_lower", "elementary"},
        "elementary_upper": {"elementary_upper", "elementary"},
        "elementary": {"elementary", "elementary_lower"},
        "preschool": {"preschool"},
        "youth": {"youth"},
        "child": {"preschool", "elementary", "elementary_lower"},
    }[requested]
    if requested in candidates or candidates & compatible:
        exact = requested in candidates
        return (0.14 if exact else 0.10), "요청 대상과 일치"
    if "general" in candidates:
        return 0.06, "누구나·지역주민으로 요청 대상 포함"
    return -0.25, "요청 대상과 호환되지 않음"


def backend_directory() -> Path:
    return Path(__file__).resolve().parents[1]


def artifact_directory() -> Path:
    configured = os.environ.get("PROGRAM_BOARD_SEARCH_DIR")
    return Path(configured).resolve() if configured else backend_directory() / ".local" / "program-board-search"


def provider() -> KureEmbeddingProvider:
    cache = os.environ.get("KURE_MODEL_CACHE_DIR") or str(backend_directory() / ".model-cache")
    return KureEmbeddingProvider(cache_folder=cache)


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def build(profile: str) -> dict[str, Any]:
    directory = artifact_directory()
    source_path = directory / f"documents.{profile}.json"
    source = read_json(source_path)
    documents = source.get("documents", [])
    if not documents or source.get("count") != len(documents):
        raise ValueError(f"semantic search documents are empty or inconsistent: {len(documents)}")
    encoder = provider()
    vectors = encoder.encode_documents([item["embeddingText"] for item in documents]).vectors
    artifact = {
        "schemaVersion": "program-board-embeddings/v1",
        "profile": profile,
        "count": len(documents),
        "model": MODEL_ID,
        "modelRevision": MODEL_REVISION,
        "embeddingVersion": EMBEDDING_VERSION,
        "dimension": MODEL_DIMENSION,
        "sourceChecksum": hashlib.sha256(source_path.read_bytes()).hexdigest(),
        "items": [{**document, "embedding": vector} for document, vector in zip(documents, vectors)],
    }
    output_path = directory / f"embeddings.{profile}.json"
    write_json(output_path, artifact)
    return {"ok": True, "profile": profile, "count": len(documents), "outputPath": str(output_path)}


def series_key(title: str, target: str | None) -> str:
    """
    같은 프로그램의 다른 회차를 한 덩어리로 보기 위한 열쇠.

    코퍼스를 만들 때 제목·대상·기간이 모두 같은 것은 이미 하나로 접었다.
    그래도 「이야기로 만나는 동화나라(10/15(토))」처럼 날짜마다 따로 접수해
    기간까지 다른 시리즈가 남는다. 사서에게 같은 프로그램을 여러 줄 보여줘 봐야
    참고할 자리만 줄어들므로, 검색 결과에서 한 줄로 줄인다.
    """
    name = re.sub(r"\(.*?\)|\[.*?\]", "", title)
    name = re.sub(r"\d+\s*(?:기|차|회|타임|반)", "", name)
    name = re.sub(r"\d{4}년|상반기|하반기", "", name)
    name = re.sub(r"[^\w가-힣]", "", name)
    audience = "".join(sorted(document_audiences(target))) or "-"
    return f"{name}|{audience}"


def audience_candidates(selected: str) -> set[str]:
    """
    사서가 고른 대상을 사례의 대상 표기와 맞춘다.

    초등을 저학년·고학년으로 나눠 적지 않은 사례가 서른여덟 건 있다.
    어느 쪽을 고르든 그런 사례는 후보에 남겨야 참고할 것이 사라지지 않는다.
    """
    return {
        "preschool": {"preschool"},
        "elementary-lower": {"elementary_lower", "elementary"},
        "elementary-upper": {"elementary_upper", "elementary"},
        "adult": {"adult"},
        "everyone": {"general"},
    }.get(selected, set())


def rank(
    query: str,
    profile: str,
    limit: int,
    encoder: KureEmbeddingProvider,
    audience: str | None = None,
) -> dict[str, Any]:
    query = query.strip()
    if not query or len(query) > 1000:
        raise ValueError("query must contain 1-1000 characters")
    if limit < 1 or limit > MAX_RESULT_LIMIT:
        raise ValueError(f"limit must be between 1 and {MAX_RESULT_LIMIT}")
    if audience and not audience_candidates(audience):
        raise ValueError(f"unsupported audience: {audience}")
    artifact = read_json(artifact_directory() / f"embeddings.{profile}.json")
    if not artifact.get("count") or artifact.get("count") != len(artifact.get("items", [])) or artifact.get("dimension") != MODEL_DIMENSION:
        raise ValueError("embedding artifact metadata is invalid")
    items = artifact["items"]
    filtered_out = 0
    if audience:
        wanted = audience_candidates(audience)
        # 연령 제한이 없는 사례는 어느 대상에나 참고가 되므로 늘 남긴다.
        keep = wanted | {"general"}
        kept = [item for item in items if document_audiences(item["target"]) & keep]
        filtered_out = len(items) - len(kept)
        items = kept
    query_vector = encoder.encode_query(query)
    requested_audience = query_audience(query)
    requested_concepts = text_concepts(query)
    scored = []
    for item in items:
        vector = item["embedding"]
        similarity = sum(left * right for left, right in zip(query_vector, vector))
        semantic_similarity = round(float(similarity), 8)
        adjustment, reason = audience_adjustment(requested_audience, document_audiences(item["target"]))
        concepts = text_concepts(f'{item["title"]} {item["summary"]}')
        concept_score, concept_coverage, matched_concepts, missing_concepts = concept_adjustment(requested_concepts, concepts)
        scored.append({
            "sourceId": item["sourceId"],
            "sourceUrl": item["sourceUrl"],
            "title": item["title"],
            "target": item["target"],
            "libraryName": item["libraryName"],
            "summary": item["summary"],
            "sourceType": item.get("sourceType", "text"),
            "similarity": semantic_similarity,
            "rankingScore": round(semantic_similarity + adjustment, 8),
            "audienceAdjustment": adjustment,
            "audienceMatch": reason,
            "conceptAdjustment": concept_score,
            "conceptCoverage": round(concept_coverage, 4),
            "matchedConcepts": matched_concepts,
            "missingConcepts": missing_concepts,
            "detailLevel": item.get("detailLevel", "basic"),
            "detailReason": item.get("detailReason", "상세도 정보 없음"),
            "sessionCount": item.get("sessionCount", 0),
        })
        scored[-1]["rankingScore"] = round(scored[-1]["rankingScore"] + concept_score, 8)
    scored.sort(key=lambda item: (-item["rankingScore"], -item["similarity"], item["sourceId"]))
    has_requested_concepts = any(requested_concepts.values())
    requested_concept_count = sum(len(values) for values in requested_concepts.values())
    required_concept_coverage = 1.0 if requested_concept_count <= 2 else 0.66
    eligible = [
        item for item in scored
        if item["rankingScore"] >= 0.45
        and item["audienceAdjustment"] > -0.25
        and (not has_requested_concepts or item["conceptCoverage"] >= required_concept_coverage)
    ]
    # 같은 시리즈는 가장 잘 맞는 한 건만 남기고 몇 회차가 더 있는지만 알려 준다.
    best_of_series: dict[str, dict[str, Any]] = {}
    for item in eligible:
        key = series_key(item["title"], item["target"])
        kept = best_of_series.get(key)
        if kept is None:
            best_of_series[key] = {**item, "seriesCount": 1}
        else:
            kept["seriesCount"] += 1
    deduped = list(best_of_series.values())
    results = [{"rank": rank, **item} for rank, item in enumerate(deduped[:limit], 1)]
    return {
        "query": query,
        "limit": limit,
        "model": MODEL_ID,
        "profile": profile,
        "requestedAudience": AUDIENCE_LABELS.get(requested_audience) if requested_audience else None,
        "reranking": "audience-compatibility-v1",
        "conceptReranking": "topic-activity-compatibility-v1",
        "requestedConcepts": {group: sorted(values) for group, values in requested_concepts.items()},
        "minimumCriteria": {"rankingScore": 0.45, "conceptCoverage": required_concept_coverage if has_requested_concepts else None},
        "requestedAudienceFilter": audience,
        "filteredOutByAudience": filtered_out,
        "candidateCount": len(scored),
        "eligibleCount": len(eligible),
        "results": results,
    }


def search(query: str, profile: str, limit: int, audience: str | None = None) -> dict[str, Any]:
    return rank(query, profile, limit, provider(), audience)


def evaluate() -> dict[str, Any]:
    encoder = provider()
    profiles = []
    for profile in PROFILES:
        rows = []
        reciprocal_rank = 0.0
        hits = {1: 0, 3: 0, 5: 0}
        for query, expected in EVALUATION_QUERIES:
            response = rank(query, profile, EVALUATION_LIMIT, encoder)
            first_rank = next((item["rank"] for item in response["results"] if item["sourceId"] in expected), None)
            if first_rank:
                reciprocal_rank += 1.0 / first_rank
                for k in hits:
                    hits[k] += int(first_rank <= k)
            rows.append({
                "query": query,
                "expectedSourceIds": sorted(expected),
                "firstRelevantRank": first_rank,
                "top5": [{"sourceId": item["sourceId"], "title": item["title"], "similarity": item["similarity"]} for item in response["results"][:5]],
            })
        total = len(EVALUATION_QUERIES)
        profiles.append({
            "profile": profile, "hitAt1": hits[1] / total,
            "hitAt3": hits[3] / total, "hitAt5": hits[5] / total,
            "mrr": reciprocal_rank / total, "queries": rows,
        })
    result = {"schemaVersion": "program-board-search-evaluation/v1", "queryCount": len(EVALUATION_QUERIES), "profiles": profiles}
    write_json(artifact_directory() / "evaluation.json", result)
    return result


def curriculum_excerpt(description: str) -> str:
    start = description.find("차시")
    if start < 0:
        return ""
    end_candidates = [index for marker in ("<안내 사항>", "<안내사항>", "※ 안내", "★ 개인정보") if (index := description.find(marker, start)) >= 0]
    end = min(end_candidates) if end_candidates else len(description)
    return description[start:end].strip()[:5000]


def attachment_curriculum_excerpt(curriculum: list[dict[str, Any]]) -> str:
    rows = []
    for session in curriculum:
        heading = f"{session.get('session', '?')}회차"
        if session.get("date"):
            heading += f" ({session['date']})"
        details = [str(session.get("activity") or "").strip()]
        if session.get("category"):
            details.append(f"분야: {session['category']}")
        if session.get("teachingMethod"):
            details.append(f"방법: {session['teachingMethod']}")
        if session.get("materials"):
            details.append(f"준비물: {session['materials']}")
        if session.get("notes") and "![image]" not in str(session["notes"]):
            details.append(f"비고: {session['notes']}")
        rows.append(f"### {heading}\n" + "\n".join(value for value in details if value))
    return "\n\n".join(rows)[:8000]


def build_context(query: str, profile: str, limit: int, audience: str | None = None) -> dict[str, Any]:
    response = search(query, profile, limit, audience)
    # 정제 결과 하나만 읽는다. 파일럿이 나눠 읽던 텍스트 열일곱 건도 여기에 모두 들어 있다.
    board = read_json(backend_directory() / ".local" / "program-attachment-batch" / "full.json")
    programs = {item["sourceId"]: item for item in board["items"]}
    lines = [
        "# 유사 프로그램 참고 컨텍스트", "", f"## 사용자 요청\n{query}", "",
        "## 검색 및 사용 원칙",
        f"- 검색 후보: {response['candidateCount']}건 / 최소 기준 통과: {response['eligibleCount']}건 / 참고: {len(response['results'])}건",
        "- 회차별 정보가 없는 프로그램을 근거로 구체적인 회차 내용을 지어내지 않는다.",
        "- 아래 자료를 복사하기보다 공통 구조와 활동 아이디어를 참고해 새로운 기획안을 작성한다.", "",
    ]
    for result in response["results"]:
        program = programs.get(result["sourceId"]) or {}
        basic = {item["label"]: item["value"] for item in program.get("basicInfo", [])}
        lines.extend([
            f"## 참고 {result['rank']}. {result['title']}",
            f"- sourceId: {result['sourceId']}",
            f"- 검색 근거: 의미 유사도 {result['similarity']:.3f}, 개념 충족률 {result['conceptCoverage']:.0%}, {result['audienceMatch']}",
            f"- 상세도: {result['detailLevel']} ({result['detailReason']})",
            f"- 대상: {result['target'] or '정보 없음'}",
            f"- 운영 도서관: {result['libraryName'] or '정보 없음'}",
            f"- 교육 기간: {basic.get('교육기간') or '정보 없음'}",
            f"- 교육 시간: {basic.get('교육시간') or '정보 없음'}",
            f"- 모집 인원: {basic.get('모집인원') or '정보 없음'}",
            f"- 소개·목표: {result['summary'] or '정보 없음'}",
        ])
        excerpt = attachment_curriculum_excerpt(program.get("curriculum", []))
        if excerpt:
            lines.extend(["", "### 회차별 참고 내용", "```text", excerpt, "```"])
        else:
            lines.extend(["", "> 회차별 원문 정보가 없어 프로그램 소개까지만 참고할 수 있음."])
        lines.append("")
    markdown = "\n".join(lines).strip() + "\n"
    slug = hashlib.sha256(query.encode("utf-8")).hexdigest()[:12]
    output_path = artifact_directory() / "contexts" / f"{slug}.md"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(markdown, encoding="utf-8")
    return {"query": query, "outputPath": str(output_path), "resultCount": len(response["results"]), "markdown": markdown, "search": response}


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(prog="program-board-semantic-search")
    commands = result.add_subparsers(dest="command", required=True)
    build_parser = commands.add_parser("build")
    build_parser.add_argument("--profile", choices=PROFILES, required=True)
    search_parser = commands.add_parser("search")
    search_parser.add_argument("--query", required=True)
    search_parser.add_argument("--profile", choices=PROFILES, default="title+intro+target")
    search_parser.add_argument("--limit", type=int, default=5)
    search_parser.add_argument("--audience", choices=AUDIENCE_FILTERS, default=None)
    commands.add_parser("evaluate")
    context_parser = commands.add_parser("context")
    context_parser.add_argument("--query", required=True)
    context_parser.add_argument("--profile", choices=PROFILES, default="title+intro+target")
    context_parser.add_argument("--limit", type=int, default=3)
    context_parser.add_argument("--audience", choices=AUDIENCE_FILTERS, default=None)
    return result


def main() -> int:
    args = parser().parse_args()
    if args.command == "build":
        payload = build(args.profile)
    elif args.command == "evaluate":
        payload = evaluate()
    elif args.command == "context":
        payload = build_context(args.query, args.profile, args.limit, args.audience)
    else:
        payload = search(args.query, args.profile, args.limit, args.audience)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
