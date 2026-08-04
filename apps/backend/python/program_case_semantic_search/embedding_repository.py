from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol, Sequence

from .errors import DatabaseOperationError
from .selectors import EmbeddingSelector, SelectorKind
from .types import ChunkCandidate, EmbeddingMetadata
from .vector_utils import validate_vector


class EmbeddingRepositoryProtocol(Protocol):
    def list_candidates(self, selector: EmbeddingSelector) -> list[ChunkCandidate]: ...
    def finish_candidate_read(self) -> None: ...
    def mark_processing(self, chunks: Sequence[ChunkCandidate], metadata: EmbeddingMetadata) -> None: ...
    def save_batch_success(
        self, chunks: Sequence[ChunkCandidate], vectors: Sequence[list[float]],
        metadata: EmbeddingMetadata
    ) -> None: ...
    def save_batch_failure(
        self, chunks: Sequence[ChunkCandidate], code: str, message: str,
        metadata: EmbeddingMetadata
    ) -> None: ...


_CANDIDATE_SELECT = """
SELECT
  c."id", c."content", c."contentHash",
  e."status"::text, (e."embedding" IS NOT NULL) AS "embeddingExists",
  e."provider", e."model", e."modelRevision", e."embeddingVersion",
  e."dimension", e."embeddedContentHash", e."lastAttemptedAt"
FROM "ProgramCaseDocumentChunk" c
LEFT JOIN "ProgramCaseDocumentChunkEmbedding" e
  ON e."programCaseDocumentChunkId" = c."id"
"""


