import { AttachmentExtractionStatus, ProgramCaseAttachment } from '@prisma/client';
import path from 'path';
import { AttachmentOcrConfig, getAttachmentOcrConfig } from '../../config/attachmentOcr';
import {
  clovaOcrConfigSummary, ClovaOcrConfig, getClovaOcrConfig, validateClovaOcrExecutionConfig,
} from '../../config/clovaOcr';
import { prisma } from '../../lib/prisma';
import { downloadAttachment } from './attachmentDownloader';
import { AttachmentProcessingError } from './attachmentErrors';
import { detectAttachmentFileType } from './fileTypeDetector';
import { detectPdfRendererAvailability, PdfRendererAvailability } from './pdfPageRenderer';
import { renderPdfPage } from './pdfPageRenderer';
import { extractPdfText, PdfTextExtractionResult } from './pdfTextExtractor';
import { inspectImageMetadata } from './imageMetadata';
import { createClovaOcrEngine } from './clovaOcrClient';
import { processImageForOcr } from './imageOcrProcessor';
import { mergePdfOcrPages } from './pdfOcrMerger';
import { cleanExtractedText } from './pdfTextExtractor';

type PdfOcrBaseOptions = {
  type: 'PDF_OCR';
  mixedOnly: true;
  limit: 1;
  attachmentId?: string;
};

export type PdfOcrRunOptions =
  | (PdfOcrBaseOptions & { plan: true; renderDryRun: false })
  | (PdfOcrBaseOptions & { plan: false; renderDryRun: true })
  | (PdfOcrBaseOptions & { plan: false; renderDryRun: false; ocrDryRun: true });

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
  processImage?: typeof processImageForOcr;
  createEngine?: typeof createClovaOcrEngine;
  getClovaConfig?: () => ClovaOcrConfig;
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

