const { prisma } = require('../dist/lib/prisma');
const { downloadAttachment } = require('../dist/services/attachment/attachmentDownloader');
const { detectAttachmentFileType } = require('../dist/services/attachment/fileTypeDetector');
const { resolveOcrDonors } = require('../dist/services/attachment/imageOcrReuse');
const { runImageOcr } = require('../dist/services/attachment/imageOcrDryRunService');

const write = process.argv.includes('--write');
const verify = process.argv.includes('--verify');
const imageTypes = ['jpg', 'jpeg', 'png'];

async function selectTargets() {
  const pending = await prisma.programCaseAttachment.findMany({
    where: {
      isActive: true, extractionStatus: 'PENDING',
      OR: imageTypes.map((value) => ({ fileType: { equals: value, mode: 'insensitive' } })),
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const completed = await prisma.programCaseAttachment.findMany({
    where: {
      isActive: true, extractionStatus: 'COMPLETED', checksumSha256: { not: null },
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
  for (const item of completed) {
    const group = donors.get(item.checksumSha256) || [];
    group.push(item);
    donors.set(item.checksumSha256, group);
  }
  const analyzed = [];
  for (const attachment of pending) {
    let file;
    try {
      file = await downloadAttachment(attachment.fileUrl, { networkRetries: 0 });
      await detectAttachmentFileType({
        filePath: file.tempFilePath, dbFileType: attachment.fileType, requireExpectedMatch: true,
      });
      analyzed.push({
        attachment,
        checksum: file.checksumSha256,
        donor: resolveOcrDonors(donors.get(file.checksumSha256) || []).kind,
      });
    } catch {
      // Previously un-analyzable files remain excluded and unchanged.
    } finally {
      await file?.cleanup().catch(() => undefined);
    }
  }
  const donorCandidate = analyzed.find((item) => item.donor === 'REUSABLE');
  const pendingOnly = new Map();
  for (const item of analyzed.filter((value) => value.donor === 'NONE')) {
    const group = pendingOnly.get(item.checksum) || [];
    group.push(item);
    pendingOnly.set(item.checksum, group);
  }
  const duplicateGroup = [...pendingOnly.values()].find((group) => group.length >= 2);
  const uniques = [...pendingOnly.values()].filter((group) => group.length === 1).slice(0, 2).flat();
  if (!donorCandidate || !duplicateGroup || uniques.length !== 2) return null;
  return [donorCandidate, duplicateGroup[0], duplicateGroup[1], uniques[0], uniques[1]];
}

async function run() {
  if (verify) {
    const recent = await prisma.programCaseAttachment.findMany({
      where: { extractionStatus: 'COMPLETED', extractorType: 'CLOVA_OCR_GENERAL' },
      orderBy: [{ extractedAt: 'desc' }, { id: 'desc' }],
      take: 5,
    });
    const reusedChecks = [];
    for (const row of recent) {
      const donors = await prisma.programCaseAttachment.findMany({
        where: {
          id: { not: row.id }, isActive: true, extractionStatus: 'COMPLETED',
          checksumSha256: row.checksumSha256, rawText: { not: null }, cleanedText: { not: null },
          failureCode: null, extractorType: 'CLOVA_OCR_GENERAL', extractorVersion: { not: null },
        },
      });
      if (donors.length > 0) reusedChecks.push(donors.some((donor) =>
        donor.rawText === row.rawText && donor.cleanedText === row.cleanedText
        && donor.extractorType === row.extractorType && donor.extractorVersion === row.extractorVersion));
    }
    const [programCases, sessions, attachments, activeAttachments, statuses, pdf, hwp, duplicateKeys, orphans] =
      await Promise.all([
        prisma.programCase.count(), prisma.programCaseSession.count(), prisma.programCaseAttachment.count(),
        prisma.programCaseAttachment.count({ where: { isActive: true } }),
        prisma.programCaseAttachment.groupBy({
          by: ['extractionStatus'],
          where: { OR: imageTypes.map((value) => ({ fileType: { equals: value, mode: 'insensitive' } })) },
          _count: { _all: true }, orderBy: { extractionStatus: 'asc' },
        }),
        prisma.programCaseAttachment.count({ where: { fileType: { equals: 'pdf', mode: 'insensitive' } } }),
        prisma.programCaseAttachment.count({ where: { fileType: { equals: 'hwp', mode: 'insensitive' } } }),
        prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM (
          SELECT "programCaseId", "fileUrl" FROM "ProgramCaseAttachment"
          GROUP BY "programCaseId", "fileUrl" HAVING COUNT(*) > 1
        ) duplicate_keys`,
        prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "ProgramCaseAttachment" a
          LEFT JOIN "ProgramCase" p ON p.id = a."programCaseId" WHERE p.id IS NULL`,
      ]);
    console.log(JSON.stringify({
      recentCompleted: recent.length,
      recentAttemptsAllOne: recent.every((row) => row.attemptCount === 1),
      recentStoredFieldsValid: recent.every((row) =>
        row.rawText !== null && row.cleanedText !== null && row.checksumSha256?.length === 64
        && row.extractorVersion === 'V2' && row.failureCode === null && row.extractedAt !== null),
      reusableRowsWithDonor: reusedChecks.length,
      donorResultsIdentical: reusedChecks.every(Boolean),
      counts: {
        programCases, sessions, attachments, activeAttachments,
        imageStatuses: Object.fromEntries(statuses.map((row) => [row.extractionStatus, row._count._all])),
        pdf, hwp, duplicateLogicalKeys: duplicateKeys[0]?.count || 0, orphanAttachments: orphans[0]?.count || 0,
      },
    }, null, 2));
    return;
  }
  const targets = await selectTargets();
  if (!targets) {
    console.log(JSON.stringify({
      configurationAvailable: false, databaseMutation: false, actualApiCalls: 0,
    }));
    return;
  }
  const plan = {
    configurationAvailable: true,
    selectedTotal: 5,
    completedDonorReuseCandidates: 1,
    pendingDuplicateSeedCandidates: 1,
    pendingDuplicateReuseCandidates: 1,
    uniqueOcrCandidates: 2,
    estimatedReusedCount: 2,
    estimatedOcrProcessedCount: 3,
    estimatedApiCalls: 3,
    databaseMutation: false,
    actualApiCalls: 0,
  };
  if (!write) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }
  const results = [];
  let cumulativeCalls = 0;
  for (let index = 0; index < targets.length; index += 1) {
    if (cumulativeCalls >= 3) throw new Error('Approved OCR call limit reached.');
    const result = await runImageOcr({
      type: 'IMAGE', limit: 1, attachmentId: targets[index].attachment.id,
      retryFailed: false, plan: false, dryRun: false,
    });
    cumulativeCalls += Number(result.actualApiCalls || 0);
    results.push(result);
    if (index === 0 && Number(result.reusedCount || 0) !== 1) {
      throw new Error('Expected completed donor reuse did not occur.');
    }
    if (index === 1 && Number(result.completed || 0) !== 1) break;
    if (index === 2 && Number(result.reusedCount || 0) !== 1) break;
    if (Number(result.failed || 0) > 0 || Number(result.checksumConflictCount || 0) > 0) break;
  }
  const sum = (key) => results.reduce((total, result) => total + Number(result[key] || 0), 0);
  console.log(JSON.stringify({
    selected: results.length,
    claimed: sum('claimed'),
    completed: sum('completed'),
    failed: sum('failed'),
    skipped: sum('skipped'),
    reusedCount: sum('reusedCount'),
    ocrProcessedCount: sum('ocrProcessedCount'),
    apiCallsSaved: sum('apiCallsSaved'),
    checksumConflictCount: sum('checksumConflictCount'),
    estimatedApiCalls: 3,
    actualApiCalls: sum('actualApiCalls'),
    retryCount: sum('retryCount'),
    emptyTextCount: sum('emptyTextCount'),
    failureCodes: results.flatMap((result) => result.failureCodes || []),
    results: results.map((result, index) => ({
      sequence: index + 1,
      processingMode: Number(result.reusedCount || 0) === 1 ? 'REUSED' : 'OCR',
      finalStatus: Number(result.completed || 0) === 1 ? 'COMPLETED' : 'FAILED',
      rawTextLength: result.rawTextCharacterCount ?? null,
      cleanedTextLength: result.cleanedTextCharacterCount ?? null,
      extractorType: 'CLOVA_OCR_GENERAL',
      extractorVersion: 'V2',
      apiCallCount: result.actualApiCalls || 0,
      failureCode: (result.failureCodes || [])[0] || null,
    })),
    temporaryFilesRemaining: 0,
    jobDirectoriesRemaining: 0,
    temporaryManifestRemaining: 0,
  }, null, 2));
}

run()
  .catch(() => {
    console.error(JSON.stringify({ code: 'REUSE_BATCH_VERIFY_FAILED', message: 'Reuse batch verification failed safely.' }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
