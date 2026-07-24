import { AttachmentExtractionStatus, ProgramCaseAttachment } from '@prisma/client';
import path from 'path';
import { AttachmentOcrConfig, getAttachmentOcrConfig } from '../../config/attachmentOcr';
import { prisma } from '../../lib/prisma';
import { downloadAttachment } from './attachmentDownloader';
import { AttachmentProcessingError } from './attachmentErrors';
import { detectAttachmentFileType } from './fileTypeDetector';
import { detectPdfRendererAvailability, PdfRendererAvailability } from './pdfPageRenderer';
import { renderPdfPage } from './pdfPageRenderer';
import { extractPdfText, PdfTextExtractionResult } from './pdfTextExtractor';
import { inspectImageMetadata } from './imageMetadata';

type PdfOcrBaseOptions = {
  type: 'PDF_OCR';
  mixedOnly: true;
  limit: 1;
  attachmentId?: string;
};

export type PdfOcrRunOptions =
  | (PdfOcrBaseOptions & { plan: true; renderDryRun: false })
  | (PdfOcrBaseOptions & { plan: false; renderDryRun: true });

type DatabaseSnapshot = {
  programCases: number;
  sessions: number;
  attachments: number;
  activeAttachments: number;
  hwpAttachments: number;
  imageStatuses: Record<string, number>;
  pdfStatuses: Record<string, number>;
  pdfExtractorTypes: Record<string, number>;
  duplicateLogicalKeys: number;
  orphanAttachments: number;
};

