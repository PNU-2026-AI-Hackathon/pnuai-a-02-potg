from __future__ import annotations

import argparse
import json
import math
import os
from collections import Counter
from pathlib import Path

from dotenv import load_dotenv

from program_case_semantic_search.config import MODEL_DIMENSION, MODEL_ID, MODEL_REVISION, Settings
from program_case_semantic_search.database import connect, inspect_current_database
from program_case_semantic_search.kure_embedding_provider import KureEmbeddingProvider
from program_case_semantic_search.config import EMBEDDING_VERSION, PROVIDER
from program_case_semantic_search.search_repository import SearchRepository
from program_case_semantic_search.search_service import SearchService
from program_case_semantic_search.types import EmbeddingMetadata

from . import TAXONOMY_VERSION
from .io import read_json, timestamp, write_json
from .pilot import AXES, select_pilot
from .profiles import build_profile
from .repository import fetch_program_sources
from .taxonomy import classify

BACKEND = Path(__file__).resolve().parents[2]
ROOT = BACKEND.parents[1]
PUBLIC_DATA = ROOT / "docs" / "analysis" / "data"
PROFILE_PATH = PUBLIC_DATA / "program-case-search-profile-pilot.public.json"
LOCAL_EMBEDDINGS = BACKEND / ".local" / "program-case-search-profile-pilot.embeddings.json"
EVALUATION_PATH = PUBLIC_DATA / "program-case-search-profile-evaluation.json"
EVALUATION_QUERIES = (
    ("초등학생 환경 실험 프로그램", {"topics": "ENVIRONMENT_SCIENCE", "targetAgeGroups": "CHILD"}),
    ("유아 그림책 활동", {"topics": "READING_WRITING", "targetAgeGroups": "INFANT"}),
    ("성인 대상 디지털 교육", {"topics": "DIGITAL", "targetAgeGroups": "ADULT"}),
    ("부모와 아이가 함께하는 공예", {"topics": "ART_CRAFT", "targetAgeGroups": "FAMILY"}),
    ("어르신 건강 프로그램", {"topics": "HEALTH", "targetAgeGroups": "SENIOR"}),
    ("여러 회차로 진행되는 글쓰기 수업", {"topics": "READING_WRITING", "operationTypes": "MULTI_SESSION"}),
    ("지역 주민이 참여하는 공동체 활동", {"topics": "COMMUNITY"}),
    ("영어를 활용한 어린이 프로그램", {"topics": "LANGUAGE", "targetAgeGroups": "CHILD"}),
    ("과학 체험과 만들기가 포함된 프로그램", {"topics": "ENVIRONMENT_SCIENCE", "activityTypes": "CRAFT"}),
    ("문화 공연 또는 음악 활동", {"topics": "CULTURE", "activityTypes": "PERFORMANCE"}),
)

def _settings() -> Settings:
    load_dotenv(BACKEND / ".env")
    return Settings.from_environment()

def _read_only_sources():
    settings = _settings()
    database = inspect_current_database(settings.database_url)
    if database != "moira":
        raise RuntimeError("read-only pilot is restricted to the verified moira database")
    with connect(settings.database_url, read_only=True) as connection:
        sources = fetch_program_sources(connection)
    return database, sources

def _distribution(profiles, key: str, generated_at: str) -> dict:
    counts = Counter(value for profile in profiles for value in profile[key])
    denominator = len(profiles)
    return {"generatedAt": generated_at, "sourceCount": denominator, "taxonomyVersion": TAXONOMY_VERSION,
            "percentageBasis": "program cases; multi-label categories may exceed 100%",
            "items": [{"category": value, "count": count, "percentage": round(count * 100 / denominator, 2)} for value, count in sorted(counts.items())]}

def generate() -> dict:
    database, sources = _read_only_sources()
    if len(sources) != 349:
        raise RuntimeError(f"expected 349 ProgramCase rows, got {len(sources)}")
    profiles = [build_profile(source) for source in sources]
    pilot = select_pilot(profiles)
    generated_at = timestamp()
    payload = {"generatedAt": generated_at, "databaseVerified": database, "sourceCount": len(profiles), "pilotCount": len(pilot), "taxonomyVersion": TAXONOMY_VERSION, "profiles": pilot}
    write_json(PROFILE_PATH, payload)
    for key, filename in {
        "topics": "program-case-topic-distribution.json", "targetAgeGroups": "program-case-target-age-distribution.json",
        "activityTypes": "program-case-activity-type-distribution.json", "operationTypes": "program-case-operation-type-distribution.json",
    }.items():
        write_json(PUBLIC_DATA / filename, _distribution(profiles, key, generated_at))
    session_counts = Counter("MULTI_SESSION" if profile["sessionCount"] > 1 else "ONE_OFF" for profile in profiles)
    source_counts = Counter(profile["sourceDependency"] for profile in profiles)
    for filename, counts in (("program-case-session-count-distribution.json", session_counts), ("program-case-source-dependency-distribution.json", source_counts)):
        write_json(PUBLIC_DATA / filename, {"generatedAt": generated_at, "sourceCount": len(profiles), "taxonomyVersion": TAXONOMY_VERSION, "percentageBasis": "program cases", "items": [{"category": k, "count": v, "percentage": round(v * 100 / len(profiles), 2)} for k, v in sorted(counts.items())]})
    return payload