class EmbeddingRepository:
    def __init__(self, connection: object) -> None:
        self.connection = connection

    @staticmethod
    def _row(row: tuple) -> ChunkCandidate:
        return ChunkCandidate(
            id=row[0], content=row[1], content_hash=row[2], status=row[3],
            embedding_exists=bool(row[4]), provider=row[5], model=row[6],
            model_revision=row[7], embedding_version=row[8], dimension=row[9],
            embedded_content_hash=row[10], last_attempted_at=row[11],
        )

    def list_candidates(self, selector: EmbeddingSelector) -> list[ChunkCandidate]:
        if selector.kind is SelectorKind.CHUNK_ID:
            query = _CANDIDATE_SELECT + ' WHERE c."id" = %s ORDER BY c."id"'
            params = (selector.chunk_id,)
        elif selector.kind is SelectorKind.FAILED:
            query = _CANDIDATE_SELECT + """
 WHERE e."status" = 'FAILED'
 ORDER BY c."id"
"""
            params = ()
        elif selector.kind is SelectorKind.STALE:
            # Metadata staleness is evaluated by the service against its pinned
            # configuration, so all rows must be visible to this selector.
            query = _CANDIDATE_SELECT + ' ORDER BY c."id"'
            params = ()
        else:
            # ALL must expose recent PROCESSING rows so the service and dry-run
            # can classify them explicitly instead of silently omitting them.
            query = _CANDIDATE_SELECT + ' ORDER BY c."id"'
            params = ()
        with self.connection.cursor() as cursor:
            cursor.execute(query, params)
            return [self._row(row) for row in cursor.fetchall()]

    def finish_candidate_read(self) -> None:
        """End the candidate-read transaction before model loading/inference."""
        self.connection.commit()

    def _operation_error(self, message: str, error: Exception) -> DatabaseOperationError:
        connection_lost = bool(getattr(self.connection, "closed", False))
        try:
            self.connection.rollback()
        except Exception:
            connection_lost = True
        return DatabaseOperationError(message, connection_lost=connection_lost)

    def mark_processing(
        self, chunks: Sequence[ChunkCandidate], metadata: EmbeddingMetadata
    ) -> None:
        now = datetime.now(timezone.utc)
        statement = """
INSERT INTO "ProgramCaseDocumentChunkEmbedding" (
  "id", "programCaseDocumentChunkId", "provider", "model", "modelRevision",
  "embeddingVersion", "dimension", "status", "attemptCount",
  "lastAttemptedAt", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid()::text, %s, %s, %s, %s, %s, %s, 'PROCESSING', 1, %s, %s, %s
)
ON CONFLICT ("programCaseDocumentChunkId") DO UPDATE SET
  "provider" = EXCLUDED."provider",
  "model" = EXCLUDED."model",
  "modelRevision" = EXCLUDED."modelRevision",
  "embeddingVersion" = EXCLUDED."embeddingVersion",
  "dimension" = EXCLUDED."dimension",
  "status" = 'PROCESSING',
  "attemptCount" = "ProgramCaseDocumentChunkEmbedding"."attemptCount" + 1,
  "lastAttemptedAt" = EXCLUDED."lastAttemptedAt",
  "updatedAt" = EXCLUDED."updatedAt"
"""
        try:
            with self.connection.cursor() as cursor:
                for chunk in chunks:
                    cursor.execute(statement, (
                        chunk.id, metadata.provider, metadata.model,
                        metadata.model_revision, metadata.embedding_version,
                        metadata.dimension, now, now, now,
                    ))
            self.connection.commit()
        except Exception as exc:
            raise self._operation_error("Could not mark embedding batch as processing", exc) from exc

    def save_batch_success(
        self, chunks: Sequence[ChunkCandidate], vectors: Sequence[list[float]],
        metadata: EmbeddingMetadata
    ) -> None:
        if len(chunks) != len(vectors):
            raise ValueError("chunk and vector counts must match")
        now = datetime.now(timezone.utc)
        statement = """
UPDATE "ProgramCaseDocumentChunkEmbedding"
SET "embedding" = %s::vector(1024),
    "provider" = %s, "model" = %s, "modelRevision" = %s,
    "embeddingVersion" = %s, "dimension" = %s,
    "embeddedContentHash" = %s, "status" = 'COMPLETED',
    "failureCode" = NULL, "failureMessage" = NULL,
    "embeddedAt" = %s, "updatedAt" = %s
WHERE "programCaseDocumentChunkId" = %s
"""
        try:
            with self.connection.cursor() as cursor:
                for chunk, vector in zip(chunks, vectors):
                    checked = validate_vector(vector, metadata.dimension)
                    try:
                        from pgvector import Vector
                    except ImportError:
                        vector_value: object = checked
                    else:
                        vector_value = Vector(checked)
                    cursor.execute(statement, (
                        vector_value, metadata.provider, metadata.model,
                        metadata.model_revision, metadata.embedding_version,
                        metadata.dimension, chunk.content_hash, now, now, chunk.id,
                    ))
                    if cursor.rowcount != 1:
                        raise RuntimeError("embedding row disappeared during batch save")
            self.connection.commit()
        except Exception as exc:
            raise self._operation_error("Could not save embedding batch", exc) from exc

    def save_batch_failure(
        self, chunks: Sequence[ChunkCandidate], code: str, message: str,
        metadata: EmbeddingMetadata
    ) -> None:
        del metadata
        now = datetime.now(timezone.utc)
        statement = """
UPDATE "ProgramCaseDocumentChunkEmbedding"
SET "status" = 'FAILED', "failureCode" = %s, "failureMessage" = %s,
    "updatedAt" = %s
WHERE "programCaseDocumentChunkId" = %s
"""
        try:
            with self.connection.cursor() as cursor:
                for chunk in chunks:
                    cursor.execute(statement, (code[:100], message[:500], now, chunk.id))
                    if cursor.rowcount != 1:
                        raise RuntimeError("embedding row disappeared during failure save")
            self.connection.commit()
        except Exception as exc:
            raise self._operation_error("Could not save embedding batch failure", exc) from exc

    def status_counts(self) -> dict[str, int]:
        with self.connection.cursor() as cursor:
            cursor.execute("""
SELECT "status"::text, COUNT(*)::int
FROM "ProgramCaseDocumentChunkEmbedding"
GROUP BY "status"
ORDER BY "status"
""")
            return dict(cursor.fetchall())
