from __future__ import annotations

import hashlib
import re
from typing import Any

from . import PROFILE_VERSION, RULE_VERSION, TEMPLATE_VERSION
from .repository import ProgramSource
from .taxonomy import classify, normalize_text, search_keywords

PRIVATE_PATTERNS = (
    re.compile(r"01[016789][-\s]?\d{3,4}[-\s]?\d{4}"),
    re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}"),
)

def _hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def _safe_title(title: str) -> str:
    value = re.sub(r"\s+", " ", title).strip()[:160]
    for pattern in PRIVATE_PATTERNS:
        value = pattern.sub("", value)
    return value

def build_profile(source: ProgramSource) -> dict[str, Any]:
    title = _safe_title(source.title)
    title_target = normalize_text((title, source.target))
    session_text = normalize_text(source.sessions)
    attachment_text = normalize_text(source.attachments)
    classification = classify(title_target, session_count=source.session_count)
    dependency = "TITLE_TARGET"
    for fallback_text, fallback_dependency in ((session_text, "SESSION"), (attachment_text, "ATTACHMENT")):
        if not fallback_text:
            continue
        fallback = classify(fallback_text, session_count=source.session_count)
        used = False
        for axis in ("topics", "targetAgeGroups", "activityTypes"):
            if classification[axis] == ["UNKNOWN"] and fallback[axis] != ["UNKNOWN"]:
                classification[axis] = fallback[axis]
                used = True
        if used:
            dependency = fallback_dependency
    keywords = search_keywords(classification, title)
    evidence = []
    for axis in ("topics", "targetAgeGroups", "activityTypes", "operationTypes"):
        for value in classification[axis]:
            evidence.append({
                "field": axis, "value": value, "method": "RULE",
                "sourceField": "titleTargetSessionAttachment",
                "evidenceCode": f"RULE_{axis.upper()}_{value}",
                "ruleVersion": RULE_VERSION,
                "confidence": "INSUFFICIENT" if value == "UNKNOWN" else "CONFIRMED",
                "insufficientEvidence": value == "UNKNOWN",
            })
    source_material = "\n".join((title_target, session_text, attachment_text))
    profile = {
        "programCaseId": source.program_case_id, "title": title, **classification,
        "sessionCount": source.session_count, "searchKeywords": keywords,
        "sourceHash": _hash(source_material), "profileVersion": PROFILE_VERSION,
        "templateVersion": TEMPLATE_VERSION, "extraction": evidence,
        "sourceDependency": dependency,
    }
    profile["representativeDocument"] = representative_document(profile)
    profile["representativeDocumentHash"] = _hash(profile["representativeDocument"])
    profile["validation"] = validate_profile(profile)
    return profile

def representative_document(profile: dict[str, Any]) -> str:
    rows = [("프로그램명", profile["title"])]
    mapping = (("대상", "targetAgeGroups"), ("핵심 주제", "topics"), ("활동 형태", "activityTypes"), ("운영 형태", "operationTypes"))
    for label, key in mapping:
        values = [v for v in profile[key] if v != "UNKNOWN"]
        if values:
            rows.append((label, ", ".join(sorted(values))))
    rows.append(("회차 구성", str(profile["sessionCount"])))
    if profile["searchKeywords"]:
        rows.append(("검색어", ", ".join(profile["searchKeywords"])))
    return "\n".join(f"{label}: {value}" for label, value in rows)[:1200]

def validate_profile(profile: dict[str, Any]) -> dict[str, Any]:
    text = profile["representativeDocument"]
    privacy_hits = sum(bool(pattern.search(text)) for pattern in PRIVATE_PATTERNS)
    return {"valid": bool(profile["programCaseId"] and profile["title"] and text) and privacy_hits == 0, "privacyPatternHits": privacy_hits, "maxLengthExceeded": len(text) > 1200}
