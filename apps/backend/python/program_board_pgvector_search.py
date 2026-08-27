from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from program_board_semantic_search import (
    AUDIENCE_FILTERS,
    AUDIENCE_LABELS,
    EMBEDDING_VERSION,
    EVALUATION_QUERIES,
    MAX_RESULT_LIMIT,
    MODEL_DIMENSION,
    MODEL_ID,
    MODEL_REVISION,
    RELATIVE_SIMILARITY_FLOOR,
    artifact_directory,
    audience_adjustment,
    audience_candidates,
    document_audiences,
    query_audience,
    series_key,
    text_concepts,
    concept_adjustment,
    rank as legacy_rank,
)
from program_case_semantic_search.config import PROVIDER, Settings
from program_case_semantic_search.database import connect
from program_case_semantic_search.kure_embedding_provider import KureEmbeddingProvider
from program_case_semantic_search.vector_utils import validate_vector


BACKEND = Path(__file__).resolve().parents[1]
PROFILE = "title+intro+target"


def _settings() -> Settings:
    load_dotenv(BACKEND / ".env")
    return Settings.from_environment()


def _provider(settings: Settings) -> KureEmbeddingProvider:
    cache = settings.model_cache_dir or (BACKEND / ".model-cache")
    return KureEmbeddingProvider(cache_folder=str(cache))


def _profile_documents() -> list[dict[str, Any]]:
    path = artifact_directory() / f"documents.{PROFILE}.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    documents = payload.get("documents", [])
    if payload.get("profile") != PROFILE or payload.get("count") != len(documents) or not documents:
        raise RuntimeError(f"invalid Studio search profile artifact: {path}")
    return documents


def _profile_embeddings() -> dict[int, dict[str, Any]]:
    document_path = artifact_directory() / f"documents.{PROFILE}.json"
    embedding_path = artifact_directory() / f"embeddings.{PROFILE}.json"
    payload = json.loads(embedding_path.read_text(encoding="utf-8"))
    source_checksum = hashlib.sha256(document_path.read_bytes()).hexdigest()
    items = payload.get("items", [])
    if (payload.get("count") != len(items) or payload.get("dimension") != MODEL_DIMENSION):
        raise RuntimeError(f"invalid Studio embedding artifact: {embedding_path}")
    if payload.get("model") != MODEL_ID or payload.get("modelRevision") != MODEL_REVISION:
        raise RuntimeError("Studio embedding artifact model metadata does not match pinned KURE-v1")
    if payload.get("sourceChecksum") != source_checksum:
        raise RuntimeError("Studio documents and embedding artifacts have different checksums")
    return {int(item["sourceId"]): item for item in items}


def _reference_programs() -> dict[int, dict[str, Any]]:
    path = BACKEND / ".local" / "program-attachment-batch" / "full.json"
    payload = json.loads(path.read_text(encoding="utf-8"))
    return {int(item["sourceId"]): item for item in payload.get("items", [])}


def _vector_value(vector: list[float]) -> object:
    checked = validate_vector(vector, MODEL_DIMENSION)
    try:
        from pgvector import Vector
    except ImportError:
        return checked
    return Vector(checked)


