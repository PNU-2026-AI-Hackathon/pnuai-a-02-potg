import { AttachmentExtractionStatus, ProgramCaseAttachment } from '@prisma/client';
import { AttachmentOcrConfig, getAttachmentOcrConfig } from '../../config/attachmentOcr';
import { prisma } from '../../lib/prisma';
import { downloadAttachment } from './attachmentDownloader';
import { AttachmentProcessingError } from './attachmentErrors';
import { detectAttachmentFileType } from './fileTypeDetector';
import { detectPdfRendererAvailability, PdfRendererAvailability } from './pdfPageRenderer';
import { extractPdfText, PdfTextExtractionResult } from './pdfTextExtractor';

export type PdfOcrRunOptions = {
  type: 'PDF_OCR';
  mixedOnly: true;
  limit: 1;
  attachmentId?: string;
  plan: true;
};

type DatabaseSnapshot = {
  programCases: number;
  sessions: number;
  attachments: number;
  activeAttachments: number;
  hwpAttachments: number;
  imageStatuses: Record<string, number>;
  pdfStatuses: Record<string, number>;
  pdfExtractorTypes: Record<string, number>;
};

export type PdfOcrPlanDependencies = {
  select?: (options: PdfOcrRunOptions) => Promise<ProgramCaseAttachment[]>;
  downloader?: typeof downloadAttachment;
  detector?: typeof detectAttachmentFileType;
  extractPdf?: typeof extractPdfText;
  rendererAvailability?: (config: AttachmentOcrConfig) => Promise<PdfRendererAvailability>;
  getConfig?: () => AttachmentOcrConfig;
  snapshot?: () => Promise<DatabaseSnapshot>;
  getRow?: (id: string) => Promise<ProgramCaseAttachment>;
};

const IMAGE_TYPES = ['jpg', 'jpeg', 'png'];
const HWP_TYPES = ['hwp', 'hwpx'];

function statusMap(rows: Array<{ extractionStatus: AttachmentExtractionStatus; _count?: true | { _all?: number } }>) {
  return Object.fromEntries(rows.map((row) => [
    row.extractionStatus,
    typeof row._count === 'object' ? row._count._all ?? 0 : 0,
  ]));
}

function extractorMap(rows: Array<{ extractorType: string | null; _count?: true | { _all?: number } }>) {
  return Object.fromEntries(rows.map((row) => [
    row.extractorType ?? 'NONE',
    typeof row._count === 'object' ? row._count._all ?? 0 : 0,
  ]));
}

async function databaseSnapshot(): Promise<DatabaseSnapshot> {
  const [programCases, sessions, attachments, activeAttachments, hwpAttachments, imageRows, pdfRows, pdfExtractorRows] = await prisma.$transaction([
    prisma.programCase.count(),
    prisma.programCaseSession.count(),
    prisma.programCaseAttachment.count(),
    prisma.programCaseAttachment.count({ where: { isActive: true } }),
    prisma.programCaseAttachment.count({
      where: { OR: HWP_TYPES.map((value) => ({ fileType: { equals: value, mode: 'insensitive' as const } })) },
    }),
    prisma.programCaseAttachment.groupBy({
      by: ['extractionStatus'],
      where: { OR: IMAGE_TYPES.map((value) => ({ fileType: { equals: value, mode: 'insensitive' as const } })) },
      _count: { _all: true },
      orderBy: { extractionStatus: 'asc' },
    }),
    prisma.programCaseAttachment.groupBy({
      by: ['extractionStatus'],
      where: { fileType: { equals: 'pdf', mode: 'insensitive' } },
      _count: { _all: true },
      orderBy: { extractionStatus: 'asc' },
    }),
    prisma.programCaseAttachment.groupBy({
      by: ['extractorType'],
      where: { fileType: { equals: 'pdf', mode: 'insensitive' } },
      _count: { _all: true },
      orderBy: { extractorType: 'asc' },
    }),
  ]);
  return {
    programCases,
    sessions,
    attachments,
    activeAttachments,
    hwpAttachments,
    imageStatuses: statusMap(imageRows),
    pdfStatuses: statusMap(pdfRows),
    pdfExtractorTypes: extractorMap(pdfExtractorRows),
  };
}

