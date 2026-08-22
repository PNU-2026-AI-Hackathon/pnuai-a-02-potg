from __future__ import annotations

import json

from program_case_semantic_search.cli import metadata
from program_case_semantic_search.config import Settings
from program_case_semantic_search.database import connect
from program_case_semantic_search.kure_embedding_provider import KureEmbeddingProvider
from program_case_semantic_search.search_repository import SearchRepository
from program_case_semantic_search.search_service import SearchService

QUERIES = [
    "초등학생이 참여할 수 있는 독서 프로그램",
    "유아와 부모가 함께하는 그림책 활동",
    "어르신 대상 스마트폰 교육",
    "가족이 함께 참여하는 체험 프로그램",
    "환경과 재활용을 주제로 한 프로그램",
    "예산이 적은 문화 프로그램 사례",
    "주민들이 참여할 수 있는 독서 모임",
    "방학 기간 어린이를 위한 프로그램",
    "성인을 위한 인문학 강좌",
    "지역 주민 대상 공예 체험",
]


def main() -> None:
    settings = Settings.from_environment()
    provider = KureEmbeddingProvider(
        cache_folder=str(settings.model_cache_dir) if settings.model_cache_dir else None
    )
    output = []
    with connect(settings.database_url, read_only=True) as connection:
        service = SearchService(SearchRepository(connection), provider, metadata())
        for number, query in enumerate(QUERIES, start=1):
            response = service.search(query)
            programs = [result.program_case_id for result in response.results]
            output.append({
                "queryNumber": number,
                "duplicateProgramCount": len(programs) - len(set(programs)),
                "results": [{
                    "rank": result.rank,
                    "similarity": result.similarity,
                    "chunkType": result.chunk_type,
                    "contentLength": len(result.content),
                } for result in response.results],
            })
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
