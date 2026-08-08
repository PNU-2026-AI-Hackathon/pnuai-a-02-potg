import unittest

from program_case_semantic_search.metadata_inference import (
    AgeGroup, OperationType, ParticipationType, ProgramCaseSearchRequest,
    ProgramCategory, build_semantic_query, infer_program_metadata,
)


class MetadataInferenceTests(unittest.TestCase):
    def test_age_and_participation_rules(self):
        cases = (
            ("유아 미술", "", AgeGroup.INFANT),
            ("초등 어린이 독서", "", AgeGroup.CHILD),
            ("성인 강좌", "", AgeGroup.ADULT),
            ("어르신 스마트폰", "", AgeGroup.SENIOR),
            ("가족 공연", "", AgeGroup.FAMILY),
            ("부모와 아이가 함께", "", AgeGroup.PARENT_CHILD),
        )
        for title, target, expected in cases:
            with self.subTest(expected=expected):
                self.assertIn(expected, infer_program_metadata(title, target).age_groups)
        parent = infer_program_metadata("부모와 아이가 함께", "")
        self.assertIn(ParticipationType.PARENT_CHILD, parent.participation_types)
        family = infer_program_metadata("가족이 함께하는 공연", "")
        self.assertIn(ParticipationType.FAMILY, family.participation_types)

    def test_category_rules_and_multiple_categories(self):
        inferred = infer_program_metadata("어린이 디지털 그림책 글쓰기 공예 건강", "")
        for expected in (
            ProgramCategory.DIGITAL, ProgramCategory.READING,
            ProgramCategory.WRITING, ProgramCategory.CRAFT, ProgramCategory.HEALTH,
        ):
            self.assertIn(expected, inferred.categories)

    def test_operation_rules(self):
        inferred = infer_program_metadata("1일 공예 체험 워크숍 공연", "")
        for expected in (
            OperationType.ONE_DAY, OperationType.EXPERIENCE,
            OperationType.WORKSHOP, OperationType.PERFORMANCE,
        ):
            self.assertIn(expected, inferred.operation_types)

    def test_unknown_and_conflicting_evidence(self):
        unknown = infer_program_metadata("분류 근거 없음", "")
        self.assertEqual(unknown.age_groups, frozenset({AgeGroup.UNKNOWN}))
        self.assertEqual(unknown.categories, frozenset({ProgramCategory.UNKNOWN}))
        conflict = infer_program_metadata("어린이와 성인이 함께하는 강좌", "")
        self.assertTrue({AgeGroup.CHILD, AgeGroup.ADULT} <= conflict.age_groups)

    def test_inference_is_deterministic_and_uses_only_safe_arguments(self):
        first = infer_program_metadata("유아 그림책", "어린이")
        second = infer_program_metadata("유아 그림책", "어린이")
        self.assertEqual(first, second)
        self.assertEqual(infer_program_metadata.__code__.co_argcount, 2)

    def test_query_builder_query_only_and_structured_conditions(self):
        self.assertEqual(build_semantic_query(ProgramCaseSearchRequest("건강 프로그램")),
                         "건강 프로그램")
        request = ProgramCaseSearchRequest(
            "디지털 교육", age_groups=frozenset({AgeGroup.SENIOR}),
            categories=frozenset({ProgramCategory.DIGITAL}),
        )
        built = build_semantic_query(request)
        self.assertTrue(built.startswith("디지털 교육"))
        self.assertIn("노년·어르신", built)
        self.assertIn("디지털", built)
        self.assertEqual(built, build_semantic_query(request))

    def test_query_builder_rejects_empty_and_over_limit(self):
        with self.assertRaises(ValueError):
            build_semantic_query(ProgramCaseSearchRequest(" "))
        with self.assertRaises(ValueError):
            build_semantic_query(ProgramCaseSearchRequest("가" * 1001))


if __name__ == "__main__":
    unittest.main()
