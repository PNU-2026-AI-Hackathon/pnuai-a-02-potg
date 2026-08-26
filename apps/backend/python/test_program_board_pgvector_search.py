from __future__ import annotations

import unittest

from program_board_pgvector_search import rerank


def candidate(source_id: int, title: str, target: str, similarity: float, summary: str = "") -> dict:
    return {
        "sourceId": source_id,
        "sourceUrl": f"https://example.com/{source_id}",
        "title": title,
        "target": target,
        "libraryName": "테스트 도서관",
        "summary": summary,
        "profile": "title+intro+target",
        "embeddingText": title,
        "checksum": str(source_id),
        "detailLevel": "partial",
        "detailReason": "소개·목표 존재",
        "sessionCount": 1,
        "sourceType": "text",
        "similarity": similarity,
        "educationStartDateText": "",
        "educationEndDateText": "",
        "capacity": 10,
        "sessions": [],
    }


class ProgramBoardPgvectorSearchTest(unittest.TestCase):
    def test_applies_audience_and_concept_reranking(self):
        response = rerank("초등 저학년 환경 만들기", [
            candidate(1, "환경 만들기", "초등 1~3학년", 0.70, "환경 공예 만들기"),
            candidate(2, "환경 만들기", "성인", 0.80, "환경 공예 만들기"),
        ], 5, "elementary-lower")
        self.assertEqual([item["sourceId"] for item in response["results"]], [1])
        self.assertEqual(response["filteredOutByAudience"], 1)

    def test_applies_relative_similarity_floor(self):
        response = rerank("독서 모임", [
            candidate(1, "독서 모임", "성인", 0.80, "책읽기 토론"),
            candidate(2, "독서 모임 기초", "성인", 0.60, "책읽기 토론"),
        ], 5)
        self.assertEqual([item["sourceId"] for item in response["results"]], [1])
        self.assertEqual(response["minimumCriteria"]["relativeSimilarityFloor"], 0.85)

    def test_deduplicates_same_series(self):
        response = rerank("그림책", [
            candidate(1, "이야기로 만나는 동화나라(10/15)", "유아", 0.80, "그림책"),
            candidate(2, "이야기로 만나는 동화나라(10/22)", "유아", 0.79, "그림책"),
        ], 5)
        self.assertEqual(len(response["results"]), 1)
        self.assertEqual(response["results"][0]["seriesCount"], 2)


if __name__ == "__main__":
    unittest.main()