def embed() -> dict:
    payload = read_json(PROFILE_PATH)
    settings = _settings()
    provider = KureEmbeddingProvider(cache_folder=str(settings.model_cache_dir) if settings.model_cache_dir else str(BACKEND / ".model-cache"))
    profiles = payload["profiles"]
    existing = {item["programCaseId"]: item for item in (read_json(LOCAL_EMBEDDINGS).get("items", []) if LOCAL_EMBEDDINGS.exists() else [])}
    items, pending = [], []
    for profile in profiles:
        cached = existing.get(profile["programCaseId"])
        if cached and cached.get("representativeDocumentHash") == profile["representativeDocumentHash"]:
            items.append(cached)
        else:
            pending.append(profile)
    if pending:
        result = provider.encode_documents([p["representativeDocument"] for p in pending])
        for profile, vector in zip(pending, result.vectors, strict=True):
            items.append({"programCaseId": profile["programCaseId"], "representativeDocumentHash": profile["representativeDocumentHash"], "model": MODEL_ID, "modelRevision": MODEL_REVISION, "dimension": MODEL_DIMENSION, "embedding": vector, "createdAt": timestamp()})
    items.sort(key=lambda item: item["programCaseId"])
    if len(items) != 30 or any(len(item["embedding"]) != MODEL_DIMENSION or not all(math.isfinite(v) for v in item["embedding"]) for item in items):
        raise RuntimeError("embedding validation failed")
    output = {"model": MODEL_ID, "modelRevision": MODEL_REVISION, "dimension": MODEL_DIMENSION, "count": len(items), "items": items}
    write_json(LOCAL_EMBEDDINGS, output)
    return {"count": len(items), "created": len(pending), "reused": len(items) - len(pending), "dimension": MODEL_DIMENSION}

def _search_with_provider(query: str, provider: KureEmbeddingProvider, limit: int = 5) -> dict:
    query = query.strip()
    if not query or len(query) > 1000:
        raise ValueError("query must contain 1-1000 characters")
    profiles = {p["programCaseId"]: p for p in read_json(PROFILE_PATH)["profiles"]}
    embeddings = read_json(LOCAL_EMBEDDINGS)
    vector = provider.encode_query(query)
    scored = []
    for item in embeddings["items"]:
        similarity = sum(a * b for a, b in zip(vector, item["embedding"], strict=True))
        scored.append((similarity, item["programCaseId"]))
    results = []
    for rank, (similarity, program_id) in enumerate(sorted(scored, key=lambda value: (-value[0], value[1]))[:limit], 1):
        profile = profiles[program_id]
        results.append({"rank": rank, "similarity": similarity, **{key: profile[key] for key in ("programCaseId", "title", *AXES, "sessionCount", "representativeDocument")}})
    return {"candidateCount": 30, "model": MODEL_ID, "results": results}

def search(query: str, limit: int = 5) -> dict:
    settings = _settings()
    provider = KureEmbeddingProvider(cache_folder=str(settings.model_cache_dir) if settings.model_cache_dir else str(BACKEND / ".model-cache"))
    return _search_with_provider(query, provider, limit)

def compare(query: str, limit: int = 5) -> dict:
    settings = _settings()
    database = inspect_current_database(settings.database_url)
    if database != "moira": raise RuntimeError("comparison is restricted to verified moira database")
    provider = KureEmbeddingProvider(cache_folder=str(settings.model_cache_dir) if settings.model_cache_dir else str(BACKEND / ".model-cache"))
    metadata = EmbeddingMetadata(provider=PROVIDER, model=MODEL_ID, model_revision=MODEL_REVISION, embedding_version=EMBEDDING_VERSION, dimension=MODEL_DIMENSION)
    profile = _search_with_provider(query, provider, limit)
    with connect(settings.database_url, read_only=True) as connection:
        chunk = SearchService(SearchRepository(connection), provider, metadata).search(query, limit=limit)
    return {"pilot": True, "chunkCandidateScope": "349 ProgramCase / 888 chunks", "profileCandidateScope": "30 representative ProgramCases",
            "chunkResults": [{"rank": r.rank, "programTitle": r.program_title, "similarity": r.similarity, "chunkType": r.chunk_type, "programCaseId": r.program_case_id} for r in chunk.results],
            "profileResults": profile["results"]}

