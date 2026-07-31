import unittest

from program_case_semantic_search.config import (
    EMBEDDING_VERSION, MODEL_DIMENSION, MODEL_ID, MODEL_REVISION, PROVIDER,
)
from program_case_semantic_search.search_service import SearchService
from program_case_semantic_search.types import EmbeddingMetadata
from tests.fakes import FakeProvider, FakeSearchRepository


META = EmbeddingMetadata(
    PROVIDER, MODEL_ID, MODEL_REVISION, EMBEDDING_VERSION, MODEL_DIMENSION
)


class SearchServiceTests(unittest.TestCase):
    def test_korean_query_and_filters(self):
        repository = FakeSearchRepository()
        provider = FakeProvider()
        SearchService(repository, provider, META).search(
            "아동 미술 교육", limit=10, threshold=0.4, chunk_type="CORE"
        )
        self.assertEqual(provider.query_calls, 1)
        self.assertEqual(repository.calls[0][2:], (10, 0.4, "CORE"))

    def test_input_validation(self):
        service = SearchService(FakeSearchRepository(), FakeProvider(), META)
        for query in ("", " "):
            with self.assertRaises(ValueError):
                service.search(query)
        with self.assertRaises(ValueError):
            service.search("가" * 1001)
        for limit in (0, 21):
            with self.assertRaises(ValueError):
                service.search("검색", limit=limit)
        with self.assertRaises(ValueError):
            service.search("검색", chunk_type="INVALID")
        for threshold in (-1.01, 1.01):
            with self.assertRaises(ValueError):
                service.search("검색", threshold=threshold)


if __name__ == "__main__":
    unittest.main()
