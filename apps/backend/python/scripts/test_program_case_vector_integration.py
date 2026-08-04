from __future__ import annotations

import uuid
from datetime import datetime, timezone

from program_case_semantic_search.cli import metadata
from program_case_semantic_search.database import connect
from program_case_semantic_search.search_repository import SearchRepository
from program_case_semantic_search.test_database import test_database_url_from_environment
from program_case_semantic_search.vector_utils import make_test_vector


EXPECTED_TEST_DATABASE = "moira_pgvector_integration_test"


def assert_test_database(connection: object) -> None:
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_database()")
        if cursor.fetchone()[0] != EXPECTED_TEST_DATABASE:
            raise RuntimeError("Integration test database guard failed.")


def main() -> None:
    test_database_url = test_database_url_from_environment()
    suffix = uuid.uuid4().hex
    program_id = str(uuid.uuid4())
    document_id = str(uuid.uuid4())
    first_chunk = str(uuid.uuid4())
    second_chunk = str(uuid.uuid4())
    mismatched_chunk = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    current = metadata()
    test_error: Exception | None = None
    cleanup_errors: list[Exception] = []
    try:
        with connect(test_database_url) as connection:
            assert_test_database(connection)
            with connection.cursor() as cursor:
                cursor.execute("SELECT extversion FROM pg_extension WHERE extname = %s", ("vector",))
                if cursor.fetchone() is None:
                    raise RuntimeError("pgvector extension is not installed")
                cursor.execute(
                    'SELECT to_regclass(%s)',
                    ('"ProgramCaseDocumentChunkEmbedding"',),
                )
                if cursor.fetchone()[0] is None:
                    raise RuntimeError("embedding migration is not applied")
                cursor.execute("""
INSERT INTO "ProgramCase" (
  "id", "sourceType", "sourcePostId", "sourceUrl", "title", "targetAudience",
  "instructor", "capacity", "currentApplicants", "applicationStatus",
  "educationStartDate", "educationEndDate", "educationStartDateText",
  "educationEndDateText", "notices", "rawText", "hasUnparsedAttachments",
  "crawledAt", "requestSucceeded", "parseWarnings", "createdAt", "updatedAt"
) VALUES (
  %s, 'VECTOR_TEST', %s, 'https://example.invalid/test', %s, '통합 테스트',
  '테스트', 1, 0, 'TEST', %s, %s, 'test', 'test', '', '', false,
  %s, true, '[]'::jsonb, %s, %s
)
""", (program_id, suffix, "VECTOR_TEST_" + suffix, now, now, now, now, now))
                cursor.execute("""
INSERT INTO "ProgramCaseDocument" (
  "id", "programCaseId", "documentType", "content", "contentHash",
  "version", "createdAt", "updatedAt"
) VALUES (%s, %s, 'SEARCH', 'fixture', %s, 'test', %s, %s)
""", (document_id, program_id, suffix, now, now))
                fixtures = (
                    (first_chunk, "CORE", current.model_revision, 1),
                    (second_chunk, "SESSIONS", current.model_revision, 2),
                    (mismatched_chunk, "ATTACHMENT", current.model_revision + "-mismatch", 3),
                )
                for order, (chunk_id, chunk_type, model_revision, vector_seed) in enumerate(fixtures):
                    content_hash = suffix + str(order)
                    cursor.execute("""
INSERT INTO "ProgramCaseDocumentChunk" (
  "id", "programCaseDocumentId", "chunkKey", "chunkOrder", "chunkType",
  "content", "contentHash", "builderVersion", "characterCount", "createdAt", "updatedAt"
) VALUES (%s, %s, %s, %s, %s, %s, %s, 'test', 7, %s, %s)
""", (
                        chunk_id, document_id, "fixture-" + str(order), order,
                        chunk_type, "fixture", content_hash, now, now,
                    ))
                    vector = make_test_vector(vector_seed)
                    cursor.execute("""
INSERT INTO "ProgramCaseDocumentChunkEmbedding" (
  "id", "programCaseDocumentChunkId", "embedding", "provider", "model",
  "modelRevision", "embeddingVersion", "dimension", "embeddedContentHash",
  "status", "attemptCount", "lastAttemptedAt", "embeddedAt", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid()::text, %s, %s::vector(1024), %s, %s, %s, %s, 1024,
  %s, 'COMPLETED', 1, %s, %s, %s, %s
)
""", (
                        chunk_id, vector, current.provider, current.model,
                        model_revision, current.embedding_version,
                        content_hash, now, now, now, now,
                    ))
            connection.commit()
            results = SearchRepository(connection).search(
                make_test_vector(1), current, limit=2
            )
            if not results:
                raise AssertionError("similarity search returned no results")
            if len(results) > 2:
                raise AssertionError("similarity search exceeded the requested limit")
            if any(result.chunk_id == mismatched_chunk for result in results):
                raise AssertionError("metadata mismatch embedding was not excluded")
            fixture_results = [result for result in results if result.program_case_id == program_id]
            if not fixture_results or fixture_results[0].chunk_id != first_chunk:
                raise AssertionError("cosine ordering or relation mapping failed")
            if fixture_results[0].program_case_document_id != document_id:
                raise AssertionError("document relation mapping failed")
            core_results = SearchRepository(connection).search(
                make_test_vector(1), current, limit=2, chunk_type="CORE"
            )
            if not core_results or core_results[0].chunk_id != first_chunk:
                raise AssertionError("chunk type filter did not return the expected chunk")
            if any(result.chunk_type != "CORE" for result in core_results):
                raise AssertionError("chunk type filter returned an unexpected type")
            with connection.cursor() as cursor:
                cursor.execute(
                    'UPDATE "ProgramCaseDocumentChunk" SET "contentHash" = %s WHERE "id" = %s',
                    ("stale", first_chunk),
                )
            connection.commit()
            stale_results = SearchRepository(connection).search(
                make_test_vector(1), current, limit=20
            )
            if any(result.chunk_id == first_chunk for result in stale_results):
                raise AssertionError("stale embedding was not excluded")
            if any(result.chunk_id == mismatched_chunk for result in stale_results):
                raise AssertionError("metadata mismatch embedding was not excluded")
            if not any(result.chunk_id == second_chunk for result in stale_results):
                raise AssertionError("expected valid embedding was not returned")
    except Exception as exc:
        test_error = exc
    finally:
        try:
            with connect(test_database_url) as cleanup_connection:
                assert_test_database(cleanup_connection)
                with cleanup_connection.cursor() as cursor:
                    cursor.execute(
                        'DELETE FROM "ProgramCase" WHERE "id" = %s', (program_id,)
                    )
        except Exception as exc:
            cleanup_errors.append(exc)
        try:
            with connect(test_database_url, read_only=True) as verification_connection:
                assert_test_database(verification_connection)
                with verification_connection.cursor() as cursor:
                    cursor.execute("""
SELECT
  (SELECT COUNT(*) FROM "ProgramCase" WHERE "id" = %s)::int,
  (SELECT COUNT(*) FROM "ProgramCaseSession" WHERE "programCaseId" = %s)::int,
  (SELECT COUNT(*) FROM "ProgramCaseAttachment" WHERE "programCaseId" = %s)::int,
  (SELECT COUNT(*) FROM "ProgramCaseDocument" WHERE "id" = %s)::int,
  (SELECT COUNT(*) FROM "ProgramCaseDocumentChunk"
   WHERE "id" IN (%s, %s, %s))::int,
  (SELECT COUNT(*) FROM "ProgramCaseDocumentChunkEmbedding"
   WHERE "programCaseDocumentChunkId" IN (%s, %s, %s))::int
""", (
                        program_id, program_id, program_id, document_id,
                        first_chunk, second_chunk, mismatched_chunk,
                        first_chunk, second_chunk, mismatched_chunk,
                    ))
                    if any(cursor.fetchone()):
                        raise AssertionError("embedding cascade deletion failed: synthetic fixture cleanup was incomplete")
        except Exception as exc:
            cleanup_errors.append(exc)

    if test_error is not None and cleanup_errors:
        raise ExceptionGroup(
            "Integration test and cleanup both failed.",
            [test_error, *cleanup_errors],
        )
    if test_error is not None:
        raise test_error
    if cleanup_errors:
        raise ExceptionGroup("Integration test cleanup failed.", cleanup_errors)
    print("program case vector integration test passed")


if __name__ == "__main__":
    main()
