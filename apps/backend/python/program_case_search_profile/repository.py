from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ProgramSource:
    program_case_id: str
    title: str
    target: str
    raw_text: str
    notices: str
    sessions: tuple[str, ...]
    attachments: tuple[str, ...]

    @property
    def session_count(self) -> int:
        return len(self.sessions) or 1


def fetch_program_sources(connection: object) -> list[ProgramSource]:
    statement = """
SELECT p."id", p."title", p."targetAudience", p."rawText", p."notices",
       COALESCE(array_agg(DISTINCT s."activity") FILTER (WHERE s."id" IS NOT NULL), ARRAY[]::text[]),
       COALESCE(array_agg(DISTINCT a."cleanedText") FILTER (
         WHERE a."isActive" AND a."extractionStatus" = 'COMPLETED' AND a."cleanedText" IS NOT NULL
       ), ARRAY[]::text[])
FROM "ProgramCase" p
LEFT JOIN "ProgramCaseSession" s ON s."programCaseId" = p."id"
LEFT JOIN "ProgramCaseAttachment" a ON a."programCaseId" = p."id"
GROUP BY p."id"
ORDER BY p."id"
"""
    with connection.cursor() as cursor:
        cursor.execute(statement)
        rows = cursor.fetchall()
    return [ProgramSource(str(r[0]), r[1] or "", r[2] or "", r[3] or "", r[4] or "", tuple(r[5]), tuple(r[6])) for r in rows]
