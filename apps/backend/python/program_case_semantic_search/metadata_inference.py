from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum

from .config import MAX_QUERY_CHARACTERS


class AgeGroup(str, Enum):
    INFANT = "INFANT"
    CHILD = "CHILD"
    ADULT = "ADULT"
    SENIOR = "SENIOR"
    FAMILY = "FAMILY"
    PARENT_CHILD = "PARENT_CHILD"
    GENERAL = "GENERAL"
    UNKNOWN = "UNKNOWN"


class ProgramCategory(str, Enum):
    READING = "READING"
    WRITING = "WRITING"
    CRAFT = "CRAFT"
    ART = "ART"
    DIGITAL = "DIGITAL"
    HEALTH = "HEALTH"
    LANGUAGE = "LANGUAGE"
    CULTURE = "CULTURE"
    ENVIRONMENT = "ENVIRONMENT"
    SCIENCE = "SCIENCE"
    HISTORY = "HISTORY"
    MUSIC = "MUSIC"
    COOKING = "COOKING"
    COMMUNITY = "COMMUNITY"
    UNKNOWN = "UNKNOWN"


class ParticipationType(str, Enum):
    PARENT_CHILD = "PARENT_CHILD"
    FAMILY = "FAMILY"
    GROUP = "GROUP"
    UNKNOWN = "UNKNOWN"


class OperationType(str, Enum):
    LECTURE = "LECTURE"
    EXPERIENCE = "EXPERIENCE"
    WORKSHOP = "WORKSHOP"
    PERFORMANCE = "PERFORMANCE"
    MULTI_SESSION = "MULTI_SESSION"
    ONE_DAY = "ONE_DAY"
    UNKNOWN = "UNKNOWN"


AGE_PATTERNS = {
    AgeGroup.INFANT: (r"영유아", r"유아", r"\b[3-7]\s*[~-]\s*7세"),
    AgeGroup.CHILD: (r"어린이", r"아동", r"초등", r"키즈"),
    AgeGroup.ADULT: (r"성인", r"일반인", r"중장년"),
    AgeGroup.SENIOR: (r"노년", r"어르신", r"시니어", r"노인"),
    AgeGroup.FAMILY: (r"가족",),
    AgeGroup.PARENT_CHILD: (r"부모.{0,6}(?:아이|자녀|유아|어린이)", r"보호자\s*동반"),
    AgeGroup.GENERAL: (r"지역\s*주민", r"누구나", r"전연령"),
}

CATEGORY_PATTERNS = {
    ProgramCategory.READING: (r"독서", r"책\s*읽", r"그림책", r"책놀이"),
    ProgramCategory.WRITING: (r"글쓰기", r"논술", r"작문", r"에세이"),
    ProgramCategory.CRAFT: (r"공예", r"만들기", r"3D\s*펜", r"뜨개", r"클레이"),
    ProgramCategory.ART: (r"미술", r"드로잉", r"그림", r"아트", r"회화"),
    ProgramCategory.DIGITAL: (r"디지털", r"스마트폰", r"컴퓨터", r"코딩", r"AI\b"),
    ProgramCategory.HEALTH: (r"건강", r"운동", r"명상", r"요가", r"생체\s*나이"),
    ProgramCategory.LANGUAGE: (r"영어", r"English", r"언어", r"한자"),
    ProgramCategory.CULTURE: (r"문화", r"예술", r"공연"),
    ProgramCategory.ENVIRONMENT: (r"환경", r"기후", r"지구", r"생태"),
    ProgramCategory.SCIENCE: (r"과학", r"실험", r"천문"),
    ProgramCategory.HISTORY: (r"역사", r"한국사", r"세계사", r"삼국지"),
    ProgramCategory.MUSIC: (r"음악", r"악기", r"클래식", r"노래"),
    ProgramCategory.COOKING: (r"요리", r"쿠킹", r"베이킹"),
    ProgramCategory.COMMUNITY: (r"주민", r"마을", r"동아리", r"모임"),
}

PARTICIPATION_PATTERNS = {
    ParticipationType.PARENT_CHILD: AGE_PATTERNS[AgeGroup.PARENT_CHILD],
    ParticipationType.FAMILY: (r"가족",),
    ParticipationType.GROUP: (r"모임", r"동아리", r"함께"),
}

