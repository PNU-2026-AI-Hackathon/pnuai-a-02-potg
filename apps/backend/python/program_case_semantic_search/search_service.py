from __future__ import annotations

import time
from dataclasses import dataclass, replace

from .config import DEFAULT_SEARCH_LIMIT, MAX_QUERY_CHARACTERS, MAX_SEARCH_LIMIT
from .search_repository import CHUNK_TYPES, SearchRepositoryProtocol
from .types import EmbeddingMetadata, EmbeddingProvider, SearchResult
from .vector_utils import validate_vector

SEARCH_CANDIDATE_MULTIPLIER = 5
MIN_SEARCH_CANDIDATES = 20
CHUNK_TYPE_PRIORITY = {"CORE": 0, "SESSIONS": 1, "ATTACHMENT": 2}


@dataclass(frozen=True)
class SearchResponse:
    results: list[SearchResult]
    elapsed_seconds: float
    raw_chunk_candidates: int = 0
    unique_programs: int = 0
    duplicates_removed: int = 0
    candidate_limit: int = 0
    target_filter: str | None = None
    chunk_type_filter: str | None = None


class SearchService:
    def __init__(
        self, repository: SearchRepositoryProtocol,
        provider: EmbeddingProvider,
        metadata: EmbeddingMetadata,
    ) -> None:
        self.repository = repository
        self.provider = provider
        self.metadata = metadata

    def search(
        self, query: str, *, limit: int = DEFAULT_SEARCH_LIMIT,
        threshold: float | None = None, chunk_type: str | None = None,
        target: str | None = None,
    ) -> SearchResponse:
        normalized = query.strip()
        if not normalized:
            raise ValueError("query must not be empty")
        if len(normalized) > MAX_QUERY_CHARACTERS:
            raise ValueError(f"query must be at most {MAX_QUERY_CHARACTERS} characters")
        if not 1 <= limit <= MAX_SEARCH_LIMIT:
            raise ValueError(f"limit must be between 1 and {MAX_SEARCH_LIMIT}")
        if threshold is not None and not -1.0 <= threshold <= 1.0:
            raise ValueError("threshold must be between -1 and 1")
        if chunk_type is not None and chunk_type not in CHUNK_TYPES:
            raise ValueError("chunk type must be CORE, SESSIONS, or ATTACHMENT")
        normalized_target = target.strip() if target is not None else None
        if target is not None and not normalized_target:
            raise ValueError("target filter must not be empty")
        started = time.monotonic()
        vector = validate_vector(self.provider.encode_query(normalized), self.metadata.dimension)
        candidate_limit = max(limit * SEARCH_CANDIDATE_MULTIPLIER, MIN_SEARCH_CANDIDATES)
        candidates = self.repository.search(
            vector, self.metadata, limit=candidate_limit, threshold=threshold,
            chunk_type=chunk_type, target=normalized_target,
        )
        ordered = sorted(
            candidates,
            key=lambda item: (
                -item.similarity,
                CHUNK_TYPE_PRIORITY.get(item.chunk_type, len(CHUNK_TYPE_PRIORITY)),
                item.chunk_id,
            ),
        )
        representatives: list[SearchResult] = []
        seen: set[str] = set()
        for candidate in ordered:
            if candidate.program_case_id in seen:
                continue
            seen.add(candidate.program_case_id)
            if len(representatives) < limit:
                representatives.append(candidate)
        results = [replace(item, rank=index) for index, item in enumerate(representatives, 1)]
        unique_programs = len({item.program_case_id for item in candidates})
        return SearchResponse(
            results=results,
            elapsed_seconds=time.monotonic() - started,
            raw_chunk_candidates=len(candidates),
            unique_programs=unique_programs,
            duplicates_removed=len(candidates) - unique_programs,
            candidate_limit=candidate_limit,
            target_filter=normalized_target,
            chunk_type_filter=chunk_type,
        )
