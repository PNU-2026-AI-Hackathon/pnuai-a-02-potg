from __future__ import annotations

import time
from dataclasses import dataclass

from .config import DEFAULT_SEARCH_LIMIT, MAX_QUERY_CHARACTERS, MAX_SEARCH_LIMIT
from .search_repository import CHUNK_TYPES, SearchRepositoryProtocol
from .types import EmbeddingMetadata, EmbeddingProvider, SearchResult
from .vector_utils import validate_vector


@dataclass(frozen=True)
class SearchResponse:
    results: list[SearchResult]
    elapsed_seconds: float


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
        chunk_type: str | None = None
    ) -> SearchResponse:
        normalized = query.strip()
        if not normalized:
            raise ValueError("query must not be empty")
        if len(normalized) > MAX_QUERY_CHARACTERS:
            raise ValueError(f"query must be at most {MAX_QUERY_CHARACTERS} characters")
        if not 1 <= limit <= MAX_SEARCH_LIMIT:
            raise ValueError(f"limit must be between 1 and {MAX_SEARCH_LIMIT}")
        if chunk_type is not None and chunk_type not in CHUNK_TYPES:
            raise ValueError("chunk type must be CORE, SESSIONS, or ATTACHMENT")
        started = time.monotonic()
        vector = validate_vector(self.provider.encode_query(normalized), self.metadata.dimension)
        results = self.repository.search(
            vector, self.metadata, limit=limit, chunk_type=chunk_type
        )
        return SearchResponse(results=results, elapsed_seconds=time.monotonic() - started)
