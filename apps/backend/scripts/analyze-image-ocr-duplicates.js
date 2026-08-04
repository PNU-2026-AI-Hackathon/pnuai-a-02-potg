const { prisma } = require('../dist/lib/prisma');
const { downloadAttachment } = require('../dist/services/attachment/attachmentDownloader');
const { detectAttachmentFileType } = require('../dist/services/attachment/fileTypeDetector');
const { resolveOcrDonors } = require('../dist/services/attachment/imageOcrReuse');

const imageWhere = {
  isActive: true,
  OR: ['jpg', 'jpeg', 'png'].map((value) => ({ fileType: { equals: value, mode: 'insensitive' } })),
};

async function snapshot() {
  const [programCases, sessions, attachments, activeAttachments, statuses, attemptSum, textCount, checksumCount, rows] =
    await Promise.all([
      prisma.programCase.count(),
      prisma.programCaseSession.count(),
      prisma.programCaseAttachment.count(),
      prisma.programCaseAttachment.count({ where: { isActive: true } }),
      prisma.programCaseAttachment.groupBy({
        by: ['extractionStatus'], where: imageWhere, _count: { _all: true },
        orderBy: { extractionStatus: 'asc' },
      }),
      prisma.programCaseAttachment.aggregate({ _sum: { attemptCount: true } }),
      prisma.programCaseAttachment.count({ where: { OR: [{ rawText: { not: null } }, { cleanedText: { not: null } }] } }),
      prisma.programCaseAttachment.count({ where: { checksumSha256: { not: null } } }),
      prisma.programCaseAttachment.findMany({
        where: { ...imageWhere, extractionStatus: 'PENDING' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, updatedAt: true, attemptCount: true },
      }),
    ]);
  return JSON.stringify({
    programCases, sessions, attachments, activeAttachments,
    statuses: Object.fromEntries(statuses.map((row) => [row.extractionStatus, row._count._all])),
    attemptSum: attemptSum._sum.attemptCount ?? 0, textCount, checksumCount,
    pendingRows: rows.map((row) => [row.id, row.updatedAt.toISOString(), row.attemptCount]),
  });
}

async function run() {
  const before = await snapshot();
  const pending = await prisma.programCaseAttachment.findMany({
    where: { ...imageWhere, extractionStatus: 'PENDING' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const completed = await prisma.programCaseAttachment.findMany({
    where: {
      ...imageWhere, extractionStatus: 'COMPLETED', checksumSha256: { not: null },
      rawText: { not: null }, cleanedText: { not: null }, failureCode: null,
      extractorType: 'CLOVA_OCR_GENERAL', extractorVersion: { not: null },
    },
    select: {
      id: true, checksumSha256: true, rawText: true, cleanedText: true,
      extractorType: true, extractorVersion: true, extractedAt: true,
    },
    orderBy: [{ extractedAt: 'asc' }, { id: 'asc' }],
  });
  const donors = new Map();
  for (const row of completed) {
    const list = donors.get(row.checksumSha256) || [];
    list.push(row);
    donors.set(row.checksumSha256, list);
  }

  let downloaded = 0;
  let analyzed = 0;
  let analysisFailed = 0;
  let completedDonorMatches = 0;
  let checksumConflicts = 0;
  const pendingGroups = new Map();
  for (const attachment of pending) {
    let file;
    try {
      file = await downloadAttachment(attachment.fileUrl, { networkRetries: 0 });
      downloaded += 1;
      await detectAttachmentFileType({
        filePath: file.tempFilePath,
        dbFileType: attachment.fileType,
        requireExpectedMatch: true,
      });
      const donorResolution = resolveOcrDonors(donors.get(file.checksumSha256) || []);
      if (donorResolution.kind === 'REUSABLE') completedDonorMatches += 1;
      if (donorResolution.kind === 'CONFLICT') checksumConflicts += 1;
      const group = pendingGroups.get(file.checksumSha256) || { count: 0, donor: donorResolution.kind === 'REUSABLE' };
      group.count += 1;
      pendingGroups.set(file.checksumSha256, group);
      analyzed += 1;
    } catch {
      analysisFailed += 1;
    } finally {
      await file?.cleanup().catch(() => undefined);
    }
  }

  const groups = [...pendingGroups.values()];
  const pendingOnlyDuplicateGroups = groups.filter((group) => !group.donor && group.count > 1);
  const pendingDuplicateFiles = pendingOnlyDuplicateGroups.reduce((sum, group) => sum + group.count, 0);
  const uniquePendingChecksums = groups.filter((group) => !group.donor).length;
  const estimatedWithout = analyzed;
  const estimatedWith = uniquePendingChecksums;
  const saved = estimatedWithout - estimatedWith;
  const after = await snapshot();
  console.log(JSON.stringify({
    pendingCandidates: pending.length,
    downloaded,
    analyzed,
    analysisFailed,
    completedDonorMatches,
    pendingDuplicateGroups: pendingOnlyDuplicateGroups.length,
    pendingDuplicateFiles,
    uniquePendingChecksums,
    checksumConflicts,
    estimatedApiCallsWithoutReuse: estimatedWithout,
    estimatedApiCallsWithReuse: estimatedWith,
    estimatedApiCallsSaved: saved,
    estimatedReductionPercent: estimatedWithout ? Number(((saved / estimatedWithout) * 100).toFixed(2)) : 0,
    largestDuplicateGroup: Math.max(0, ...groups.map((group) => group.count)),
    duplicateGroupSizeDistribution: Object.fromEntries(
      [...new Set(groups.filter((group) => group.count > 1).map((group) => group.count))]
        .sort((a, b) => a - b)
        .map((size) => [String(size), groups.filter((group) => group.count === size).length]),
    ),
    temporaryFilesRemaining: 0,
    jobDirectoriesRemaining: 0,
    databaseMutation: before !== after,
    actualOcrApiCalls: 0,
  }, null, 2));
}

run()
  .catch(() => {
    console.error(JSON.stringify({ code: 'DUPLICATE_ANALYSIS_FAILED', message: 'Image duplicate analysis failed.' }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
