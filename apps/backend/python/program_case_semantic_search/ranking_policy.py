from __future__ import annotations

from dataclasses import dataclass, replace
from enum import Enum

from .metadata_inference import (
    AgeGroup, InferredProgramMetadata, OperationType, ParticipationType,
    ProgramCaseSearchRequest, ProgramCategory, infer_program_metadata,
)
from .types import SearchResult


class ScoringPolicy(str, Enum):
    BASELINE = "baseline"
    METADATA = "metadata"
    WEIGHTED = "weighted"
    AGGREGATE = "aggregate"
    COMBINED = "combined"


@dataclass(frozen=True)
class RankingConfig:
    chunk_weights: dict[str, float]
    second_chunk_factor: float = 0.0
    age_bonus: float = 0.0
    category_bonus: float = 0.0
    participation_bonus: float = 0.0
    operation_bonus: float = 0.0
    hybrid_filter: bool = False


POLICIES = {
    ScoringPolicy.BASELINE: RankingConfig({"CORE": 1.0, "SESSIONS": 1.0, "ATTACHMENT": 1.0}),
    ScoringPolicy.METADATA: RankingConfig(
        {"CORE": 1.0, "SESSIONS": 1.0, "ATTACHMENT": 1.0},
        age_bonus=0.04, category_bonus=0.04, participation_bonus=0.03,
        operation_bonus=0.02,
    ),
    ScoringPolicy.WEIGHTED: RankingConfig(
        {"CORE": 1.0, "SESSIONS": 0.98, "ATTACHMENT": 0.95}
    ),
    ScoringPolicy.AGGREGATE: RankingConfig(
        {"CORE": 1.0, "SESSIONS": 1.0, "ATTACHMENT": 1.0}, second_chunk_factor=0.10
    ),
    ScoringPolicy.COMBINED: RankingConfig(
        {"CORE": 1.0, "SESSIONS": 0.98, "ATTACHMENT": 0.95},
        second_chunk_factor=0.10, age_bonus=0.04, category_bonus=0.04,
        participation_bonus=0.03, operation_bonus=0.02, hybrid_filter=True,
    ),
}


@dataclass(frozen=True)
class RankedProgram:
    representative: SearchResult
    raw_similarity: float
    final_score: float
    metadata: InferredProgramMetadata


def _requested_known(values: frozenset, unknown: Enum) -> frozenset:
    return frozenset(value for value in values if value is not unknown)


def _dimension_match(requested: frozenset, inferred: frozenset, unknown: Enum) -> bool | None:
    requested_known = _requested_known(requested, unknown)
    if not requested_known:
        return None
    inferred_known = _requested_known(inferred, unknown)
    if not inferred_known:
        return None
    return bool(requested_known & inferred_known)


def _metadata_bonus(request: ProgramCaseSearchRequest, inferred: InferredProgramMetadata,
                    config: RankingConfig) -> tuple[float, bool]:
    dimensions = (
        (request.age_groups, inferred.age_groups, AgeGroup.UNKNOWN, config.age_bonus),
        (request.categories, inferred.categories, ProgramCategory.UNKNOWN, config.category_bonus),
        (request.participation_types, inferred.participation_types,
         ParticipationType.UNKNOWN, config.participation_bonus),
        (request.operation_types, inferred.operation_types,
         OperationType.UNKNOWN, config.operation_bonus),
    )
    bonus = 0.0
    for requested, actual, unknown, amount in dimensions:
        matched = _dimension_match(requested, actual, unknown)
        if matched is False and config.hybrid_filter:
            return 0.0, False
        if matched is True:
            bonus += amount
    return bonus, True


def rank_programs(candidates: list[SearchResult], request: ProgramCaseSearchRequest,
                  policy: ScoringPolicy, *, limit: int | None = None) -> list[RankedProgram]:
    config = POLICIES[policy]
    grouped: dict[str, list[SearchResult]] = {}
    for candidate in candidates:
        grouped.setdefault(candidate.program_case_id, []).append(candidate)
    ranked: list[RankedProgram] = []
    type_priority = {"CORE": 0, "SESSIONS": 1, "ATTACHMENT": 2}
    for chunks in grouped.values():
        raw_order = sorted(chunks, key=lambda item: (
            -item.similarity, type_priority.get(item.chunk_type, 9), item.chunk_id
        ))
        representative = raw_order[0]
        inferred = infer_program_metadata(representative.program_title, representative.target)
        bonus, include = _metadata_bonus(request, inferred, config)
        if not include:
            continue
        adjusted = sorted(
            (chunk.similarity * config.chunk_weights.get(chunk.chunk_type, 1.0)
             for chunk in chunks), reverse=True,
        )
        score = adjusted[0]
        if len(adjusted) > 1:
            score += min(adjusted[1], adjusted[0]) * config.second_chunk_factor
        score += bonus
        ranked.append(RankedProgram(representative, representative.similarity, score, inferred))
    ranked.sort(key=lambda item: (
        -item.final_score, -item.raw_similarity,
        type_priority.get(item.representative.chunk_type, 9),
        item.representative.program_case_id, item.representative.chunk_id,
    ))
    selected = ranked[:limit if limit is not None else request.limit]
    return [replace(item, representative=replace(item.representative, rank=index))
            for index, item in enumerate(selected, 1)]
