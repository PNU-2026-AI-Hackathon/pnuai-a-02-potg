import unittest
from datetime import datetime, timedelta, timezone

from program_case_semantic_search.config import (
    EMBEDDING_VERSION, MODEL_DIMENSION, MODEL_ID, MODEL_REVISION, PROVIDER,
)
from program_case_semantic_search.embedding_service import EmbeddingService
from program_case_semantic_search.selectors import EmbeddingSelector, SelectorKind
from program_case_semantic_search.errors import (
    ChunkNotFoundError, DatabaseOperationError, ModelInferenceError,
)
from program_case_semantic_search.types import ChunkCandidate, EmbeddingMetadata
from tests.fakes import FakeEmbeddingRepository, FakeProvider, ProviderFactory


META = EmbeddingMetadata(
    PROVIDER, MODEL_ID, MODEL_REVISION, EMBEDDING_VERSION, MODEL_DIMENSION
)


def chunk(identifier="one", **values):
    defaults = dict(id=identifier, content="한국어 프로그램 사례", content_hash="hash")
    defaults.update(values)
    return ChunkCandidate(**defaults)


class EmbeddingServiceTests(unittest.TestCase):
    def test_created(self):
        repository = FakeEmbeddingRepository([chunk()])
        provider = FakeProvider()
        factory = ProviderFactory(provider)
        result = EmbeddingService(repository, factory, META, batch_size=8).run(
            EmbeddingSelector(SelectorKind.ALL)
        )
        self.assertEqual(result.embeddings_created, 1)
        self.assertEqual(result.model_encode_calls, 1)
        self.assertEqual(repository.processing, ["one"])
        self.assertEqual(repository.finished_reads, 1)
        self.assertEqual(factory.calls, 1)

    def test_unchanged_does_not_call_or_write(self):
        current = chunk(
            status="COMPLETED", embedding_exists=True, provider=PROVIDER,
            model=MODEL_ID, model_revision=MODEL_REVISION,
            embedding_version=EMBEDDING_VERSION, dimension=1024,
            embedded_content_hash="hash",
        )
        repository = FakeEmbeddingRepository([current])
        provider = FakeProvider()
        factory = ProviderFactory(provider)
        result = EmbeddingService(repository, factory, META, batch_size=8).run(
            EmbeddingSelector(SelectorKind.ALL)
        )
        self.assertEqual(result.embeddings_unchanged, 1)
        self.assertEqual(provider.document_calls, 0)
        self.assertEqual(repository.saved_batches, [])
        self.assertEqual(repository.processing, [])
        self.assertEqual(factory.calls, 0)

    def test_stale_metadata_is_updated(self):
        current = chunk(status="COMPLETED", embedding_exists=True, provider="OLD")
        repository = FakeEmbeddingRepository([current])
        result = EmbeddingService(
            repository, ProviderFactory(FakeProvider()), META, batch_size=8
        ).run(EmbeddingSelector(SelectorKind.STALE))
        self.assertEqual(result.embeddings_updated, 1)
        self.assertEqual(repository.saved_batches[0][0], ["one"])

    def test_recent_processing_and_empty_are_skipped(self):
        recent = chunk(
            "processing", status="PROCESSING",
            last_attempted_at=datetime.now(timezone.utc) - timedelta(minutes=5),
        )
        repository = FakeEmbeddingRepository([recent, chunk("empty", content=" ")])
        factory = ProviderFactory(FakeProvider())
        result = EmbeddingService(
            repository, factory, META, batch_size=8
        ).run(EmbeddingSelector(SelectorKind.ALL))
        self.assertEqual(result.embeddings_skipped, 2)
        self.assertEqual(result.skipped_recent_processing, 1)
        self.assertEqual(result.skipped_empty, 1)
        self.assertEqual(factory.calls, 0)

    def test_old_processing_is_recovered(self):
        old = chunk(
            status="PROCESSING",
            last_attempted_at=datetime.now(timezone.utc) - timedelta(minutes=31),
        )
        repository = FakeEmbeddingRepository([old])
        result = EmbeddingService(
            repository, ProviderFactory(FakeProvider()), META, batch_size=8
        ).run(EmbeddingSelector(SelectorKind.ALL))
        self.assertEqual(result.embeddings_created, 1)

    def test_batch_failure_is_recorded(self):
        repository = FakeEmbeddingRepository([chunk()])
        result = EmbeddingService(
            repository, ProviderFactory(FakeProvider(fail=True)), META, batch_size=8
        ).run(EmbeddingSelector(SelectorKind.ALL))
        self.assertEqual(result.chunks_failed, 1)
        self.assertEqual(repository.failed[0][1], "MODEL_BATCH_FAILED")

    def test_dry_run_never_calls_model_or_writes(self):
        repository = FakeEmbeddingRepository([chunk()])
        provider = FakeProvider()
        factory = ProviderFactory(provider)
        result = EmbeddingService(
            repository, factory, META, batch_size=8
        ).run(EmbeddingSelector(SelectorKind.ALL), dry_run=True)
        self.assertEqual(provider.document_calls, 0)
        self.assertEqual(repository.processing, [])
        self.assertEqual(result.embeddings_skipped, 0)
        self.assertEqual(result.would_create, 1)
        self.assertEqual(result.total_candidates, 1)
        self.assertEqual(factory.calls, 0)

    def test_dry_run_separates_create_and_update(self):
        repository = FakeEmbeddingRepository([
            chunk("new"),
            chunk("stale", embedding_exists=True, status="COMPLETED", provider="OLD"),
        ])
        result = EmbeddingService(
            repository, ProviderFactory(FakeProvider()), META, batch_size=8
        ).run(EmbeddingSelector(SelectorKind.ALL), dry_run=True)
        self.assertEqual(result.would_create, 1)
        self.assertEqual(result.would_update, 1)
        self.assertEqual(result.total_candidates, 2)

    def test_every_metadata_change_updates(self):
        changes = {
            "provider": {"provider": "OLD"},
            "revision": {"model_revision": "old"},
            "version": {"embedding_version": "old"},
            "dimension": {"dimension": 3},
            "content_hash": {"embedded_content_hash": "old"},
            "null_vector": {"embedding_exists": False},
        }
        for name, changed in changes.items():
            values = dict(
                status="COMPLETED", embedding_exists=True, provider=PROVIDER,
                model=MODEL_ID, model_revision=MODEL_REVISION,
                embedding_version=EMBEDDING_VERSION, dimension=1024,
                embedded_content_hash="hash",
            )
            values.update(changed)
            repository = FakeEmbeddingRepository([chunk(**values)])
            result = EmbeddingService(
                repository, ProviderFactory(FakeProvider()), META, batch_size=8
            ).run(EmbeddingSelector(SelectorKind.STALE))
            with self.subTest(name=name):
                expected_created = 1 if name == "null_vector" else 0
                self.assertEqual(result.embeddings_created, expected_created)
                self.assertEqual(result.embeddings_updated, 1 - expected_created)

    def test_batch_save_failure_marks_whole_batch_failed(self):
        rows = [chunk(str(index)) for index in range(8)]
        repository = FakeEmbeddingRepository(
            rows, save_error=DatabaseOperationError("save failed")
        )
        result = EmbeddingService(
            repository, ProviderFactory(FakeProvider()), META, batch_size=8
        ).run(EmbeddingSelector(SelectorKind.ALL))
        self.assertEqual(repository.saved_batches, [])
        self.assertEqual(repository.failed[0][0], [str(index) for index in range(8)])
        self.assertEqual(result.chunks_failed, 8)
        self.assertEqual(result.embeddings_created, 0)

    def test_connection_lost_preserves_original_and_does_not_mark_failed(self):
        error = DatabaseOperationError("connection lost", connection_lost=True)
        repository = FakeEmbeddingRepository([chunk()], save_error=error)
        with self.assertRaises(DatabaseOperationError) as raised:
            EmbeddingService(
                repository, ProviderFactory(FakeProvider()), META, batch_size=8
            ).run(EmbeddingSelector(SelectorKind.ALL))
        self.assertIs(raised.exception, error)
        self.assertEqual(repository.failed, [])

    def test_provider_dimension_error(self):
        with self.assertRaises(ModelInferenceError):
            EmbeddingService(
                FakeEmbeddingRepository([chunk()]),
                ProviderFactory(FakeProvider(dimension=3)), META, batch_size=8
            ).run(EmbeddingSelector(SelectorKind.ALL))

    def test_missing_chunk_id_fails(self):
        with self.assertRaises(ChunkNotFoundError):
            EmbeddingService(
                FakeEmbeddingRepository([]), ProviderFactory(FakeProvider()),
                META, batch_size=8,
            ).run(EmbeddingSelector(SelectorKind.CHUNK_ID, "00000000-0000-0000-0000-000000000000"))

    def test_failed_selector_is_forwarded_and_reprocessed(self):
        repository = FakeEmbeddingRepository([chunk(status="FAILED")])
        result = EmbeddingService(
            repository, ProviderFactory(FakeProvider()), META, batch_size=8
        ).run(EmbeddingSelector(SelectorKind.FAILED))
        self.assertEqual(repository.selector.kind, SelectorKind.FAILED)
        self.assertEqual(result.embeddings_created, 1)


if __name__ == "__main__":
    unittest.main()
