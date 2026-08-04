from __future__ import annotations

import json

from program_case_semantic_search.config import Settings
from program_case_semantic_search.database import connect

EXPECTED_TYPES = frozenset({
    "CORE",
    "SESSIONS",
    "SHORT_ATTACHMENT",
    "LONG_PDF_ATTACHMENT",
    "JPEG_OCR",
    "HWP",
    "OCR_MERGED_PDF",
})

QUERY = """
WITH candidates AS (
  SELECT
    c."id", c."chunkType"::text, c."characterCount", c."sourceLabel",
    a."detectedFileType", a."extractorType", e."status"::text AS "embeddingStatus",
    COUNT(*) OVER (PARTITION BY c."programCaseAttachmentId") AS attachment_parts,
    CASE
      WHEN c."chunkType" = 'CORE' THEN 'CORE'
      WHEN c."chunkType" = 'SESSIONS' THEN 'SESSIONS'
      WHEN c."chunkType" = 'ATTACHMENT' AND a."extractorType" = 'CLOVA_OCR_GENERAL'
        AND a."detectedFileType" = 'JPEG' THEN 'JPEG_OCR'
      WHEN c."chunkType" = 'ATTACHMENT' AND a."extractorType" = 'KORDOC_HWP' THEN 'HWP'
      WHEN c."chunkType" = 'ATTACHMENT'
        AND a."extractorType" = 'PDFJS_TEXT_OCR_MERGED' THEN 'OCR_MERGED_PDF'
      WHEN c."chunkType" = 'ATTACHMENT' AND a."detectedFileType" = 'PDF'
        AND COUNT(*) OVER (PARTITION BY c."programCaseAttachmentId") > 1
        THEN 'LONG_PDF_ATTACHMENT'
      WHEN c."chunkType" = 'ATTACHMENT' AND c."characterCount" <= 1000 THEN 'SHORT_ATTACHMENT'
      ELSE NULL
    END AS representative_type
  FROM "ProgramCaseDocumentChunk" c
  LEFT JOIN "ProgramCaseAttachment" a ON a."id" = c."programCaseAttachmentId"
  LEFT JOIN "ProgramCaseDocumentChunkEmbedding" e
    ON e."programCaseDocumentChunkId" = c."id"
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY representative_type
    ORDER BY
      CASE WHEN representative_type = 'LONG_PDF_ATTACHMENT' THEN attachment_parts ELSE 0 END DESC,
      "characterCount" ASC,
      "id" ASC
  ) AS representative_rank
  FROM candidates
  WHERE representative_type IS NOT NULL
)
SELECT representative_type, "id", "chunkType", "characterCount", "sourceLabel",
       "detectedFileType", "extractorType", "embeddingStatus"
FROM ranked
WHERE representative_rank = 1
ORDER BY representative_type
"""


def validate_representatives(rows: list[tuple]) -> tuple[list[str], list[str]]:
    selected = [row[0] for row in rows]
    missing = sorted(EXPECTED_TYPES - set(selected))
    chunk_ids = [row[1] for row in rows]
    duplicates = sorted({chunk_id for chunk_id in chunk_ids if chunk_ids.count(chunk_id) > 1})
    return missing, duplicates


def main() -> int:
    settings = Settings.from_environment()
    with connect(settings.database_url, read_only=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(QUERY)
            rows = cursor.fetchall()
    labels = (
        "representativeType", "chunkId", "chunkType", "characterCount",
        "sourceLabel", "detectedFileType", "extractorType", "embeddingStatus",
    )
    output = [dict(zip(labels, row)) for row in rows]
    missing, duplicates = validate_representatives(rows)
    print(json.dumps({
        "representatives": output,
        "missingTypes": missing,
        "duplicateChunkIds": duplicates,
    }, ensure_ascii=False, indent=2))
    return 1 if missing or duplicates else 0


if __name__ == "__main__":
    raise SystemExit(main())