def sync_profiles() -> dict[str, Any]:
    """파일럿 대표 문서를 기존 문서/청크/임베딩 테이블에 멱등 적재한다."""
    settings = _settings()
    documents = _profile_documents()
    embeddings = _profile_embeddings()
    if len(embeddings) != len(documents):
        raise RuntimeError("Studio profile and embedding counts do not match")
    references = _reference_programs()
    created = updated = unchanged = 0
    now = datetime.now(timezone.utc)

    with connect(settings.database_url, read_only=False) as connection:
        with connection.cursor() as cursor:
            for document in documents:
                checksum = document["checksum"]
                embedding_item = embeddings.get(int(document["sourceId"]))
                if embedding_item is None or embedding_item.get("checksum") != checksum:
                    raise RuntimeError(f'embedding is stale for sourceId={document["sourceId"]}')
                profile_data = {**document, "referenceProgram": references.get(int(document["sourceId"]), {})}
                cursor.execute('SELECT "contentHash", "modelRevision", "embeddingVersion" FROM "StudioProgramSearchProfile" WHERE "sourceId" = %s', (document["sourceId"],))
                existing = cursor.fetchone()
                if existing == (checksum, MODEL_REVISION, EMBEDDING_VERSION):
                    unchanged += 1
                else:
                    if existing:
                        updated += 1
                    else:
                        created += 1
                    cursor.execute(
                        '''
INSERT INTO "StudioProgramSearchProfile" (
  "id", "sourceId", "sourceUrl", "title", "target", "libraryName", "summary", "profileData",
  "embeddingText", "contentHash", "provider", "model", "modelRevision", "embeddingVersion",
  "dimension", "embedding", "createdAt", "updatedAt"
) VALUES (gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s,
          %s::vector(1024), %s, %s)
ON CONFLICT ("sourceId") DO UPDATE SET
  "sourceUrl" = EXCLUDED."sourceUrl", "title" = EXCLUDED."title", "target" = EXCLUDED."target",
  "libraryName" = EXCLUDED."libraryName", "summary" = EXCLUDED."summary",
  "profileData" = EXCLUDED."profileData", "embeddingText" = EXCLUDED."embeddingText",
  "contentHash" = EXCLUDED."contentHash", "provider" = EXCLUDED."provider", "model" = EXCLUDED."model",
  "modelRevision" = EXCLUDED."modelRevision", "embeddingVersion" = EXCLUDED."embeddingVersion",
  "dimension" = EXCLUDED."dimension", "embedding" = EXCLUDED."embedding", "updatedAt" = EXCLUDED."updatedAt"
''',
                        (document["sourceId"], document["sourceUrl"], document["title"], document.get("target"),
                         document.get("libraryName"), document.get("summary", ""), json.dumps(profile_data, ensure_ascii=False),
                         document["embeddingText"], checksum, PROVIDER, MODEL_ID, MODEL_REVISION,
                         EMBEDDING_VERSION, MODEL_DIMENSION, _vector_value(embedding_item["embedding"]), now, now),
                    )
        connection.commit()
    return {"profile": PROFILE, "count": len(documents), "created": created, "updated": updated, "unchanged": unchanged}


