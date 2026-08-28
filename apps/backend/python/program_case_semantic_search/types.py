from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol, Sequence


@dataclass(frozen=True)
class EmbeddingMetadata:
    provider: str
    model: str
    model_revision: str
    embedding_version: str
    dimension: int


@dataclass
class ChunkCandidate:
    id: str
    content: str
    content_hash: str
    status: str | None = None
    embedding_exists: bool = False
    provider: str | None = None
    model: str | None = None
    model_revision: str | None = None
    embedding_version: str | None = None
    dimension: int | None = None
    embedded_content_hash: str | None = None
    last_attempted_at: datetime | None = None


@dataclass(frozen=True)
class EmbeddingBatchResult:
    vectors: list[list[float]]
    max_input_tokens: int = 0


@dataclass
class EmbeddingRunSummary:
    chunks_processed: int = 0
    chunks_succeeded: int = 0
    chunks_failed: int = 0
    embeddings_created: int = 0
    embeddings_updated: int = 0
    embeddings_unchanged: int = 0
    embeddings_skipped: int = 0
    batches_processed: int = 0
    model_encode_calls: int = 0
    total_candidates: int = 0
    would_create: int = 0
    would_update: int = 0
    skipped_recent_processing: int = 0
    skipped_empty: int = 0
    max_input_tokens: int = 0
    elapsed_seconds: float = 0.0
    failures: list[dict[str, str]] = field(default_factory=list)


@dataclass(frozen=True)
class SearchResult:
    rank: int
    similarity: float
    program_case_id: str
    program_case_document_id: str
    chunk_id: str
    chunk_key: str
    chunk_type: str
    chunk_order: int
    source_label: str | None
    program_title: str
    target: str
    content: str


class EmbeddingProvider(Protocol):
    @property
    def dimension(self) -> int: ...

    def encode_documents(self, texts: Sequence[str]) -> EmbeddingBatchResult: ...

    def encode_query(self, query: str) -> list[float]: ...