export async function runPdfOcrDryRun(
  options: PdfOcrRunOptions & { ocrDryRun: true },
  dependencies: PdfOcrPlanDependencies = {},
): Promise<Record<string, unknown>> {
  const config = dependencies.getConfig?.() ?? getAttachmentOcrConfig();
  const renderer = await (dependencies.rendererAvailability ?? detectPdfRendererAvailability)(config);
  if (!renderer.available) throw new AttachmentProcessingError('PDF_RENDERER_UNAVAILABLE', 'PDF renderer is unavailable.');
  if (!renderer.versionConfigured || !renderer.version) {
    throw new AttachmentProcessingError('PDF_RENDERER_VERSION_FAILED', 'PDF renderer version could not be verified.');
  }
  const clovaConfig = { ...(dependencies.getClovaConfig?.() ?? getClovaOcrConfig()), maxRetries: 0 };
  validateClovaOcrExecutionConfig(clovaConfig);
  const clovaPreflight = clovaOcrConfigSummary(clovaConfig);
  const selected = await (dependencies.select ?? selectMixedPdfCandidates)(options);
  if (selected.length !== 1) {
    throw new AttachmentProcessingError('PDF_OCR_CANDIDATE_MISSING', 'Exactly one MIXED PDF is required.');
  }

  const target = selected[0];
  const snapshot = dependencies.snapshot ?? databaseSnapshot;
  const beforeDatabase = await snapshot();
  const beforeTarget = fingerprint(target);
  let downloaded: Awaited<ReturnType<typeof downloadAttachment>> | undefined;
  let rendered: Awaited<ReturnType<typeof renderPdfPage>> | undefined;
  try {
    downloaded = await (dependencies.downloader ?? downloadAttachment)(target.fileUrl, { networkRetries: 0 });
    await (dependencies.detector ?? detectAttachmentFileType)({
      filePath: downloaded.tempFilePath, fileName: target.fileName, dbFileType: target.fileType,
      responseContentType: downloaded.responseContentType, requireExpectedMatch: true,
    });
    const extraction = await (dependencies.extractPdf ?? extractPdfText)(downloaded.tempFilePath);
    const candidates = validateCandidates(extraction, config.pdfOcrMaxPages);
    if (extraction.classification !== 'MIXED' || candidates.length !== 1 || candidates.length === extraction.pageCount) {
      throw new AttachmentProcessingError('PDF_OCR_CANDIDATE_INVALID', 'OCR dry-run requires one MIXED PDF candidate page.');
    }
    const renderStartedAt = Date.now();
    rendered = await (dependencies.renderPage ?? renderPdfPage)({
      pdfPath: downloaded.tempFilePath, pageNumber: candidates[0], pageCount: extraction.pageCount,
      workDirectory: path.dirname(downloaded.tempFilePath),
    }, config);
    const renderDurationMs = Date.now() - renderStartedAt;
    const renderedMetadata = await (dependencies.inspectMetadata ?? inspectImageMetadata)(rendered.filePath, config);
    const ocr = await (dependencies.processImage ?? processImageForOcr)({
      sourcePath: rendered.filePath,
      workDirectory: path.dirname(rendered.filePath),
      expectedType: 'PNG',
      ocrEngine: (dependencies.createEngine ?? createClovaOcrEngine)(clovaConfig),
    }, config);
    if (ocr.apiCallCount > 1 || ocr.retryCount !== 0) {
      throw new AttachmentProcessingError('CLOVA_OCR_REQUEST_FAILED', 'OCR dry-run exceeded its call policy.');
    }
    const pdfJsPages = extraction.pages.map((page) => ({
      pageNumber: page.pageNumber, source: 'PDFJS_TEXT' as const,
      rawText: page.text, cleanedText: cleanExtractedText(page.text),
    }));
    const merged = mergePdfOcrPages({
      pageCount: extraction.pageCount,
      pdfJsPages,
      ocrCandidatePages: candidates,
      ocrPages: [{
        pageNumber: candidates[0], source: 'CLOVA_OCR',
        rawText: ocr.rawText, cleanedText: ocr.cleanedText,
        fieldCount: ocr.fieldCount, averageConfidence: ocr.averageConfidence,
        readingOrderStrategy: ocr.readingOrderStrategy,
      }],
    });
    const candidateSet = new Set(candidates);
    const nonCandidates = pdfJsPages.filter((page) => !candidateSet.has(page.pageNumber));
    const mergedNonCandidates = merged.pages.filter((page) => !candidateSet.has(page.pageNumber));
    const nonCandidateRawPagesUnchanged = nonCandidates.every((page, index) =>
      page.pageNumber === mergedNonCandidates[index]?.pageNumber && page.rawText === mergedNonCandidates[index]?.rawText);
    const nonCandidateCleanedPagesUnchanged = nonCandidates.every((page, index) =>
      page.pageNumber === mergedNonCandidates[index]?.pageNumber && page.cleanedText === mergedNonCandidates[index]?.cleanedText);
    const markers = [...merged.rawText.matchAll(/\[Page (\d+)\]/g)].map((match) => Number(match[1]));
    const expectedMarkers = Array.from({ length: extraction.pageCount }, (_, index) => index + 1);
    const duplicatePageMarkers = markers.length - new Set(markers).size;
    const missingPageMarkers = expectedMarkers.filter((pageNumber) => !markers.includes(pageNumber)).length;
    const qualityWarnings = [
      ...(ocr.isEmpty ? ['OCR_EMPTY_TEXT'] : []),
      ...(ocr.fieldCount === 0 ? ['OCR_FIELD_COUNT_ZERO'] : []),
      ...(ocr.averageConfidence !== undefined && ocr.averageConfidence < 0.7 ? ['OCR_LOW_CONFIDENCE'] : []),
      ...(ocr.cleanedText.length === 0 ? ['OCR_CLEANED_TEXT_EMPTY'] : []),
      ...(markers.length !== extraction.pageCount ? ['PDF_PAGE_MARKER_COUNT_INVALID'] : []),
      ...(!nonCandidateRawPagesUnchanged || !nonCandidateCleanedPagesUnchanged ? ['PDF_NONCANDIDATE_CHANGED'] : []),
    ];
    const current = dependencies.getRow
      ? await dependencies.getRow(target.id)
      : await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: target.id } });
    const afterDatabase = await snapshot();
    return {
      mode: 'ocr-dry-run', selected: 1,
      totalPages: extraction.pageCount,
      pdfJsTextPages: extraction.pages.filter((page) => page.classification === 'TEXT').length,
      lowDensityPages: extraction.pages.filter((page) => page.classification === 'LOW_DENSITY').length,
      ocrCandidatePageCount: candidates.length,
      candidateValidation: { inRange: true, unique: true, ascending: true },
      rendererConfigured: renderer.configured, rendererAvailable: renderer.available,
      rendererVersionDetected: renderer.versionConfigured, rendererVersion: renderer.version,
      clovaEnabled: clovaPreflight.enabled,
      clovaInvokeUrlConfigured: clovaPreflight.invokeUrlConfigured,
      clovaSecretConfigured: clovaPreflight.secretConfigured,
      clovaTimeoutMs: clovaPreflight.timeoutMs,
      clovaResponseMaxBytes: clovaPreflight.responseMaxBytes,
      effectiveMaxRetries: clovaConfig.maxRetries,
      downloadCount: 1, renderAttempted: 1, renderSucceeded: 1,
      renderedWidth: renderedMetadata.width, renderedHeight: renderedMetadata.height,
      renderedBytes: rendered.byteSize, renderDurationMs,
      actualApiCalls: ocr.apiCallCount, retryCount: ocr.retryCount,
      fieldCount: ocr.fieldCount, averageConfidence: ocr.averageConfidence ?? null,
      readingOrderStrategy: ocr.readingOrderStrategy,
      candidateRawTextLength: ocr.rawText.length,
      candidateCleanedTextLength: ocr.cleanedText.length,
      empty: ocr.isEmpty, ocrDurationMs: ocr.durationMs,
      mergedRawTextLength: merged.rawText.length,
      mergedCleanedTextLength: merged.cleanedText.length,
      mergedPageCount: merged.pages.length, pageMarkerCount: markers.length,
      duplicatePageMarkers, missingPageMarkers,
      pageOrderValid: JSON.stringify(markers) === JSON.stringify(expectedMarkers),
      pdfJsSourcePageCount: merged.pdfJsPageCount, ocrSourcePageCount: merged.ocrPageCount,
      nonCandidateRawPagesUnchanged, nonCandidateCleanedPagesUnchanged,
      candidateSource: merged.pages.find((page) => candidateSet.has(page.pageNumber))?.source ?? null,
      candidateReplaced: merged.pages.find((page) => candidateSet.has(page.pageNumber))?.source === 'CLOVA_OCR',
      qualityWarnings,
      databaseMutation: false, processingClaimed: false, attemptIncremented: false,
      targetFingerprintUnchanged: same(beforeTarget, fingerprint(current)),
      aggregateCountsUnchanged: same(beforeDatabase, afterDatabase), counts: afterDatabase,
      temporaryFilesRemaining: 0, renderedFilesRemaining: 0, ocrInputFilesRemaining: 0,
      jobDirectoriesRemaining: 0, temporaryManifestRemaining: 0,
    };
  } finally {
    await rendered?.cleanup().catch(() => undefined);
    await downloaded?.cleanup().catch(() => undefined);
  }
}
