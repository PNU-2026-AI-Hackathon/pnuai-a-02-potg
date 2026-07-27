import { ClientBase } from 'pg';

type AttachmentRow = {
  id: string;
  programCaseId: string;
  fileUrl: string;
  fileType: string | null;
  detectedFileType: string | null;
  detectedMimeType: string | null;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
  extractionStatus: string;
  rawText: string | null;
  cleanedText: string | null;
  extractorType: string | null;
  extractorVersion: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  attemptCount: number;
  lastAttemptedAt: Date | null;
  extractedAt: Date | null;
  isActive: boolean;
  programExists: boolean;
};

type CountRow = { count: number };

export type AttachmentVerificationReport = {
  schemaVersion: 1;
  generatedAt: string;
  transaction: { begin: 'BEGIN TRANSACTION READ ONLY'; end: 'ROLLBACK'; readOnly: true };
  totals: Record<string, number>;
  sourceFileTypes: Record<string, number>;
  detectedFileTypes: Record<string, number>;
  statuses: Record<string, number>;
  sourceTypeStatus: Record<string, Record<string, number>>;
  detectedTypeStatus: Record<string, Record<string, number>>;
  completedIntegrity: Record<string, number>;
  textLengths: Record<string, Record<string, number | null>>;
  textLengthsByDetectedType: Record<string, { rawText: Record<string, number | null>; cleanedText: Record<string, number | null> }>;
  extractionTimes: {
    extractedAtMinimum: string | null;
    extractedAtMaximum: string | null;
    lastAttemptedAtMinimum: string | null;
    lastAttemptedAtMaximum: string | null;
  };
  extractors: Array<{ detectedFileType: string; extractionStatus: string; extractorType: string; extractorVersion: string; count: number }>;
  incomplete: Array<Record<string, string | number | boolean | null>>;
  staleProcessing: Array<{ id: string; lastAttemptedAt: string | null; ageHours: number | null }>;
  attempts: { minimum: number | null; average: number | null; maximum: number | null; atLeastTwo: number; suspicious: string[] };
  temporalAnomalies: Record<string, string[]>;
  duplicates: {
    summary: Record<string, number>;
    compositeKey: Array<{ programCaseId: string; ids: string[]; count: number }>;
    fileUrl: Array<{ ids: string[]; programCaseCount: number; count: number; conflictsWithCompositeKey: boolean }>;
    checksum: Array<{ ids: string[]; programCaseCount: number; count: number; sameProgramReuse: boolean; crossProgramReuse: boolean }>;
    activeInactiveSameUrl: Array<{ ids: string[]; count: number }>;
  };
  mismatches: Array<{ id: string; fileType: string; detectedFileType: string }>;
  metadataMissing: Record<string, string[]>;
  samples: Array<Record<string, string | number | boolean | null>>;
  unexpected: { statuses: Record<string, number>; detectedFileTypes: Record<string, number> };
};

const STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'];
const DETECTED_TYPES = ['PDF', 'JPEG', 'PNG', 'HWP', 'HWPX'];

function key(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toUpperCase() : 'NULL_OR_EMPTY';
}

function sourceFamily(value: string | null) {
  const normalized = key(value);
  if (['JPG', 'JPEG', 'PNG', 'IMAGE'].includes(normalized)) return 'IMAGE';
  if (normalized === 'PDF') return 'PDF';
  if (normalized === 'HWP') return 'HWP';
  if (normalized === 'HWPX') return 'HWPX';
  return normalized;
}

function detectedFamily(value: string | null) {
  const normalized = key(value);
  return ['JPEG', 'PNG'].includes(normalized) ? 'IMAGE' : normalized;
}

function increment(target: Record<string, number>, value: string, amount = 1) {
  target[value] = (target[value] ?? 0) + amount;
}

function crossIncrement(target: Record<string, Record<string, number>>, type: string, status: string) {
  target[type] ??= {};
  increment(target[type], status);
}

function trimmedLength(value: string | null) {
  return value?.trim().length ?? 0;
}

