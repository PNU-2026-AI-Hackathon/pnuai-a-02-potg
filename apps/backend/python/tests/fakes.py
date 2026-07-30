from program_case_semantic_search.types import EmbeddingBatchResult
from program_case_semantic_search.vector_utils import make_test_vector
from program_case_semantic_search.errors import DatabaseOperationError


class FakeProvider:
    def __init__(self, *, fail: bool = False, dimension: int = 1024) -> None:
        self.fail = fail
        self.dimension = dimension
        self.document_calls = 0
        self.query_calls = 0

    def encode_documents(self, texts):
        self.document_calls += 1
        if self.fail:
            raise RuntimeError("fake inference failed")
        return EmbeddingBatchResult(
            vectors=[make_test_vector(index + 1) for index, _ in enumerate(texts)]
        )

    def encode_query(self, query):
        self.query_calls += 1
        return make_test_vector(len(query))


class FakeEmbeddingRepository:
    def __init__(self, chunks, *, save_error=None):
        self.chunks = chunks
        self.save_error = save_error
        self.processing = []
        self.saved_batches = []
        self.failed = []
        self.finished_reads = 0
        self.selector = None

    def list_candidates(self, selector):
        self.selector = selector
        return list(self.chunks)

    def finish_candidate_read(self):
        self.finished_reads += 1

    def mark_processing(self, chunks, metadata):
        self.processing.extend(chunk.id for chunk in chunks)

    def save_batch_success(self, chunks, vectors, metadata):
        if self.save_error:
            raise self.save_error
        self.saved_batches.append(([chunk.id for chunk in chunks], vectors))

    def save_batch_failure(self, chunks, code, message, metadata):
        self.failed.append(([chunk.id for chunk in chunks], code, message))


class ProviderFactory:
    def __init__(self, provider):
        self.provider = provider
        self.calls = 0

    def __call__(self):
        self.calls += 1
        return self.provider


class FakeSearchRepository:
    def __init__(self, results=None):
        self.results = results or []
        self.calls = []

    def search(self, vector, metadata, *, limit, chunk_type=None):
        self.calls.append((vector, metadata, limit, chunk_type))
        return self.results
