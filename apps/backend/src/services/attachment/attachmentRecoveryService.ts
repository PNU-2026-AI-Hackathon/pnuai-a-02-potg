import { ProgramCaseAttachment } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type RecoveryOptions = {
  type: 'PDF_OCR';
  mixedOnly: true;
  staleAfterMinutes: number;
  limit: number;
  attachmentId?: string;
  mode: 'plan' | 'apply';
};

export type RecoveryDependencies = {
  now?: () => Date;
  selectProcessing?: () => Promise<ProgramCaseAttachment[]>;
  recover?: (row: ProgramCaseAttachment, cutoff: Date) => Promise<number>;
  snapshot?: () => Promise<Record<string, unknown>>;
};

async function selectProcessing(options: RecoveryOptions) {
  return prisma.programCaseAttachment.findMany({
    where: {
      ...(options.attachmentId ? { id: options.attachmentId } : {}),
      fileType: { equals: 'pdf', mode: 'insensitive' },
      extractionStatus: 'PROCESSING',
    },
    orderBy: [{ lastAttemptedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
}

async function snapshot() {
  const [programCases, sessions, attachments, activeAttachments, imageStatuses, pdfStatuses, hwp, pdfExtractors] =
    await Promise.all([
      prisma.programCase.count(), prisma.programCaseSession.count(), prisma.programCaseAttachment.count(),
      prisma.programCaseAttachment.count({ where: { isActive: true } }),
      prisma.programCaseAttachment.groupBy({
        by: ['extractionStatus'],
        where: { OR: ['jpg', 'jpeg', 'png'].map((value) => ({ fileType: { equals: value, mode: 'insensitive' as const } })) },
        _count: { _all: true },
      }),
      prisma.programCaseAttachment.groupBy({
        by: ['extractionStatus'], where: { fileType: { equals: 'pdf', mode: 'insensitive' } }, _count: { _all: true },
      }),
      prisma.programCaseAttachment.count({
        where: { OR: ['hwp', 'hwpx'].map((value) => ({ fileType: { equals: value, mode: 'insensitive' as const } })) },
      }),
      prisma.programCaseAttachment.groupBy({
        by: ['extractorType'], where: { fileType: { equals: 'pdf', mode: 'insensitive' } }, _count: { _all: true },
      }),
    ]);
  const map = (rows: Array<{ _count: { _all: number } } & Record<string, unknown>>, key: string) =>
    Object.fromEntries(rows.map((row) => [String(row[key] ?? 'NONE'), row._count._all]));
  return {
    programCases, sessions, attachments, activeAttachments, hwp,
    imageStatuses: map(imageStatuses, 'extractionStatus'),
    pdfStatuses: map(pdfStatuses, 'extractionStatus'),
    pdfExtractorTypes: map(pdfExtractors, 'extractorType'),
  };
}

async function recover(row: ProgramCaseAttachment, cutoff: Date) {
  const result = await prisma.programCaseAttachment.updateMany({
    where: {
      id: row.id,
      isActive: true,
      fileType: { equals: 'pdf', mode: 'insensitive' },
      extractionStatus: 'PROCESSING',
      extractorType: 'PDFJS_TEXT_PARTIAL',
      rawText: { not: null },
      cleanedText: { not: null },
      failureCode: null,
      failureMessage: null,
      lastAttemptedAt: row.lastAttemptedAt,
      updatedAt: row.updatedAt,
      AND: [{ lastAttemptedAt: { lte: cutoff } }],
    },
    data: { extractionStatus: 'COMPLETED', failureCode: null, failureMessage: null },
  });
  return result.count;
}

export async function runAttachmentRecovery(options: RecoveryOptions, dependencies: RecoveryDependencies = {}) {
  const now = dependencies.now?.() ?? new Date();
  const cutoff = new Date(now.getTime() - options.staleAfterMinutes * 60_000);
  const before = await (dependencies.snapshot ?? snapshot)();
  const rows = await (dependencies.selectProcessing ?? (() => selectProcessing(options)))();
  const stale = rows.filter((row) => row.lastAttemptedAt !== null && row.lastAttemptedAt <= cutoff);
  const eligible = stale.filter((row) =>
    row.isActive && row.extractorType === 'PDFJS_TEXT_PARTIAL' && row.rawText !== null && row.cleanedText !== null
    && row.failureCode === null && row.failureMessage === null);
  const selected = eligible.slice(0, options.limit);
  let recovered = 0;
  let skippedByConcurrency = 0;
  if (options.mode === 'apply') {
    for (const row of selected) {
      const count = await (dependencies.recover ?? recover)(row, cutoff);
      if (count === 1) recovered += 1;
      else skippedByConcurrency += 1;
    }
  }
  const after = await (dependencies.snapshot ?? snapshot)();
  return {
    mode: options.mode,
    type: options.type,
    mixedOnly: true,
    staleAfterMinutes: options.staleAfterMinutes,
    processingTotal: rows.length,
    staleByTime: stale.length,
    eligibleForRecovery: eligible.length,
    selected: selected.length,
    recentProcessingExcluded: rows.filter((row) => row.lastAttemptedAt !== null && row.lastAttemptedAt > cutoff).length,
    missingSnapshotFieldsExcluded: rows.filter((row) =>
      row.lastAttemptedAt === null || row.rawText === null || row.cleanedText === null).length,
    unexpectedExtractorExcluded: rows.filter((row) => row.extractorType !== 'PDFJS_TEXT_PARTIAL').length,
    inactiveExcluded: rows.filter((row) => !row.isActive).length,
    estimatedUpdates: selected.length,
    recovered,
    skippedByConcurrency,
    failed: 0,
    actualUpdates: recovered,
    databaseMutation: recovered > 0,
    aggregateCountsUnchanged: JSON.stringify(before) === JSON.stringify(after),
    counts: after,
    downloadCount: 0,
    renderCount: 0,
    actualOcrApiCalls: 0,
  };
}