def _pgvector_candidates_from_vector(vector: object) -> list[dict[str, Any]]:
    settings = _settings()
    statement = '''
WITH query_embedding AS (SELECT %s::vector(1024) AS value)
SELECT p."profileData", (1 - (p."embedding" <=> q.value))::double precision
FROM "StudioProgramSearchProfile" p
CROSS JOIN query_embedding q
WHERE p."provider" = %s AND p."model" = %s AND p."modelRevision" = %s
  AND p."embeddingVersion" = %s AND p."dimension" = %s
ORDER BY p."embedding" <=> q.value ASC, p."sourceId" ASC
'''
    with connect(settings.database_url, read_only=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(statement, (vector, PROVIDER, MODEL_ID, MODEL_REVISION, EMBEDDING_VERSION, MODEL_DIMENSION))
            rows = cursor.fetchall()
    candidates = []
    for row in rows:
        document = row[0] if isinstance(row[0], dict) else json.loads(row[0])
        reference = document.pop("referenceProgram", {})
        basic = {item.get("label"): item.get("value") for item in reference.get("basicInfo", [])}
        document.update({"similarity": float(row[1]), "educationPeriod": basic.get("교육기간"),
                         "educationTime": basic.get("교육시간"), "capacity": basic.get("모집인원"),
                         "sessions": reference.get("curriculum", [])})
        candidates.append(document)
    return candidates


def _pgvector_candidates(query: str) -> list[dict[str, Any]]:
    settings = _settings()
    return _pgvector_candidates_from_vector(_vector_value(_provider(settings).encode_query(query)))


def rerank(query: str, candidates: list[dict[str, Any]], limit: int, audience: str | None = None) -> dict[str, Any]:
    """파일럿의 대상·개념·임계값·시리즈 제거 정책을 pgvector 후보에 그대로 적용한다."""
    if not query.strip() or len(query.strip()) > 1000:
        raise ValueError("query must contain 1-1000 characters")
    if limit < 1 or limit > MAX_RESULT_LIMIT:
        raise ValueError(f"limit must be between 1 and {MAX_RESULT_LIMIT}")
    if audience and not audience_candidates(audience):
        raise ValueError(f"unsupported audience: {audience}")
    filtered_out = 0
    if audience:
        keep = audience_candidates(audience) | {"general"}
        kept = [item for item in candidates if document_audiences(item.get("target")) & keep]
        filtered_out = len(candidates) - len(kept)
        candidates = kept
    requested_audience = query_audience(query)
    requested_concepts = text_concepts(query)
    scored = []
    for item in candidates:
        adjustment, reason = audience_adjustment(requested_audience, document_audiences(item.get("target")))
        concepts = text_concepts(f'{item["title"]} {item.get("summary", "")}')
        concept_score, coverage, matched, missing = concept_adjustment(requested_concepts, concepts)
        scored.append({**item, "rankingScore": round(item["similarity"] + adjustment + concept_score, 8),
                       "audienceAdjustment": adjustment, "audienceMatch": reason,
                       "conceptAdjustment": concept_score, "conceptCoverage": round(coverage, 4),
                       "matchedConcepts": matched, "missingConcepts": missing})
    scored.sort(key=lambda item: (-item["rankingScore"], -item["similarity"], item["sourceId"]))
    has_concepts = any(requested_concepts.values())
    concept_count = sum(len(values) for values in requested_concepts.values())
    required_coverage = 1.0 if concept_count <= 2 else 0.66
    eligible = [item for item in scored if item["rankingScore"] >= 0.45
                and item["audienceAdjustment"] > -0.25
                and (not has_concepts or item["conceptCoverage"] >= required_coverage)]
    if eligible:
        floor = max(item["similarity"] for item in eligible) * RELATIVE_SIMILARITY_FLOOR
        eligible = [item for item in eligible if item["similarity"] >= floor]
    best: dict[str, dict[str, Any]] = {}
    for item in eligible:
        key = series_key(item["title"], item.get("target"))
        if key not in best:
            best[key] = {**item, "seriesCount": 1}
        else:
            best[key]["seriesCount"] += 1
    results = [{"rank": index, **item} for index, item in enumerate(list(best.values())[:limit], 1)]
    return {"query": query, "limit": limit, "model": MODEL_ID, "profile": PROFILE,
            "source": "POSTGRESQL_PGVECTOR", "requestedAudience": AUDIENCE_LABELS.get(requested_audience),
            "requestedAudienceFilter": audience, "filteredOutByAudience": filtered_out,
            "reranking": "audience-compatibility-v1", "conceptReranking": "topic-activity-compatibility-v1",
            "minimumCriteria": {"rankingScore": 0.45,
                                "conceptCoverage": required_coverage if has_concepts else None,
                                "relativeSimilarityFloor": RELATIVE_SIMILARITY_FLOOR},
            "candidateCount": len(scored), "eligibleCount": len(eligible), "results": results}


def search(query: str, limit: int = 5, audience: str | None = None) -> dict[str, Any]:
    return rerank(query.strip(), _pgvector_candidates(query.strip()), limit, audience)


class _StaticQueryEncoder:
    def __init__(self, vector: list[float]) -> None:
        self.vector = vector

    def encode_query(self, _query: str) -> list[float]:
        return self.vector


def verify_against_file_pilot() -> dict[str, Any]:
    """파일 파일럿과 pgvector의 30개 평가 질의 Top 5가 같은지 확인한다."""
    settings = _settings()
    provider = _provider(settings)
    comparisons = []
    largest_delta = 0.0
    for query, audience in EVALUATION_QUERIES:
        vector = provider.encode_query(query)
        legacy = legacy_rank(query, PROFILE, 5, _StaticQueryEncoder(vector), audience)
        pgvector = rerank(query, _pgvector_candidates_from_vector(_vector_value(vector)), 5, audience)
        legacy_ids = [item["sourceId"] for item in legacy["results"]]
        pgvector_ids = [item["sourceId"] for item in pgvector["results"]]
        legacy_scores = {item["sourceId"]: item["similarity"] for item in legacy["results"]}
        pgvector_scores = {item["sourceId"]: item["similarity"] for item in pgvector["results"]}
        delta = max((abs(legacy_scores[source_id] - pgvector_scores[source_id])
                     for source_id in set(legacy_scores) & set(pgvector_scores)), default=0.0)
        largest_delta = max(largest_delta, delta)
        comparisons.append({"query": query, "audience": audience, "matches": legacy_ids == pgvector_ids,
                            "fileTop5": legacy_ids, "pgvectorTop5": pgvector_ids,
                            "maximumSimilarityDelta": delta})
    mismatches = [item for item in comparisons if not item["matches"]]
    return {"queryCount": len(comparisons), "matched": len(comparisons) - len(mismatches),
            "mismatchCount": len(mismatches), "largestSimilarityDelta": largest_delta,
            "mismatches": mismatches}


def _session_excerpt(sessions: list[dict[str, Any]]) -> str:
    rows = []
    for session in sessions[:20]:
        heading = f'{session.get("session") or session.get("sessionNumber") or len(rows) + 1}회차'
        date = session.get("date") or session.get("dateText")
        if date:
            heading += f' ({date})'
        rows.append(f'### {heading}\n{session.get("activity", "").strip()}')
    return "\n\n".join(rows)[:8000]


def build_context(query: str, limit: int = 5, audience: str | None = None) -> dict[str, Any]:
    response = search(query, limit, audience)
    lines = ["# 유사 프로그램 참고 컨텍스트", "", f"## 사용자 요청\n{query}", "",
             "## 검색 및 사용 원칙",
             f"- 검색 후보: {response['candidateCount']}건 / 최소 기준 통과: {response['eligibleCount']}건 / 참고: {len(response['results'])}건",
             "- 회차별 정보가 없는 프로그램을 근거로 구체적인 회차 내용을 지어내지 않는다.",
             "- 아래 자료를 복사하기보다 공통 구조와 활동 아이디어를 참고해 새로운 기획안을 작성한다.", ""]
    for result in response["results"]:
        lines.extend([f"## 참고 {result['rank']}. {result['title']}",
                      f"- 검색 근거: 의미 유사도 {result['similarity']:.3f}, 개념 충족률 {result['conceptCoverage']:.0%}, {result['audienceMatch']}",
                      f"- 상세도: {result['detailLevel']} ({result['detailReason']})",
                      f"- 대상: {result.get('target') or '정보 없음'}",
                      f"- 운영 도서관: {result.get('libraryName') or '정보 없음'}",
                      f"- 교육 기간: {result.get('educationPeriod') or '정보 없음'}",
                      f"- 교육 시간: {result.get('educationTime') or '정보 없음'}",
                      f"- 모집 인원: {result.get('capacity') or '정보 없음'}",
                      f"- 소개·목표: {result.get('summary') or '정보 없음'}"])
        excerpt = _session_excerpt(result.get("sessions") or [])
        lines.extend(["", "### 회차별 참고 내용", "```text", excerpt, "```", ""] if excerpt else
                     ["", "> 회차별 원문 정보가 없어 프로그램 소개까지만 참고할 수 있음.", ""])
    markdown = "\n".join(lines).strip() + "\n"
    return {"query": query, "resultCount": len(response["results"]), "markdown": markdown, "search": response}


def main() -> int:
    parser = argparse.ArgumentParser(prog="program-board-pgvector-search")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("sync")
    commands.add_parser("verify")
    for name in ("search", "context"):
        command = commands.add_parser(name)
        command.add_argument("--query")
        command.add_argument("--limit", type=int, default=5)
        command.add_argument("--audience", choices=AUDIENCE_FILTERS, default=None)
    args = parser.parse_args()
    if args.command == "sync":
        result = sync_profiles()
    elif args.command == "verify":
        result = verify_against_file_pilot()
    else:
        query = args.query or sys.stdin.buffer.read().decode("utf-8")
        result = build_context(query, args.limit, args.audience) if args.command == "context" else search(query, args.limit, args.audience)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
