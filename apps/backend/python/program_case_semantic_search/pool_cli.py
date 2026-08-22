from __future__ import annotations

import argparse
import json
from pathlib import Path

from dotenv import load_dotenv

from .cli import metadata
from .config import Settings
from .database import connect
from .kure_embedding_provider import KureEmbeddingProvider
from .search_repository import SearchRepository
from .search_service import SearchService


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--queries", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--cache", required=True)
    parser.add_argument("--limit", type=int, default=10)
    args = parser.parse_args()
    load_dotenv()
    settings = Settings.from_environment(require_database=True)
    provider = KureEmbeddingProvider(cache_folder=str(Path(args.cache).resolve()))
    queries = json.loads(Path(args.queries).read_text(encoding="utf-8"))
    rows = []
    with connect(settings.database_url, read_only=True) as connection:
        service = SearchService(SearchRepository(connection), provider, metadata())
        for index, query in enumerate(queries, 1):
            query_text = query["queryText"]
            query_embedding = provider.encode_query(query_text)
            response = service.search(query_text, limit=args.limit)
            rows.append({
                "queryId": query["queryId"],
                "queryEmbedding": query_embedding,
                "chunk": {
                    "rawChunkCandidates": response.raw_chunk_candidates,
                    "uniquePrograms": response.unique_programs,
                    "duplicatesRemoved": response.duplicates_removed,
                    "results": [{
                        "rank": item.rank,
                        "programCaseId": item.program_case_id,
                        "chunkId": item.chunk_id,
                        "chunkType": item.chunk_type,
                        "canonicalTitle": item.program_title,
                        "similarity": item.similarity,
                    } for item in response.results],
                },
            })
            print(f"pooled query inputs {index}/{len(queries)}", flush=True)
    Path(args.output).write_text(
        json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
