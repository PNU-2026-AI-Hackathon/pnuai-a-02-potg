from __future__ import annotations

from collections import Counter
from typing import Any

AXES = ("topics", "targetAgeGroups", "activityTypes", "operationTypes")

def selection_tags(profile: dict[str, Any]) -> list[str]:
    tags = [f"{axis}:{value}" for axis in AXES for value in profile[axis]]
    tags.append(f"source:{profile['sourceDependency']}")
    tags.append("sessions:MULTI" if profile["sessionCount"] > 1 else "sessions:SINGLE")
    unknowns = sum("UNKNOWN" in profile[axis] for axis in AXES[:3])
    tags.append("rules:HARD" if unknowns else "rules:EASY")
    return sorted(tags)

def select_pilot(profiles: list[dict[str, Any]], size: int = 30) -> list[dict[str, Any]]:
    if len(profiles) < size:
        raise ValueError("not enough ProgramCase profiles for pilot")
    frequencies = Counter(tag for profile in profiles for tag in selection_tags(profile))
    selected: list[dict[str, Any]] = []
    covered: Counter[str] = Counter()
    remaining = list(profiles)
    while len(selected) < size:
        def score(profile: dict[str, Any]) -> tuple[float, str]:
            tags = selection_tags(profile)
            diversity = sum(1 / frequencies[tag] for tag in tags if covered[tag] == 0)
            balance = sum(1 / (1 + covered[tag]) for tag in tags)
            return (diversity * 100 + balance, profile["programCaseId"])
        chosen = max(remaining, key=score)
        remaining.remove(chosen)
        chosen = {**chosen, "selectionTags": selection_tags(chosen), "selectionReasonCode": "DETERMINISTIC_STRATIFIED_COVERAGE_V1"}
        selected.append(chosen)
        covered.update(chosen["selectionTags"])
    return sorted(selected, key=lambda item: item["programCaseId"])