function lengthStats(rows: AttachmentRow[], field: 'rawText' | 'cleanedText') {
  const values = rows.map((row) => trimmedLength(row[field])).sort((a, b) => a - b);
  if (values.length === 0) return { minimum: null, average: null, median: null, maximum: null };
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return {
    minimum: values[0],
    average: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
    median,
    maximum: values[values.length - 1],
  };
}

function iso(value: Date | null) {
  return value ? new Date(value).toISOString() : null;
}

function dateRange(rows: AttachmentRow[], field: 'extractedAt' | 'lastAttemptedAt') {
  const values = rows.map((row) => row[field]).filter((value): value is Date => value !== null)
    .map((value) => new Date(value).getTime()).sort((a, b) => a - b);
  return {
    minimum: values.length ? new Date(values[0]).toISOString() : null,
    maximum: values.length ? new Date(values[values.length - 1]).toISOString() : null,
  };
}

function groupRows(rows: AttachmentRow[], selector: (row: AttachmentRow) => string | null) {
  const groups = new Map<string, AttachmentRow[]>();
  for (const row of rows) {
    const value = selector(row);
    if (!value) continue;
    const group = groups.get(value) ?? [];
    group.push(row);
    groups.set(value, group);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

function hasExcessiveControls(value: string | null) {
  if (!value) return false;
  const controls = value.match(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g)?.length ?? 0;
  return controls > Math.max(3, value.length * 0.01);
}

export function buildAttachmentVerificationReport(
  allRows: AttachmentRow[],
  programCount: number,
  sessionCount: number,
  orphanSessionCount: number,
  generatedAt = new Date(),
): AttachmentVerificationReport {
  const active = allRows.filter((row) => row.isActive);
  const completed = active.filter((row) => row.extractionStatus === 'COMPLETED');
  const programIdsWithAttachments = new Set(active.filter((row) => row.programExists).map((row) => row.programCaseId));
  const sourceFileTypes: Record<string, number> = {};
  const detectedFileTypes: Record<string, number> = {};
  const statuses: Record<string, number> = {};
  const sourceTypeStatus: Record<string, Record<string, number>> = {};
  const detectedTypeStatus: Record<string, Record<string, number>> = {};
  for (const row of active) {
    increment(sourceFileTypes, key(row.fileType));
    increment(detectedFileTypes, key(row.detectedFileType));
    increment(statuses, row.extractionStatus);
    crossIncrement(sourceTypeStatus, sourceFamily(row.fileType), row.extractionStatus);
    crossIncrement(detectedTypeStatus, detectedFamily(row.detectedFileType), row.extractionStatus);
  }

  const completedIntegrity = {
    rawTextNull: completed.filter((row) => row.rawText === null).length,
    rawTextBlank: completed.filter((row) => row.rawText !== null && trimmedLength(row.rawText) === 0).length,
    cleanedTextNull: completed.filter((row) => row.cleanedText === null).length,
    cleanedTextBlank: completed.filter((row) => row.cleanedText !== null && trimmedLength(row.cleanedText) === 0).length,
    rawTextUnder50: completed.filter((row) => trimmedLength(row.rawText) < 50).length,
    rawTextUnder100: completed.filter((row) => trimmedLength(row.rawText) < 100).length,
    cleanedTextUnder50: completed.filter((row) => trimmedLength(row.cleanedText) < 50).length,
    cleanedTextUnder100: completed.filter((row) => trimmedLength(row.cleanedText) < 100).length,
    extractorTypeMissing: completed.filter((row) => !row.extractorType?.trim()).length,
    extractorVersionMissing: completed.filter((row) => !row.extractorVersion?.trim()).length,
    extractedAtMissing: completed.filter((row) => !row.extractedAt).length,
    lastAttemptedAtMissing: completed.filter((row) => !row.lastAttemptedAt).length,
    invalidAttemptCount: completed.filter((row) => row.attemptCount < 1).length,
    failureCodePresent: completed.filter((row) => !!row.failureCode?.trim()).length,
    failureMessagePresent: completed.filter((row) => !!row.failureMessage?.trim()).length,
  };

  const extractorGroups = new Map<string, number>();
  for (const row of active) {
    const combination = JSON.stringify([key(row.detectedFileType), row.extractionStatus, key(row.extractorType), key(row.extractorVersion)]);
    extractorGroups.set(combination, (extractorGroups.get(combination) ?? 0) + 1);
  }
  const extractors = [...extractorGroups.entries()].map(([combination, count]) => {
    const [detectedFileType, extractionStatus, extractorType, extractorVersion] = JSON.parse(combination) as string[];
    return { detectedFileType, extractionStatus, extractorType, extractorVersion, count };
  }).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));

  const nowMs = generatedAt.getTime();
  const incomplete = active.filter((row) => row.extractionStatus !== 'COMPLETED').map((row) => ({
    id: row.id,
    sourceType: sourceFamily(row.fileType),
    detectedFileType: key(row.detectedFileType),
    extractionStatus: row.extractionStatus,
    attemptCount: row.attemptCount,
    lastAttemptedAt: iso(row.lastAttemptedAt),
    failureCode: row.failureCode,
    failureMessagePresent: !!row.failureMessage?.trim(),
    extractorType: row.extractorType,
    extractorVersion: row.extractorVersion,
  })).sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const staleProcessing = active.filter((row) => row.extractionStatus === 'PROCESSING').map((row) => ({
    id: row.id,
    lastAttemptedAt: iso(row.lastAttemptedAt),
    ageHours: row.lastAttemptedAt ? Number(((nowMs - new Date(row.lastAttemptedAt).getTime()) / 3_600_000).toFixed(2)) : null,
  })).filter((row) => row.ageHours === null || row.ageHours >= 1).sort((a, b) => a.id.localeCompare(b.id));

  const attempts = active.map((row) => row.attemptCount);
  const suspiciousAttempts = active.filter((row) => !Number.isSafeInteger(row.attemptCount) || row.attemptCount < 0).map((row) => row.id).sort();
  const temporalAnomalies = {
    completedExtractedAfterLastAttempt: completed.filter((row) => row.extractedAt && row.lastAttemptedAt && row.extractedAt < row.lastAttemptedAt).map((row) => row.id).sort(),
    pendingWithExtractedAt: active.filter((row) => row.extractionStatus === 'PENDING' && row.extractedAt).map((row) => row.id).sort(),
    failedWithoutFailure: active.filter((row) => row.extractionStatus === 'FAILED' && !row.failureCode?.trim() && !row.failureMessage?.trim()).map((row) => row.id).sort(),
  };

  const compositeGroups = groupRows(allRows, (row) => `${row.programCaseId}\u0000${row.fileUrl}`);
  const urlGroups = groupRows(allRows, (row) => row.fileUrl);
  const checksumGroups = groupRows(allRows, (row) => row.checksumSha256?.trim() || null);
  const metadataMissing = {
    detectedFileType: active.filter((row) => !row.detectedFileType?.trim()).map((row) => row.id).sort(),
    detectedMimeType: active.filter((row) => !row.detectedMimeType?.trim()).map((row) => row.id).sort(),
    fileSizeBytes: active.filter((row) => row.fileSizeBytes === null || row.fileSizeBytes <= 0).map((row) => row.id).sort(),
    checksumSha256: active.filter((row) => !row.checksumSha256?.trim()).map((row) => row.id).sort(),
  };

  const samples: Array<Record<string, string | number | boolean | null>> = [];
  const sampleGroups = new Map<string, AttachmentRow[]>();
  for (const row of completed) {
    const group = sampleGroups.get(key(row.detectedFileType)) ?? [];
    group.push(row);
    sampleGroups.set(key(row.detectedFileType), group);
  }
  for (const [format, rows] of [...sampleGroups.entries()].sort()) {
    const sorted = [...rows].sort((a, b) =>
      trimmedLength(a.cleanedText) - trimmedLength(b.cleanedText) || a.id.localeCompare(b.id),
    );
    const selected = [...new Map([
      sorted[0],
      sorted[sorted.length - 1],
      ...[...new Map(rows.map((row) => [key(row.extractorType), row])).values()],
    ].map((row) => [row.id, row])).values()].sort((a, b) => a.id.localeCompare(b.id));
    for (const row of selected) {
      samples.push({
        id: row.id,
        format,
        rawTextPresent: trimmedLength(row.rawText) > 0,
        cleanedTextPresent: trimmedLength(row.cleanedText) > 0,
        rawTextLength: trimmedLength(row.rawText),
        cleanedTextLength: trimmedLength(row.cleanedText),
        extractorType: row.extractorType,
        extractorVersion: row.extractorVersion,
        replacementCharacter: !!row.rawText?.includes('\uFFFD') || !!row.cleanedText?.includes('\uFFFD'),
        nulCharacter: !!row.rawText?.includes('\u0000') || !!row.cleanedText?.includes('\u0000'),
        excessiveControls: hasExcessiveControls(row.rawText) || hasExcessiveControls(row.cleanedText),
        cleanedNotLongerThanRaw: trimmedLength(row.cleanedText) <= trimmedLength(row.rawText),
      });
    }
  }

  const unexpectedStatuses: Record<string, number> = {};
  const unexpectedDetected: Record<string, number> = {};
  for (const [status, count] of Object.entries(statuses)) if (!STATUSES.includes(status)) unexpectedStatuses[status] = count;
  for (const [type, count] of Object.entries(detectedFileTypes)) {
    if (!DETECTED_TYPES.includes(type) && type !== 'NULL_OR_EMPTY') unexpectedDetected[type] = count;
  }

  const textLengthsByDetectedType: AttachmentVerificationReport['textLengthsByDetectedType'] = {};
  for (const detectedType of [...new Set(completed.map((row) => key(row.detectedFileType)))].sort()) {
    const rows = completed.filter((row) => key(row.detectedFileType) === detectedType);
    textLengthsByDetectedType[detectedType] = {
      rawText: lengthStats(rows, 'rawText'),
      cleanedText: lengthStats(rows, 'cleanedText'),
    };
  }
  const extractedRange = dateRange(active, 'extractedAt');
  const attemptedRange = dateRange(active, 'lastAttemptedAt');
  const duplicateChecksumRows = checksumGroups.reduce((sum, rows) => sum + rows.length, 0);

  return {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    transaction: { begin: 'BEGIN TRANSACTION READ ONLY', end: 'ROLLBACK', readOnly: true },
    totals: {
      programCases: programCount,
      programCaseSessions: sessionCount,
      attachments: allRows.length,
      activeAttachments: active.length,
      inactiveAttachments: allRows.length - active.length,
      programCasesWithActiveAttachments: programIdsWithAttachments.size,
      programCasesWithoutActiveAttachments: programCount - programIdsWithAttachments.size,
      orphanAttachments: allRows.filter((row) => !row.programExists).length,
      orphanSessions: orphanSessionCount,
    },
    sourceFileTypes,
    detectedFileTypes,
    statuses,
    sourceTypeStatus,
    detectedTypeStatus,
    completedIntegrity,
    textLengths: {
      rawText: lengthStats(completed, 'rawText'),
      cleanedText: lengthStats(completed, 'cleanedText'),
    },
    textLengthsByDetectedType,
    extractionTimes: {
      extractedAtMinimum: extractedRange.minimum,
      extractedAtMaximum: extractedRange.maximum,
      lastAttemptedAtMinimum: attemptedRange.minimum,
      lastAttemptedAtMaximum: attemptedRange.maximum,
    },
    extractors,
    incomplete,
    staleProcessing,
    attempts: {
      minimum: attempts.length ? Math.min(...attempts) : null,
      average: attempts.length ? Number((attempts.reduce((sum, value) => sum + value, 0) / attempts.length).toFixed(2)) : null,
      maximum: attempts.length ? Math.max(...attempts) : null,
      atLeastTwo: attempts.filter((value) => value >= 2).length,
      suspicious: suspiciousAttempts,
    },
    temporalAnomalies,
    duplicates: {
      summary: {
        compositeKeyGroups: compositeGroups.length,
        fileUrlGroups: urlGroups.length,
        checksumGroups: checksumGroups.length,
        rowsInChecksumGroups: duplicateChecksumRows,
        sameProgramChecksumGroups: checksumGroups.filter((rows) => new Set(rows.map((row) => row.programCaseId)).size < rows.length).length,
        crossProgramChecksumGroups: checksumGroups.filter((rows) => new Set(rows.map((row) => row.programCaseId)).size > 1).length,
      },
      compositeKey: compositeGroups.map((rows) => ({ programCaseId: rows[0].programCaseId, ids: rows.map((row) => row.id).sort(), count: rows.length })),
      fileUrl: urlGroups.map((rows) => ({
        ids: rows.map((row) => row.id).sort(),
        programCaseCount: new Set(rows.map((row) => row.programCaseId)).size,
        count: rows.length,
        conflictsWithCompositeKey: new Set(rows.map((row) => row.programCaseId)).size < rows.length,
      })),
      checksum: checksumGroups.map((rows) => {
        const programCaseCount = new Set(rows.map((row) => row.programCaseId)).size;
        return {
          ids: rows.map((row) => row.id).sort(),
          programCaseCount,
          count: rows.length,
          sameProgramReuse: programCaseCount < rows.length,
          crossProgramReuse: programCaseCount > 1,
        };
      }),
      activeInactiveSameUrl: urlGroups.filter((rows) => rows.some((row) => row.isActive) && rows.some((row) => !row.isActive))
        .map((rows) => ({ ids: rows.map((row) => row.id).sort(), count: rows.length })),
    },
    mismatches: active.filter((row) => {
      const source = sourceFamily(row.fileType);
      const detected = detectedFamily(row.detectedFileType);
      return source !== 'NULL_OR_EMPTY' && detected !== 'NULL_OR_EMPTY' && source !== detected;
    }).map((row) => ({ id: row.id, fileType: key(row.fileType), detectedFileType: key(row.detectedFileType) })).sort((a, b) => a.id.localeCompare(b.id)),
    metadataMissing,
    samples,
    unexpected: { statuses: unexpectedStatuses, detectedFileTypes: unexpectedDetected },
  };
}

