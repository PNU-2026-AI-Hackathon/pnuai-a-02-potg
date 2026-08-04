const { prisma } = require('../dist/lib/prisma');
const { runImageOcr } = require('../dist/services/attachment/imageOcrDryRunService');

async function run() {
  const completedRows = await prisma.programCaseAttachment.findMany({
    where: { isActive: true, extractionStatus: 'COMPLETED', extractorType: 'CLOVA_OCR_GENERAL' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (completedRows.length === 0) throw new Error('No completed image OCR rows.');
  const completed = completedRows[0];
  const [programCases, sessions, attachments, activeAttachments, imageStatuses, pdfCount, hwpCount, duplicates, orphans] =
    await Promise.all([
      prisma.programCase.count(),
      prisma.programCaseSession.count(),
      prisma.programCaseAttachment.count(),
      prisma.programCaseAttachment.count({ where: { isActive: true } }),
      prisma.programCaseAttachment.groupBy({
        by: ['extractionStatus'],
        where: { OR: ['jpg', 'jpeg', 'png'].map((value) => ({ fileType: { equals: value, mode: 'insensitive' } })) },
        _count: { _all: true },
        orderBy: { extractionStatus: 'asc' },
      }),
      prisma.programCaseAttachment.count({ where: { fileType: { equals: 'pdf', mode: 'insensitive' } } }),
      prisma.programCaseAttachment.count({ where: { fileType: { equals: 'hwp', mode: 'insensitive' } } }),
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM (
          SELECT "programCaseId", "fileUrl"
          FROM "ProgramCaseAttachment"
          GROUP BY "programCaseId", "fileUrl"
          HAVING COUNT(*) > 1
        ) duplicate_keys
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM "ProgramCaseAttachment" attachment
        LEFT JOIN "ProgramCase" program ON program.id = attachment."programCaseId"
        WHERE program.id IS NULL
      `,
    ]);
  const sameTargetPlan = await runImageOcr({
    type: 'IMAGE', limit: 1, attachmentId: completed.id,
    retryFailed: false, plan: true, dryRun: false,
  });
  console.log(JSON.stringify({
    stored: {
      statusCompleted: completed.extractionStatus === 'COMPLETED',
      attemptCount: completed.attemptCount,
      lastAttemptedAtPresent: completed.lastAttemptedAt !== null,
      rawTextPresent: completed.rawText !== null,
      rawTextLength: completed.rawText?.length ?? null,
      cleanedTextPresent: completed.cleanedText !== null,
      cleanedTextLength: completed.cleanedText?.length ?? null,
      detectedFileTypePresent: completed.detectedFileType !== null,
      detectedMimeTypePresent: completed.detectedMimeType !== null,
      fileSizePresent: completed.fileSizeBytes !== null,
      checksumPresent: completed.checksumSha256 !== null,
      checksumLength: completed.checksumSha256?.length ?? null,
      extractorType: completed.extractorType,
      extractorVersion: completed.extractorVersion,
      failureCodeNull: completed.failureCode === null,
      failureMessageNull: completed.failureMessage === null,
      extractedAtPresent: completed.extractedAt !== null,
    },
    completedRows: completedRows.map((row, index) => ({
      sequence: index + 1,
      attemptCount: row.attemptCount,
      rawTextPresent: row.rawText !== null,
      rawTextLength: row.rawText?.length ?? null,
      cleanedTextPresent: row.cleanedText !== null,
      cleanedTextLength: row.cleanedText?.length ?? null,
      detectedFileType: row.detectedFileType,
      detectedMimeType: row.detectedMimeType,
      fileSizeBytes: row.fileSizeBytes,
      checksumLength: row.checksumSha256?.length ?? null,
      extractorType: row.extractorType,
      extractorVersion: row.extractorVersion,
      failureCode: row.failureCode,
      lastAttemptedAtPresent: row.lastAttemptedAt !== null,
      extractedAtPresent: row.extractedAt !== null,
    })),
    counts: {
      programCases, sessions, attachments, activeAttachments,
      imageStatuses: Object.fromEntries(imageStatuses.map((row) => [row.extractionStatus, row._count._all])),
      pdfCount, hwpCount,
      duplicateLogicalKeys: duplicates[0]?.count ?? 0,
      orphanAttachments: orphans[0]?.count ?? 0,
    },
    completedTargetPlan: {
      selected: sameTargetPlan.selected,
      estimatedApiCalls: sameTargetPlan.estimatedApiCalls,
      actualApiCalls: sameTargetPlan.actualApiCalls,
    },
  }, null, 2));
}

run()
  .catch((error) => {
    console.error({ code: error?.code ?? 'VERIFY_FAILED', message: 'Image OCR write verification failed.' });
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