OPERATION_PATTERNS = {
    OperationType.LECTURE: (r"강연", r"강좌", r"특강"),
    OperationType.EXPERIENCE: (r"체험",),
    OperationType.WORKSHOP: (r"워크숍", r"공방", r"만들기"),
    OperationType.PERFORMANCE: (r"공연", r"연극"),
    OperationType.MULTI_SESSION: (r"\d+\s*회", r"\d+기", r"과정"),
    OperationType.ONE_DAY: (r"원데이", r"1일", r"단회"),
}


@dataclass(frozen=True)
class InferredProgramMetadata:
    age_groups: frozenset[AgeGroup]
    categories: frozenset[ProgramCategory]
    participation_types: frozenset[ParticipationType]
    operation_types: frozenset[OperationType]


@dataclass(frozen=True)
class ProgramCaseSearchRequest:
    query: str
    limit: int = 5
    chunk_type: str | None = None
    target_text: str | None = None
    age_groups: frozenset[AgeGroup] = frozenset()
    categories: frozenset[ProgramCategory] = frozenset()
    participation_types: frozenset[ParticipationType] = frozenset()
    operation_types: frozenset[OperationType] = frozenset()


def _matches(text: str, rules: dict[Enum, tuple[str, ...]]) -> frozenset:
    return frozenset(label for label, patterns in rules.items()
                     if any(re.search(pattern, text, re.IGNORECASE) for pattern in patterns))


def _with_unknown(values: frozenset, unknown: Enum) -> frozenset:
    return values or frozenset({unknown})


def infer_program_metadata(title: str, target_audience: str) -> InferredProgramMetadata:
    text = " ".join(part.strip() for part in (title, target_audience) if part.strip())
    return InferredProgramMetadata(
        age_groups=_with_unknown(_matches(text, AGE_PATTERNS), AgeGroup.UNKNOWN),
        categories=_with_unknown(_matches(text, CATEGORY_PATTERNS), ProgramCategory.UNKNOWN),
        participation_types=_with_unknown(
            _matches(text, PARTICIPATION_PATTERNS), ParticipationType.UNKNOWN
        ),
        operation_types=_with_unknown(
            _matches(text, OPERATION_PATTERNS), OperationType.UNKNOWN
        ),
    )


_QUERY_LABELS = {
    AgeGroup.INFANT: "유아", AgeGroup.CHILD: "어린이·초등",
    AgeGroup.ADULT: "성인", AgeGroup.SENIOR: "노년·어르신",
    AgeGroup.FAMILY: "가족", AgeGroup.PARENT_CHILD: "부모 동반",
    AgeGroup.GENERAL: "일반 대상",
    ProgramCategory.READING: "독서", ProgramCategory.WRITING: "글쓰기",
    ProgramCategory.CRAFT: "공예", ProgramCategory.ART: "미술·예술",
    ProgramCategory.DIGITAL: "디지털", ProgramCategory.HEALTH: "건강",
    ProgramCategory.LANGUAGE: "언어", ProgramCategory.CULTURE: "문화",
    ProgramCategory.ENVIRONMENT: "환경", ProgramCategory.SCIENCE: "과학",
    ProgramCategory.HISTORY: "역사", ProgramCategory.MUSIC: "음악",
    ProgramCategory.COOKING: "요리", ProgramCategory.COMMUNITY: "주민·공동체",
    ParticipationType.PARENT_CHILD: "부모와 아이 함께",
    ParticipationType.FAMILY: "가족 참여", ParticipationType.GROUP: "모임·그룹",
    OperationType.LECTURE: "강연·강좌", OperationType.EXPERIENCE: "체험",
    OperationType.WORKSHOP: "워크숍", OperationType.PERFORMANCE: "공연",
    OperationType.MULTI_SESSION: "다회차", OperationType.ONE_DAY: "단회성",
}


def build_semantic_query(request: ProgramCaseSearchRequest) -> str:
    query = request.query.strip()
    if not query:
        raise ValueError("query must not be empty")
    labels = []
    for values in (request.age_groups, request.categories,
                   request.participation_types, request.operation_types):
        for value in sorted(values, key=lambda item: item.value):
            label = _QUERY_LABELS.get(value)
            if label and label not in labels:
                labels.append(label)
    parts = [query]
    if labels:
        parts.append("검색 조건: " + ", ".join(labels))
    built = ". ".join(parts)
    if len(built) > MAX_QUERY_CHARACTERS:
        raise ValueError(f"semantic query must be at most {MAX_QUERY_CHARACTERS} characters")
    return built