export async function runReadOnlyAttachmentVerification(client: ClientBase, generatedAt = new Date()) {
  let began = false;
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    began = true;
    const transaction = await client.query<{ transaction_read_only: string }>('SHOW transaction_read_only');
    if (transaction.rows[0]?.transaction_read_only !== 'on') {
      throw new Error('PostgreSQL did not confirm a read-only transaction.');
    }
    const programs = await client.query<CountRow>('SELECT COUNT(*)::int AS count FROM "ProgramCase"');
    const sessions = await client.query<CountRow>('SELECT COUNT(*)::int AS count FROM "ProgramCaseSession"');
    const orphanSessions = await client.query<CountRow>('SELECT COUNT(*)::int AS count FROM "ProgramCaseSession" s LEFT JOIN "ProgramCase" p ON p.id = s."programCaseId" WHERE p.id IS NULL');
    const attachments = await client.query<AttachmentRow>(`
        SELECT a.id, a."programCaseId", a."fileUrl", a."fileType", a."detectedFileType",
          a."detectedMimeType", a."fileSizeBytes", a."checksumSha256", a."extractionStatus"::text,
          a."rawText", a."cleanedText", a."extractorType", a."extractorVersion",
          a."failureCode", a."failureMessage", a."attemptCount", a."lastAttemptedAt",
          a."extractedAt", a."isActive", (p.id IS NOT NULL) AS "programExists"
        FROM "ProgramCaseAttachment" a
        LEFT JOIN "ProgramCase" p ON p.id = a."programCaseId"
        ORDER BY a.id
      `);
    return buildAttachmentVerificationReport(
      attachments.rows,
      programs.rows[0]?.count ?? 0,
      sessions.rows[0]?.count ?? 0,
      orphanSessions.rows[0]?.count ?? 0,
      generatedAt,
    );
  } finally {
    if (began) await client.query('ROLLBACK');
  }
}
