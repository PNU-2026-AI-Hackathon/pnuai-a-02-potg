import unittest

from program_case_semantic_search.config import (
    EMBEDDING_VERSION, MODEL_DIMENSION, MODEL_ID, MODEL_REVISION, PROVIDER,
)
from program_case_semantic_search.search_service import SearchService
from program_case_semantic_search.types import EmbeddingMetadata, SearchResult
from tests.fakes import FakeProvider, FakeSearchRepository


META = EmbeddingMetadata(
    PROVIDER, MODEL_ID, MODEL_REVISION, EMBEDDING_VERSION, MODEL_DIMENSION
)


class SearchServiceTests(unittest.TestCase):
    @staticmethod
    def result(program: str, chunk: str, similarity: float, chunk_type: str = "CORE"):
        return SearchResult(
            rank=0, similarity=similarity, program_case_id=program,
            program_case_document_id=f"doc-{program}", chunk_id=chunk,
            chunk_key=chunk, chunk_type=chunk_type, chunk_order=0,
            source_label=None, program_title=program, target="target", content="content",
        )

    def test_korean_query_and_filters(self):
        repository = FakeSearchRepository()
        provider = FakeProvider()
        SearchService(repository, provider, META).search(
            "아동 미술 교육", limit=10, threshold=0.4, chunk_type="CORE"
        )
        self.assertEqual(provider.query_calls, 1)
        self.assertEqual(repository.calls[0][2:], (50, 0.4, "CORE", None))

    def test_dedupe_keeps_distinct_programs_and_highest_similarity(self):
        repository = FakeSearchRepository([
            self.result("a", "a-core", 0.7),
            self.result("a", "a-attachment", 0.8, "ATTACHMENT"),
            self.result("b", "b-core", 0.6),
        ])
        response = SearchService(repository, FakeProvider(), META).search("검색", limit=5)
        self.assertEqual([item.program_case_id for item in response.results], ["a", "b"])
        self.assertEqual(response.results[0].chunk_id, "a-attachment")
        self.assertEqual([item.rank for item in response.results], [1, 2])
        self.assertEqual(response.raw_chunk_candidates, 3)
        self.assertEqual(response.unique_programs, 2)
        self.assertEqual(response.duplicates_removed, 1)

    def test_dedupe_ties_use_type_then_chunk_id(self):
        repository = FakeSearchRepository([
            self.result("a", "z-attachment", 0.8, "ATTACHMENT"),
            self.result("a", "z-core", 0.8, "CORE"),
            self.result("b", "z-core", 0.7, "CORE"),
            self.result("b", "a-core", 0.7, "CORE"),
        ])
        response = SearchService(repository, FakeProvider(), META).search("검색", limit=5)
        self.assertEqual(response.results[0].chunk_id, "z-core")
        self.assertEqual(response.results[1].chunk_id, "a-core")

    def test_oversampling_then_dedupe_and_limit(self):
        results = [self.result("duplicate", f"dup-{index}", 1 - index / 100)
                   for index in range(10)]
        results += [self.result(f"program-{index}", f"unique-{index}", 0.5 - index / 100)
                    for index in range(10)]
        repository = FakeSearchRepository(results)
        response = SearchService(repository, FakeProvider(), META).search("검색", limit=5)
        self.assertEqual(repository.calls[0][2], 25)
        self.assertEqual(len(response.results), 5)
        self.assertEqual(len({item.program_case_id for item in response.results}), 5)

    def test_returns_available_unique_programs_when_fewer_than_limit(self):
        repository = FakeSearchRepository([
            self.result("a", "a1", 0.8), self.result("a", "a2", 0.7),
        ])
        response = SearchService(repository, FakeProvider(), META).search("검색", limit=5)
        self.assertEqual(len(response.results), 1)

    def test_metadata_filters_are_normalized_and_combined(self):
        repository = FakeSearchRepository()
        SearchService(repository, FakeProvider(), META).search(
            "검색", target="  성인  ", chunk_type="CORE"
        )
        self.assertEqual(repository.calls[0][4:], ("CORE", "성인"))

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
        for target in ("", "   "):
            with self.assertRaises(ValueError):
                service.search("검색", target=target)
        for threshold in (-1.01, 1.01):
            with self.assertRaises(ValueError):
                service.search("검색", threshold=threshold)


if __name__ == "__main__":
    unittest.main()
