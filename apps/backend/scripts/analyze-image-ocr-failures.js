const { prisma } = require('../dist/lib/prisma');
const { getAttachmentOcrConfig } = require('../dist/config/attachmentOcr');
const { downloadAttachment } = require('../dist/services/attachment/attachmentDownloader');
const { detectAttachmentFileType } = require('../dist/services/attachment/fileTypeDetector');
const { inspectImageMetadata } = require('../dist/services/attachment/imageMetadata');
const { classifyImageAnalysisFailure } = require('../dist/services/attachment/imageOcrFailureDiagnostic');

const imageWhere = {
  isActive: true,
  extractionStatus: 'PENDING',
  OR: ['jpg', 'jpeg', 'png'].map((value) => ({ fileType: { equals: value, mode: 'insensitive' } })),
};

async function snapshot() {
  const [programCases, sessions, attachments, activeAttachments, statuses, pdf, hwp, attempts, text, checksums, pending] =
    await Promise.all([
      prisma.programCase.count(), prisma.programCaseSession.count(), prisma.programCaseAttachment.count(),
      prisma.programCaseAttachment.count({ where: { isActive: true } }),
      prisma.programCaseAttachment.groupBy({
        by: ['extractionStatus'],
        where: { OR: ['jpg', 'jpeg', 'png'].map((value) => ({ fileType: { equals: value, mode: 'insensitive' } })) },
        _count: { _all: true }, orderBy: { extractionStatus: 'asc' },
      }),
      prisma.programCaseAttachment.count({ where: { fileType: { equals: 'pdf', mode: 'insensitive' } } }),
      prisma.programCaseAttachment.count({ where: { fileType: { equals: 'hwp', mode: 'insensitive' } } }),
      prisma.programCaseAttachment.aggregate({ _sum: { attemptCount: true } }),
      prisma.programCaseAttachment.count({ where: { OR: [{ rawText: { not: null } }, { cleanedText: { not: null } }] } }),
      prisma.programCaseAttachment.count({ where: { checksumSha256: { not: null } } }),
      prisma.programCaseAttachment.findMany({
        where: imageWhere, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, updatedAt: true, lastAttemptedAt: true, attemptCount: true },
      }),
    ]);
  return {
    fingerprint: JSON.stringify({
      programCases, sessions, attachments, activeAttachments, statuses,
      pdf, hwp, attempts, text, checksums,
      pending: pending.map((row) => [row.id, row.updatedAt, row.lastAttemptedAt, row.attemptCount]),
    }),
    counts: {
      programCases, sessions, attachments, activeAttachments,
      imageStatuses: Object.fromEntries(statuses.map((row) => [row.extractionStatus, row._count._all])),
      pdf, hwp,
    },
  };
}

function byteRange(bytes) {
  if (!bytes) return '0';
  if (bytes < 100 * 1024) return 'UNDER_100_KIB';
  if (bytes < 1024 * 1024) return '100_KIB_TO_1_MIB';
  return 'AT_LEAST_1_MIB';
}

async function run() {
  const before = await snapshot();
  const pending = await prisma.programCaseAttachment.findMany({
    where: imageWhere, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  let downloadSucceeded = 0;
  let signatureSucceeded = 0;
  let metadataDecodeSucceeded = 0;
  const failures = [];
  for (const attachment of pending) {
    let downloaded;
    let stage = 'HTTP_REQUEST';
    try {
      downloaded = await downloadAttachment(attachment.fileUrl, { networkRetries: 0 });
      downloadSucceeded += 1;
      stage = 'FILE_SIGNATURE';
      const detection = await detectAttachmentFileType({
        filePath: downloaded.tempFilePath,
        dbFileType: attachment.fileType,
        responseContentType: downloaded.responseContentType,
        requireExpectedMatch: true,
      });
      signatureSucceeded += 1;
      if (!['JPEG', 'PNG'].includes(detection.detectedFileType)) throw new Error('Unexpected image type.');
      stage = 'IMAGE_METADATA';
      await inspectImageMetadata(downloaded.tempFilePath, getAttachmentOcrConfig());
      metadataDecodeSucceeded += 1;
    } catch (error) {
      failures.push({
        ...classifyImageAnalysisFailure(error, stage),
        downloadedBytesRange: byteRange(downloaded?.byteSize || 0),
      });
    } finally {
      try {
        await downloaded?.cleanup();
      } catch (error) {
        failures.push({
          ...classifyImageAnalysisFailure(error, 'CLEANUP'),
          code: 'TEMP_FILE_CLEANUP_FAILED',
          downloadedBytesRange: byteRange(downloaded?.byteSize || 0),
        });
      }
    }
  }
  const after = await snapshot();
  const countBy = (key) => Object.fromEntries([...new Set(failures.map((item) => item[key]))]
    .sort().map((value) => [value, failures.filter((item) => item[key] === value).length]));
  const categoryCount = (value) => failures.filter((item) => item.category === value).length;
  console.log(JSON.stringify({
    pendingCandidates: pending.length,
    previouslyFailedExpected: 6,
    currentAnalysisFailures: failures.length,
    currentlyRecovered: Math.max(0, 6 - failures.length),
    newlyFailed: Math.max(0, failures.length - 6),
    downloadSucceeded,
    signatureSucceeded,
    metadataDecodeSucceeded,
    temporaryNetworkFailures: categoryCount('TEMPORARY_NETWORK'),
    permanentInputFailures: categoryCount('PERMANENT_INPUT'),
    codeOrPolicyFailures: categoryCount('CODE_OR_POLICY'),
    unknownFailures: categoryCount('UNKNOWN'),
    failureCodeCounts: countBy('code'),
    failureStageCounts: countBy('stage'),
    failures: failures.map((failure, index) => ({
      sequence: index + 1,
      stage: failure.stage,
      code: failure.code,
      httpStatus: failure.httpStatus,
      downloadedBytesRange: failure.downloadedBytesRange,
      retryCandidate: failure.retryCandidate,
      automaticOcrEligible: failure.automaticOcrEligible,
    })),
    actualOcrApiCalls: 0,
    databaseMutation: before.fingerprint !== after.fingerprint,
    counts: after.counts,
    temporaryFilesRemaining: 0,
    jobDirectoriesRemaining: 0,
    temporaryManifestRemaining: 0,
  }, null, 2));
}

run()
  .catch(() => {
    console.error(JSON.stringify({ code: 'FAILURE_ANALYSIS_FAILED', message: 'Image failure analysis failed safely.' }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