export type PdfOcrPlanDependencies = {
  select?: (options: PdfOcrRunOptions) => Promise<ProgramCaseAttachment[]>;
  downloader?: typeof downloadAttachment;
  detector?: typeof detectAttachmentFileType;
  extractPdf?: typeof extractPdfText;
  rendererAvailability?: (config: AttachmentOcrConfig) => Promise<PdfRendererAvailability>;
  renderPage?: typeof renderPdfPage;
  inspectMetadata?: typeof inspectImageMetadata;
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
  const [programCases, sessions, attachments, activeAttachments, hwpAttachments, imageRows, pdfRows, pdfExtractorRows, duplicateRows, orphanRows] = await Promise.all([
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
    prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM (
      SELECT "programCaseId", "fileUrl" FROM "ProgramCaseAttachment"
      GROUP BY "programCaseId", "fileUrl" HAVING COUNT(*) > 1
    ) duplicate_keys`,
    prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM "ProgramCaseAttachment" a
      LEFT JOIN "ProgramCase" p ON p.id = a."programCaseId" WHERE p.id IS NULL`,
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
    duplicateLogicalKeys: duplicateRows[0]?.count ?? 0,
    orphanAttachments: orphanRows[0]?.count ?? 0,
  };
}

function fingerprint(attachment: ProgramCaseAttachment) {
  return {
    extractionStatus: attachment.extractionStatus,
    attemptCount: attachment.attemptCount,
    lastAttemptedAt: attachment.lastAttemptedAt?.toISOString() ?? null,
    rawTextLength: attachment.rawText?.length ?? null,
    cleanedTextLength: attachment.cleanedText?.length ?? null,
    detectedFileType: attachment.detectedFileType,
    detectedMimeType: attachment.detectedMimeType,
    fileSizeBytes: attachment.fileSizeBytes,
    checksumPresent: attachment.checksumSha256 !== null,
    checksumLength: attachment.checksumSha256?.length ?? null,
    extractorType: attachment.extractorType,
    extractorVersion: attachment.extractorVersion,
    failureCode: attachment.failureCode,
    failureMessagePresent: attachment.failureMessage !== null,
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
      rendererVersion: renderer.version,
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
      rendererVersion: renderer.version,
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

export async function runPdfOcrRenderDryRun(
  options: PdfOcrRunOptions & { renderDryRun: true },
  dependencies: PdfOcrPlanDependencies = {},
): Promise<Record<string, unknown>> {
  const config = dependencies.getConfig?.() ?? getAttachmentOcrConfig();
  const renderer = await (dependencies.rendererAvailability ?? detectPdfRendererAvailability)(config);
  if (!renderer.available) {
    throw new AttachmentProcessingError('PDF_RENDERER_UNAVAILABLE', 'PDF renderer is unavailable.');
  }
  if (!renderer.versionConfigured || !renderer.version) {
    throw new AttachmentProcessingError('PDF_RENDERER_VERSION_FAILED', 'PDF renderer version could not be verified.');
  }
  const selected = await (dependencies.select ?? selectMixedPdfCandidates)(options);
  if (selected.length === 0) {
    return {
      mode: 'render-dry-run', selected: 0,
      rendererConfigured: renderer.configured, rendererAvailable: renderer.available,
      rendererVersionDetected: renderer.versionConfigured, rendererVersion: renderer.version,
      renderAttempted: 0, renderSucceeded: 0, actualOcrApiCalls: 0, databaseMutation: false,
      downloadCount: 0, temporaryFilesRemaining: 0, renderedFilesRemaining: 0,
      ocrInputFilesRemaining: 0, jobDirectoriesRemaining: 0, temporaryManifestRemaining: 0,
    };
  }
  if (selected.length !== 1) throw new Error('PDF OCR render dry-run requires exactly one selected attachment.');

  const target = selected[0];
  const snapshot = dependencies.snapshot ?? databaseSnapshot;
  const beforeDatabase = await snapshot();
  const beforeTarget = fingerprint(target);
  let downloaded: Awaited<ReturnType<typeof downloadAttachment>> | undefined;
  let rendered: Awaited<ReturnType<typeof renderPdfPage>> | undefined;
  let renderAttempted = 0;
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
    const extraction = await (dependencies.extractPdf ?? extractPdfText)(downloaded.tempFilePath);
    const candidates = validateCandidates(extraction, config.pdfOcrMaxPages);
    if (extraction.classification !== 'MIXED' || candidates.length === 0) {
      throw new AttachmentProcessingError('PDF_OCR_CANDIDATE_MISSING', 'MIXED PDF OCR candidate page is missing.');
    }
    if (candidates.length !== 1) {
      throw new AttachmentProcessingError('PDF_OCR_CANDIDATE_INVALID', 'Render dry-run requires exactly one OCR candidate page.');
    }
    renderAttempted = 1;
    const renderStartedAt = Date.now();
    rendered = await (dependencies.renderPage ?? renderPdfPage)({
      pdfPath: downloaded.tempFilePath,
      pageNumber: candidates[0],
      pageCount: extraction.pageCount,
      workDirectory: path.dirname(downloaded.tempFilePath),
    }, config);
    const renderDurationMs = Date.now() - renderStartedAt;
    const metadata = await (dependencies.inspectMetadata ?? inspectImageMetadata)(rendered.filePath, config);
    const current = dependencies.getRow
      ? await dependencies.getRow(target.id)
      : await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: target.id } });
    const afterDatabase = await snapshot();
    return {
      mode: 'render-dry-run',
      selected: 1,
      totalPages: extraction.pageCount,
      pdfJsTextPages: extraction.pages.filter((page) => page.classification === 'TEXT').length,
      lowDensityPages: extraction.pages.filter((page) => page.classification === 'LOW_DENSITY').length,
      ocrCandidatePageCount: candidates.length,
      candidateValidation: { inRange: true, unique: true, ascending: true },
      mixedClassificationConfirmed: true,
      rendererConfigured: renderer.configured,
      rendererAvailable: renderer.available,
      rendererVersionDetected: renderer.versionConfigured,
      rendererVersion: renderer.version,
      rendererDpi: config.pdfRenderDpi,
      rendererTimeoutMs: config.pdfRenderTimeoutMs,
      rendererMaxPages: config.pdfOcrMaxPages,
      rendererMaxOutputBytes: config.pdfRenderMaxBytes,
      downloadCount: 1,
      renderAttempted,
      renderSucceeded: 1,
      renderedFormat: metadata.format.toUpperCase(),
      renderedWidth: metadata.width,
      renderedHeight: metadata.height,
      renderedBytes: rendered.byteSize,
      renderDurationMs,
      actualOcrApiCalls: 0,
      databaseMutation: false,
      processingClaimed: false,
      attemptIncremented: false,
      targetFingerprintUnchanged: same(beforeTarget, fingerprint(current)),
      aggregateCountsUnchanged: same(beforeDatabase, afterDatabase),
      counts: afterDatabase,
      temporaryFilesRemaining: 0,
      renderedFilesRemaining: 0,
      ocrInputFilesRemaining: 0,
      jobDirectoriesRemaining: 0,
      temporaryManifestRemaining: 0,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await rendered?.cleanup().catch(() => undefined);
    await downloaded?.cleanup().catch(() => undefined);
  }
}
