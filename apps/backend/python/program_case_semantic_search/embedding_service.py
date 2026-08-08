from __future__ import annotations

import re
import time
from collections.abc import Callable
from datetime import datetime, timedelta, timezone

from .config import PROCESSING_RECOVERY_MINUTES
from .embedding_repository import EmbeddingRepositoryProtocol
from .errors import (
    ChunkNotFoundError,
    DatabaseOperationError,
    ModelInferenceError,
)
from .selectors import EmbeddingSelector, SelectorKind
from .types import (
    ChunkCandidate,
    EmbeddingMetadata,
    EmbeddingProvider,
    EmbeddingRunSummary,
)
from .vector_utils import validate_vector

_SENSITIVE = re.compile(
    r"(postgres(?:ql)?://\S+|[A-Za-z]:\\Users\\[^\\\s]+|/Users/[^/\s]+)",
    re.IGNORECASE,
)


def sanitize_failure(error: Exception) -> str:
    value = _SENSITIVE.sub("[REDACTED]", str(error)).replace("\r", " ").replace("\n", " ")
    return value[:500] or error.__class__.__name__


def is_unchanged(chunk: ChunkCandidate, metadata: EmbeddingMetadata) -> bool:
    return (
        chunk.embedding_exists
        and chunk.status == "COMPLETED"
        and chunk.provider == metadata.provider
        and chunk.model == metadata.model
        and chunk.model_revision == metadata.model_revision
        and chunk.embedding_version == metadata.embedding_version
        and chunk.dimension == metadata.dimension
        and chunk.embedded_content_hash == chunk.content_hash
    )


def is_recent_processing(chunk: ChunkCandidate, now: datetime) -> bool:
    if chunk.status != "PROCESSING" or chunk.last_attempted_at is None:
        return False
    attempted = chunk.last_attempted_at
    if attempted.tzinfo is None:
        attempted = attempted.replace(tzinfo=timezone.utc)
    return attempted >= now - timedelta(minutes=PROCESSING_RECOVERY_MINUTES)


class EmbeddingService:
    def __init__(
        self,
        repository: EmbeddingRepositoryProtocol,
        provider_factory: Callable[[], EmbeddingProvider],
        metadata: EmbeddingMetadata,
        *,
        batch_size: int,
    ) -> None:
        self.repository = repository
        self.provider_factory = provider_factory
        self.metadata = metadata
        self.batch_size = batch_size

    def run(self, selector: EmbeddingSelector, *, dry_run: bool = False) -> EmbeddingRunSummary:
        started = time.monotonic()
        summary = EmbeddingRunSummary()
        candidates = self.repository.list_candidates(selector)
        summary.total_candidates = len(candidates)
        if selector.kind is SelectorKind.CHUNK_ID and not candidates:
            raise ChunkNotFoundError("No program case document chunk matched the UUID")
        pending: list[ChunkCandidate] = []
        now = datetime.now(timezone.utc)
        for chunk in candidates:
            summary.chunks_processed += 1
            if not chunk.content.strip():
                summary.embeddings_skipped += 1
                summary.skipped_empty += 1
            elif is_recent_processing(chunk, now):
                summary.embeddings_skipped += 1
                summary.skipped_recent_processing += 1
            elif is_unchanged(chunk, self.metadata):
                summary.embeddings_unchanged += 1
                summary.chunks_succeeded += 1
            else:
                pending.append(chunk)
                if chunk.embedding_exists:
                    summary.would_update += 1
                else:
                    summary.would_create += 1
        if dry_run:
            summary.elapsed_seconds = time.monotonic() - started
            return summary
        if not pending:
            summary.elapsed_seconds = time.monotonic() - started
            return summary

        self.repository.finish_candidate_read()
        provider = self.provider_factory()
        if provider.dimension != self.metadata.dimension:
            raise ModelInferenceError(
                f"provider dimension must be {self.metadata.dimension}"
            )
        for offset in range(0, len(pending), self.batch_size):
            batch = pending[offset:offset + self.batch_size]
            summary.batches_processed += 1
            self.repository.mark_processing(batch, self.metadata)
            try:
                summary.model_encode_calls += 1
                result = provider.encode_documents([chunk.content for chunk in batch])
                if len(result.vectors) != len(batch):
                    raise ModelInferenceError("model returned a different number of embeddings")
                vectors = [validate_vector(value, self.metadata.dimension) for value in result.vectors]
                summary.max_input_tokens = max(
                    summary.max_input_tokens, result.max_input_tokens
                )
            except Exception as error:
                if isinstance(error, MemoryError):
                    error = ModelInferenceError("KURE-v1 inference ran out of memory")
                message = sanitize_failure(error)
                self.repository.save_batch_failure(
                    batch, "MODEL_BATCH_FAILED", message, self.metadata
                )
                summary.chunks_failed += len(batch)
                summary.failures.extend(
                    {"chunkId": chunk.id, "code": "MODEL_BATCH_FAILED"} for chunk in batch
                )
                continue

            try:
                self.repository.save_batch_success(batch, vectors, self.metadata)
            except DatabaseOperationError as error:
                if error.connection_lost:
                    raise
                try:
                    self.repository.save_batch_failure(
                        batch, "DATABASE_SAVE_FAILED", sanitize_failure(error), self.metadata
                    )
                except DatabaseOperationError:
                    raise error
                summary.chunks_failed += len(batch)
                summary.failures.extend(
                    {"chunkId": chunk.id, "code": "DATABASE_SAVE_FAILED"} for chunk in batch
                )
                continue
            summary.chunks_succeeded += len(batch)
            summary.embeddings_created += sum(not chunk.embedding_exists for chunk in batch)
            summary.embeddings_updated += sum(chunk.embedding_exists for chunk in batch)
        summary.elapsed_seconds = time.monotonic() - started
        return summary
