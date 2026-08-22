from __future__ import annotations

from typing import Protocol

from .types import EmbeddingMetadata, SearchResult
from .vector_utils import validate_vector

CHUNK_TYPES = frozenset({"CORE", "SESSIONS", "ATTACHMENT"})


class SearchRepositoryProtocol(Protocol):
    def search(
        self, vector: list[float], metadata: EmbeddingMetadata, *,
        limit: int, threshold: float | None = None, chunk_type: str | None = None,
        target: str | None = None,
    ) -> list[SearchResult]: ...


class SearchRepository:
    def __init__(self, connection: object) -> None:
        self.connection = connection

    def search(
        self, vector: list[float], metadata: EmbeddingMetadata, *,
        limit: int, threshold: float | None = None, chunk_type: str | None = None,
        target: str | None = None,
    ) -> list[SearchResult]:
        checked = validate_vector(vector, metadata.dimension)
        if chunk_type is not None and chunk_type not in CHUNK_TYPES:
            raise ValueError("unsupported chunk type")
        try:
            from pgvector import Vector
        except ImportError:
            query_vector: object = checked
        else:
            query_vector = Vector(checked)

        # Keep optional enum filtering in one static query. The same bound value is
        # cast twice so PostgreSQL can type None for the IS NULL check.
        statement = """
WITH query_embedding AS (
  SELECT %s::vector(1024) AS value
)
SELECT
  (1 - (e."embedding" <=> q.value))::double precision AS similarity,
  p."id" AS "programCaseId",
  d."id" AS "programCaseDocumentId",
  c."id" AS "chunkId",
  c."chunkKey",
  c."chunkType"::text,
  c."chunkOrder",
  c."sourceLabel",
  p."title" AS "programTitle",
  p."targetAudience" AS "target",
  c."content"
FROM "ProgramCaseDocumentChunkEmbedding" e
JOIN "ProgramCaseDocumentChunk" c ON c."id" = e."programCaseDocumentChunkId"
JOIN "ProgramCaseDocument" d ON d."id" = c."programCaseDocumentId"
JOIN "ProgramCase" p ON p."id" = d."programCaseId"
CROSS JOIN query_embedding q
WHERE e."status" = 'COMPLETED'
  AND e."embedding" IS NOT NULL
  AND e."provider" = %s
  AND e."model" = %s
  AND e."modelRevision" = %s
  AND e."embeddingVersion" = %s
  AND e."dimension" = %s
  AND e."embeddedContentHash" = c."contentHash"
  AND (%s::double precision IS NULL
       OR (1 - (e."embedding" <=> q.value)) >= %s::double precision)
  AND (%s::"ProgramCaseDocumentChunkType" IS NULL
       OR c."chunkType" = %s::"ProgramCaseDocumentChunkType")
  AND (%s::text IS NULL
       OR POSITION(lower(%s::text) IN lower(p."targetAudience")) > 0)
ORDER BY e."embedding" <=> q.value ASC, c."id" ASC
LIMIT %s
"""
        params = (
            query_vector, metadata.provider, metadata.model, metadata.model_revision,
            metadata.embedding_version, metadata.dimension, threshold, threshold,
            chunk_type, chunk_type, target, target, limit,
        )
        with self.connection.cursor() as cursor:
            cursor.execute(statement, params)
            rows = cursor.fetchall()
        return [
            SearchResult(
                rank=index,
                similarity=row[0],
                program_case_id=row[1],
                program_case_document_id=row[2],
                chunk_id=row[3],
                chunk_key=row[4],
                chunk_type=row[5],
                chunk_order=row[6],
                source_label=row[7],
                program_title=row[8],
                target=row[9],
                content=row[10],
            )
            for index, row in enumerate(rows, start=1)
        ]
