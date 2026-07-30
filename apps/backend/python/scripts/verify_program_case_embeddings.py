from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from program_case_semantic_search.cli import metadata
from program_case_semantic_search.config import Settings
from program_case_semantic_search.database import connect

BASE_TABLES = (
    "ProgramCase", "ProgramCaseSession", "ProgramCaseAttachment",
    "ProgramCaseDocument", "ProgramCaseDocumentChunk",
)

# Fixed allow-list: no user-controlled identifier is placed into SQL.
SNAPSHOT_QUERIES = {
    "ProgramCase": 'SELECT to_jsonb(row_value) FROM "ProgramCase" row_value ORDER BY "id"',
    "ProgramCaseSession": 'SELECT to_jsonb(row_value) FROM "ProgramCaseSession" row_value ORDER BY "id"',
    "ProgramCaseAttachment": 'SELECT to_jsonb(row_value) FROM "ProgramCaseAttachment" row_value ORDER BY "id"',
    "ProgramCaseDocument": 'SELECT to_jsonb(row_value) FROM "ProgramCaseDocument" row_value ORDER BY "id"',
    "ProgramCaseDocumentChunk": 'SELECT to_jsonb(row_value) FROM "ProgramCaseDocumentChunk" row_value ORDER BY "id"',
}


def _canonical(value: object) -> bytes:
    return json.dumps(
        value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str
    ).encode("utf-8")


def snapshot_table(connection: object, table: str) -> dict[str, object]:
    if table not in SNAPSHOT_QUERIES:
        raise ValueError("unsupported snapshot table")
    digest = hashlib.sha256()
    count = 0
    with connection.cursor() as cursor:
        cursor.execute(SNAPSHOT_QUERIES[table])
        for (row_json,) in cursor:
            digest.update(_canonical(row_json))
            digest.update(b"\n")
            count += 1
    return {"count": count, "sha256": digest.hexdigest()}


def compare_snapshots(
    baseline: dict[str, dict[str, object]],
    current: dict[str, dict[str, object]],
) -> list[dict[str, object]]:
    differences = []
    for table in BASE_TABLES:
        before = baseline.get(table)
        after = current.get(table)
        if before != after:
            differences.append({"table": table, "baseline": before, "current": after})
    return differences


def embedding_checks(connection: object) -> dict[str, int]:
    current = metadata()
    with connection.cursor() as cursor:
        cursor.execute("""
SELECT
  (SELECT COUNT(*) FROM "ProgramCaseDocumentChunk")::int,
  COUNT(*)::int,
  COUNT(*) FILTER (WHERE e."status" = 'PENDING')::int,
  COUNT(*) FILTER (WHERE e."status" = 'PROCESSING')::int,
  COUNT(*) FILTER (WHERE e."status" = 'COMPLETED')::int,
  COUNT(*) FILTER (WHERE e."status" = 'FAILED')::int,
  ((SELECT COUNT(*) FROM "ProgramCaseDocumentChunk")
    - COUNT(DISTINCT e."programCaseDocumentChunkId"))::int,
  COUNT(*) FILTER (WHERE e."embedding" IS NULL)::int,
  COUNT(*) FILTER (WHERE e."dimension" <> %s)::int,
  COUNT(*) FILTER (WHERE e."provider" <> %s)::int,
  COUNT(*) FILTER (WHERE e."model" <> %s)::int,
  COUNT(*) FILTER (WHERE e."modelRevision" <> %s)::int,
  COUNT(*) FILTER (WHERE e."embeddingVersion" <> %s)::int,
  COUNT(*) FILTER (WHERE e."embeddedContentHash" IS NULL)::int,
  COUNT(*) FILTER (WHERE e."embeddedContentHash" IS DISTINCT FROM c."contentHash")::int,
  COUNT(*) FILTER (WHERE c."id" IS NULL)::int,
  (COUNT(*) - COUNT(DISTINCT e."programCaseDocumentChunkId"))::int,
  COUNT(*) FILTER (WHERE e."status" = 'COMPLETED' AND e."embeddedAt" IS NULL)::int,
  COUNT(*) FILTER (WHERE e."status" = 'FAILED' AND e."failureCode" IS NULL)::int
FROM "ProgramCaseDocumentChunkEmbedding" e
LEFT JOIN "ProgramCaseDocumentChunk" c ON c."id" = e."programCaseDocumentChunkId"
""", (
            current.dimension, current.provider, current.model,
            current.model_revision, current.embedding_version,
        ))
        values = cursor.fetchone()
    labels = (
        "chunks", "embeddings", "pending", "processing", "completed", "failed",
        "chunksWithoutEmbedding", "nullVectors", "dimensionMismatch",
        "providerMismatch", "modelMismatch", "revisionMismatch",
        "embeddingVersionMismatch", "missingEmbeddedContentHash",
        "contentHashMismatch", "orphanEmbeddings", "duplicateChunkRelations",
        "completedWithoutEmbeddedAt", "failedWithoutFailureCode",
    )
    return dict(zip(labels, values))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    modes = parser.add_mutually_exclusive_group(required=True)
    modes.add_argument("--write-baseline", type=Path)
    modes.add_argument("--compare-baseline", type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    settings = Settings.from_environment()
    with connect(settings.database_url, read_only=True) as connection:
        connection.execute("SET LOCAL TIME ZONE 'UTC'")
        snapshots = {table: snapshot_table(connection, table) for table in BASE_TABLES}
        checks = embedding_checks(connection)

    if args.write_baseline:
        payload = {"version": 1, "tables": snapshots}
        args.write_baseline.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(json.dumps({
            "baselineWritten": str(args.write_baseline.name),
            "tables": snapshots,
            "embeddingChecks": checks,
        }, ensure_ascii=False, indent=2))
        return 0

    baseline_payload = json.loads(args.compare_baseline.read_text(encoding="utf-8"))
    differences = compare_snapshots(baseline_payload.get("tables", {}), snapshots)
    print(json.dumps({
        "matchesBaseline": not differences,
        "differences": differences,
        "embeddingChecks": checks,
    }, ensure_ascii=False, indent=2))
    return 1 if differences else 0


if __name__ == "__main__":
    raise SystemExit(main())
