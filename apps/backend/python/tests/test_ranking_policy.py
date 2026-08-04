import unittest

from program_case_semantic_search.metadata_inference import (
    AgeGroup, ProgramCaseSearchRequest, ProgramCategory,
)
from program_case_semantic_search.ranking_policy import ScoringPolicy, rank_programs
from program_case_semantic_search.types import SearchResult


def result(program, chunk, score, chunk_type="CORE", title="일반 프로그램", target=""):
    return SearchResult(
        rank=0, similarity=score, program_case_id=program,
        program_case_document_id="doc-" + program, chunk_id=chunk,
        chunk_key=chunk, chunk_type=chunk_type, chunk_order=0,
        source_label=None, program_title=title, target=target, content="private",
    )


class RankingPolicyTests(unittest.TestCase):
    def test_baseline_preserves_raw_similarity_and_highest_chunk(self):
        ranked = rank_programs([
            result("a", "core", 0.7), result("a", "attachment", 0.8, "ATTACHMENT")
        ], ProgramCaseSearchRequest("query"), ScoringPolicy.BASELINE)
        self.assertEqual(ranked[0].representative.chunk_id, "attachment")
        self.assertEqual(ranked[0].raw_similarity, 0.8)
        self.assertEqual(ranked[0].final_score, 0.8)

    def test_weighting_changes_final_score_not_raw_or_representative(self):
        ranked = rank_programs([
            result("a", "attachment", 0.8, "ATTACHMENT")
        ], ProgramCaseSearchRequest("query"), ScoringPolicy.WEIGHTED)
        self.assertEqual(ranked[0].raw_similarity, 0.8)
        self.assertEqual(ranked[0].representative.chunk_id, "attachment")
        self.assertAlmostEqual(ranked[0].final_score, 0.76)

    def test_aggregation_uses_only_second_chunk(self):
        candidates = [
            result("a", "one", 0.8), result("a", "two", 0.7),
            result("a", "three", 0.6),
        ]
        ranked = rank_programs(candidates, ProgramCaseSearchRequest("query"),
                               ScoringPolicy.AGGREGATE)
        self.assertAlmostEqual(ranked[0].final_score, 0.87)

    def test_metadata_bonus_and_hybrid_filter(self):
        request = ProgramCaseSearchRequest(
            "query", age_groups=frozenset({AgeGroup.SENIOR}),
            categories=frozenset({ProgramCategory.DIGITAL}),
        )
        candidates = [
            result("match", "a", 0.5, title="어르신 스마트폰 교육"),
            result("wrong", "b", 0.9, title="어린이 영어"),
            result("unknown", "c", 0.4, title="분류 근거 없음"),
        ]
        ranked = rank_programs(candidates, request, ScoringPolicy.METADATA)
        self.assertIn("wrong", [item.representative.program_case_id for item in ranked])
        self.assertIn("unknown", [item.representative.program_case_id for item in ranked])
        matched = next(item for item in ranked if item.representative.program_case_id == "match")
        self.assertAlmostEqual(matched.final_score, 0.58)
        combined = rank_programs(candidates, request, ScoringPolicy.COMBINED)
        self.assertNotIn("wrong", [item.representative.program_case_id for item in combined])
        self.assertIn("unknown", [item.representative.program_case_id for item in combined])

    def test_ties_are_deterministic_and_limit_applies(self):
        candidates = [result("b", "z", 0.5), result("a", "z", 0.5)]
        request = ProgramCaseSearchRequest("query", limit=1)
        first = rank_programs(candidates, request, ScoringPolicy.BASELINE)
        second = rank_programs(list(reversed(candidates)), request, ScoringPolicy.BASELINE)
        self.assertEqual(first, second)
        self.assertEqual(len(first), 1)
        self.assertEqual(first[0].representative.program_case_id, "a")


if __name__ == "__main__":
    unittest.main()