def evaluate() -> dict:
    settings = _settings()
    database = inspect_current_database(settings.database_url)
    if database != "moira": raise RuntimeError("evaluation is restricted to verified moira database")
    provider = KureEmbeddingProvider(cache_folder=str(settings.model_cache_dir) if settings.model_cache_dir else str(BACKEND / ".model-cache"))
    metadata = EmbeddingMetadata(provider=PROVIDER, model=MODEL_ID, model_revision=MODEL_REVISION, embedding_version=EMBEDDING_VERSION, dimension=MODEL_DIMENSION)
    rows = []
    with connect(settings.database_url, read_only=True) as connection:
        chunk_service = SearchService(SearchRepository(connection), provider, metadata)
        for query, expected in EVALUATION_QUERIES:
            profile = _search_with_provider(query, provider, 5)
            chunk = chunk_service.search(query, limit=5)
            operation_dependent = any(axis in expected for axis in ("operationTypes", "sessionCount"))
            diagnostic_expected = {
                axis: value for axis, value in expected.items()
                if axis not in ("operationTypes", "sessionCount")
            }
            profile_rank = next((r["rank"] for r in profile["results"] if all(value in r[axis] for axis, value in diagnostic_expected.items())), None)
            # Apply the same deterministic taxonomy to in-memory Chunk results;
            # the content itself is never written to the evaluation artifact.
            chunk_rank = next((r.rank for r in chunk.results if all(value in classify(f"{r.program_title} {r.target} {r.content}", session_count=1)[axis] for axis, value in diagnostic_expected.items())), None)
            if operation_dependent: outcome = "INDETERMINATE"
            elif profile_rank and not chunk_rank: outcome = "PROFILE_SIGNAL_AHEAD"
            elif chunk_rank and not profile_rank: outcome = "CHUNK_SIGNAL_AHEAD"
            elif profile_rank and chunk_rank: outcome = "PROFILE_SIGNAL_AHEAD" if profile_rank < chunk_rank else ("SAME_SIGNAL_RANK" if profile_rank == chunk_rank else "CHUNK_SIGNAL_AHEAD")
            else: outcome = "INDETERMINATE"
            rows.append({"query": query, "expectedTaxonomy": expected, "profileRelevantRank": profile_rank, "chunkTitleSignalRank": chunk_rank, "outcome": outcome,
                         "diagnosticType": "WEAK_RULE_CONSISTENCY",
                         "diagnosticNote": "Operation/session conditions are excluded; operation-dependent queries are indeterminate." if operation_dependent else "Not a human relevance judgment.",
                         "attachmentBiasInChunkTop5": sum(r.chunk_type == "ATTACHMENT" for r in chunk.results),
                         "chunkTop5": [{"rank": r.rank, "programCaseId": r.program_case_id, "title": r.program_title, "similarity": r.similarity, "chunkType": r.chunk_type} for r in chunk.results],
                         "profileTop5": [{"rank": r["rank"], "programCaseId": r["programCaseId"], "title": r["title"], "similarity": r["similarity"]} for r in profile["results"]]})
    output = {"generatedAt": timestamp(), "databaseVerified": database, "diagnosticName": "weak rule-consistency diagnostic", "isHumanRelevanceEvaluation": False, "chunkCandidateScope": "349 ProgramCase / 888 chunks", "profileCandidateScope": "30 representative ProgramCases", "judgmentMethod": "Weak rule-consistency diagnostic using similar deterministic taxonomy rules for both result sets. Operation/session conditions are not compared. This cannot establish retrieval quality.", "queries": rows}
    write_json(EVALUATION_PATH, output)
    return {"queryCount": len(rows), "outcomes": dict(Counter(row["outcome"] for row in rows)), "path": str(EVALUATION_PATH)}

def main() -> int:
    parser = argparse.ArgumentParser(prog="program-case-search-profile")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("generate")
    commands.add_parser("embed")
    commands.add_parser("evaluate")
    search_parser = commands.add_parser("search")
    search_parser.add_argument("--query", required=True)
    search_parser.add_argument("--limit", type=int, default=5)
    compare_parser = commands.add_parser("compare")
    compare_parser.add_argument("--query", required=True)
    compare_parser.add_argument("--limit", type=int, default=5)
    args = parser.parse_args()
    if args.command == "generate": result = {"pilotCount": generate()["pilotCount"], "profilePath": str(PROFILE_PATH)}
    elif args.command == "embed": result = embed()
    elif args.command == "evaluate": result = evaluate()
    elif args.command == "compare": result = compare(args.query, min(max(args.limit, 1), 5))
    else: result = search(args.query, min(max(args.limit, 1), 20))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