function fingerprint(attachment: ProgramCaseAttachment) {
  return {
    extractionStatus: attachment.extractionStatus,
    attemptCount: attachment.attemptCount,
    lastAttemptedAt: attachment.lastAttemptedAt?.toISOString() ?? null,
    rawTextLength: attachment.rawText?.length ?? null,
    cleanedTextLength: attachment.cleanedText?.length ?? null,
    checksumPresent: attachment.checksumSha256 !== null,
    checksumLength: attachment.checksumSha256?.length ?? null,
    extractorType: attachment.extractorType,
    extractorVersion: attachment.extractorVersion,
    failureCode: attachment.failureCode,
    extractedAt: attachment.extractedAt?.toISOString() ?? null,
    updatedAt: attachment.updatedAt.toISOString(),
  };
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function validateCandidates(extraction: PdfTextExtractionResult, maximumPages: number) {
  if (extraction.pageCount < 1) {
    throw new AttachmentProcessingError('PDF_OCR_PAGE_COUNT_INVALID', 'PDF page count is invalid.');
  }
  if (extraction.pageCount > maximumPages) {
    throw new AttachmentProcessingError('PDF_PAGE_LIMIT_EXCEEDED', 'PDF exceeds the configured page limit.');
  }
  const sorted = [...extraction.ocrCandidatePages].sort((left, right) => left - right);
  if (new Set(sorted).size !== sorted.length) {
    throw new AttachmentProcessingError('PDF_OCR_PAGE_NUMBER_DUPLICATED', 'PDF OCR candidate page is duplicated.');
  }
  if (sorted.some((pageNumber) => pageNumber < 1 || pageNumber > extraction.pageCount)) {
    throw new AttachmentProcessingError('PDF_OCR_PAGE_NUMBER_OUT_OF_RANGE', 'PDF OCR candidate page is out of range.');
  }
  return sorted;
}

export async function selectMixedPdfCandidates(options: PdfOcrRunOptions) {
  return prisma.programCaseAttachment.findMany({
    where: {
      ...(options.attachmentId ? { id: options.attachmentId } : {}),
      isActive: true,
      fileType: { equals: 'pdf', mode: 'insensitive' },
      extractionStatus: 'COMPLETED',
      extractorType: 'PDFJS_TEXT_PARTIAL',
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: 1,
  });
}

export async function runPdfOcrPlan(
  options: PdfOcrRunOptions,
  dependencies: PdfOcrPlanDependencies = {},
): Promise<Record<string, unknown>> {
  const selected = await (dependencies.select ?? selectMixedPdfCandidates)(options);
  const config = dependencies.getConfig?.() ?? getAttachmentOcrConfig();
  const renderer = await (dependencies.rendererAvailability ?? detectPdfRendererAvailability)(config);
  if (selected.length === 0) {
    return {
      mode: 'plan', selected: 0, totalPages: 0, pdfJsTextPages: 0, lowDensityPages: 0,
      ocrCandidatePageCount: 0, estimatedRenderCount: 0, estimatedApiCalls: 0,
      rendererConfigured: renderer.configured, rendererAvailable: renderer.available,
      rendererVersionConfigured: renderer.versionConfigured,
      databaseMutation: false, actualApiCalls: 0, download: false, render: false, ocrCall: false,
      temporaryFilesRemaining: 0, jobDirectoriesRemaining: 0,
    };
  }
  if (selected.length !== 1) throw new Error('PDF OCR plan requires exactly one selected attachment.');

  const target = selected[0];
  const snapshot = dependencies.snapshot ?? databaseSnapshot;
  const beforeDatabase = await snapshot();
  const beforeTarget = fingerprint(target);
  let downloaded: Awaited<ReturnType<typeof downloadAttachment>> | undefined;
  const startedAt = Date.now();
  try {
    downloaded = await (dependencies.downloader ?? downloadAttachment)(target.fileUrl, { networkRetries: 0 });
    await (dependencies.detector ?? detectAttachmentFileType)({
      filePath: downloaded.tempFilePath,
      fileName: target.fileName,
      dbFileType: target.fileType,
      responseContentType: downloaded.responseContentType,
      requireExpectedMatch: true,
    });
    const analysisStartedAt = Date.now();
    const extraction = await (dependencies.extractPdf ?? extractPdfText)(downloaded.tempFilePath);
    const analysisDurationMs = Date.now() - analysisStartedAt;
    const candidates = validateCandidates(extraction, config.pdfOcrMaxPages);
    const current = dependencies.getRow
      ? await dependencies.getRow(target.id)
      : await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: target.id } });
    const afterDatabase = await snapshot();
    return {
      mode: 'plan',
      selected: 1,
      totalPages: extraction.pageCount,
      pdfJsTextPages: extraction.pages.filter((page) => page.classification === 'TEXT').length,
      lowDensityPages: extraction.pages.filter((page) => page.classification === 'LOW_DENSITY').length,
      ocrCandidatePageCount: candidates.length,
      candidatePagesInRange: true,
      candidatePagesUnique: true,
      candidatePagesAscending: true,
      allPagesCandidates: candidates.length === extraction.pageCount,
      mixedClassificationConfirmed: extraction.classification === 'MIXED',
      estimatedRenderCount: candidates.length,
      estimatedApiCalls: candidates.length,
      rendererConfigured: renderer.configured,
      rendererAvailable: renderer.available,
      rendererVersionConfigured: renderer.versionConfigured,
      fileBytes: downloaded.byteSize,
      pdfAnalysisDurationMs: analysisDurationMs,
      targetFingerprintUnchanged: same(beforeTarget, fingerprint(current)),
      aggregateCountsUnchanged: same(beforeDatabase, afterDatabase),
      counts: afterDatabase,
      databaseMutation: false,
      actualApiCalls: 0,
      download: true,
      render: false,
      ocrCall: false,
      temporaryFilesRemaining: 0,
      jobDirectoriesRemaining: 0,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await downloaded?.cleanup().catch(() => undefined);
  }
}
