import unittest

from program_board_semantic_search import (
    audience_adjustment,
    document_audiences,
    query_audience,
    concept_adjustment,
    text_concepts,
)


class AudienceCompatibilityTest(unittest.TestCase):
    def test_adult_query_prefers_adult_and_general(self):
        requested = query_audience("성인이 책을 읽는 독서 모임")
        self.assertEqual(requested, "adult")
        self.assertGreater(audience_adjustment(requested, document_audiences("성인"))[0], 0)
        self.assertGreater(audience_adjustment(requested, document_audiences("지역주민"))[0], 0)
        self.assertLess(audience_adjustment(requested, document_audiences("유아 6~7세"))[0], 0)

    def test_lower_elementary_query_recognizes_grade_range(self):
        requested = query_audience("초등 저학년 환경 만들기")
        self.assertEqual(requested, "elementary_lower")
        audiences = document_audiences("초등 1~3학년")
        self.assertIn("elementary_lower", audiences)
        self.assertGreater(audience_adjustment(requested, audiences)[0], 0)

    def test_upper_elementary_is_separate_from_lower_grades(self):
        requested = query_audience("초등 고학년 보드게임 수업")
        self.assertEqual(requested, "elementary_upper")
        self.assertGreater(audience_adjustment(requested, document_audiences("초등학생 4-6학년"))[0], 0)
        self.assertLess(audience_adjustment(requested, document_audiences("초등학생 1-2학년"))[0], 0)

    def test_no_audience_does_not_change_score(self):
        self.assertEqual(audience_adjustment(None, {"preschool"})[0], 0)

    def test_environment_craft_rejects_english_only_program(self):
        query = text_concepts("환경과 기후를 배우며 만들기 하는 수업")
        environment = text_concepts("환경 생태를 배우고 만들기 체험")
        english = text_concepts("영어동화책과 게임 퀴즈 영어 수업")
        self.assertEqual(concept_adjustment(query, environment)[1], 1.0)
        self.assertEqual(concept_adjustment(query, english)[1], 0.0)

    def test_picturebook_craft_allows_partial_picturebook_match(self):
        query = text_concepts("그림책을 읽고 클레이 활동")
        english_story = text_concepts("영어동화책을 읽고 퀴즈")
        self.assertAlmostEqual(concept_adjustment(query, english_story)[1], 1 / 3)


if __name__ == "__main__":
    unittest.main()
