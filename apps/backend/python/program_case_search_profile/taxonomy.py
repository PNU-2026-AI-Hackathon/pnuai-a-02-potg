from __future__ import annotations

import re
from collections.abc import Iterable

TOPICS = (
    "READING_WRITING", "ART_CRAFT", "DIGITAL", "HEALTH", "LANGUAGE",
    "ENVIRONMENT_SCIENCE", "CULTURE", "COMMUNITY", "OTHER", "UNKNOWN",
)
TARGET_AGES = ("INFANT", "CHILD", "TEEN", "ADULT", "SENIOR", "FAMILY", "UNKNOWN")
ACTIVITY_TYPES = ("READING", "WRITING", "ART", "CRAFT", "DIGITAL_PRACTICE", "EXERCISE", "EXPERIMENT", "PERFORMANCE", "DISCUSSION", "COMMUNITY_ACTIVITY", "UNKNOWN")
OPERATION_TYPES = ("ONE_OFF", "MULTI_SESSION", "FAMILY_PARTICIPATION", "GROUP", "UNKNOWN")

TOPIC_RULES = {
    "READING_WRITING": ("독서", "책", "그림책", "동화", "글쓰기", "논술", "문해", "작문"),
    "ART_CRAFT": ("미술", "그림", "공예", "만들기", "도예", "캘리", "드로잉"),
    "DIGITAL": ("디지털", "컴퓨터", "스마트폰", "코딩", "미디어", "ai", "인공지능"),
    "HEALTH": ("건강", "운동", "체조", "요가", "치매", "마음", "힐링"),
    "LANGUAGE": ("영어", "언어", "한글", "한국어", "중국어", "일본어"),
    "ENVIRONMENT_SCIENCE": ("환경", "과학", "생태", "기후", "실험", "자연", "천문"),
    "CULTURE": ("문화", "공연", "음악", "연극", "영화", "역사", "인문"),
    "COMMUNITY": ("공동체", "주민", "마을", "지역", "봉사", "동아리"),
}
TARGET_RULES = {
    "INFANT": ("유아", "영유아", "미취학"),
    "CHILD": ("어린이", "아동", "초등", "초등학생"),
    "TEEN": ("청소년", "중학생", "고등학생"),
    "ADULT": ("성인", "일반인", "대학생", "직장인"),
    "SENIOR": ("어르신", "노인", "노년", "시니어", "65세"),
    "FAMILY": ("가족", "부모", "보호자", "엄마", "아빠"),
}
ACTIVITY_RULES = {
    "READING": ("독서", "읽기", "책", "낭독"), "WRITING": ("글쓰기", "논술", "작문", "쓰기"),
    "ART": ("미술", "그림", "드로잉", "회화"), "CRAFT": ("공예", "만들기", "도예"),
    "DIGITAL_PRACTICE": ("코딩", "컴퓨터", "스마트폰", "디지털", "ai", "인공지능"),
    "EXERCISE": ("운동", "체조", "요가", "스트레칭"), "EXPERIMENT": ("실험", "과학", "관찰"),
    "PERFORMANCE": ("공연", "연극", "음악", "악기"), "DISCUSSION": ("토론", "토의", "논술"),
    "COMMUNITY_ACTIVITY": ("공동체", "주민", "마을", "봉사"),
}

def _matches(text: str, rules: dict[str, tuple[str, ...]], order: tuple[str, ...]) -> list[str]:
    lowered = text.casefold()
    return [key for key in order if key in rules and any(word.casefold() in lowered for word in rules[key])]

def normalize_text(parts: Iterable[str | None], *, max_chars: int = 12000) -> str:
    text = " ".join(part.strip() for part in parts if part and part.strip())
    return re.sub(r"\s+", " ", text)[:max_chars]

def classify(text: str, *, session_count: int) -> dict[str, list[str]]:
    topics = _matches(text, TOPIC_RULES, TOPICS)
    targets = _matches(text, TARGET_RULES, TARGET_AGES)
    activities = _matches(text, ACTIVITY_RULES, ACTIVITY_TYPES)
    operations: list[str] = ["MULTI_SESSION" if session_count > 1 else "ONE_OFF"]
    if "FAMILY" in targets:
        operations.append("FAMILY_PARTICIPATION")
    if any(word in text for word in ("모둠", "그룹", "함께", "동아리")):
        operations.append("GROUP")
    return {
        "topics": topics[:3] or ["UNKNOWN"],
        "targetAgeGroups": targets[:2] or ["UNKNOWN"],
        "activityTypes": activities[:3] or ["UNKNOWN"],
        "operationTypes": [value for value in OPERATION_TYPES if value in operations],
    }

def search_keywords(classification: dict[str, list[str]], title: str) -> list[str]:
    words = re.findall(r"[0-9A-Za-z가-힣]{2,}", title)
    excluded = {"프로그램", "강좌", "수업", "모집", "신청", "교육"}
    values = [word for word in words if word not in excluded]
    for axis in ("topics", "targetAgeGroups", "activityTypes"):
        values.extend(value.lower().replace("_", " ") for value in classification[axis] if value != "UNKNOWN")
    return sorted(dict.fromkeys(values), key=lambda value: (value.casefold(), value))[:20]
