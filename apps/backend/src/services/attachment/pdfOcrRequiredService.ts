import { ProgramCaseAttachment } from '@prisma/client';
import path from 'path';
import { getAttachmentOcrConfig } from '../../config/attachmentOcr';
import { ClovaOcrConfig, clovaOcrConfigSummary, getClovaOcrConfig, validateClovaOcrExecutionConfig } from '../../config/clovaOcr';
import { prisma } from '../../lib/prisma';
import { downloadAttachment } from './attachmentDownloader';
import { AttachmentProcessingError, safeAttachmentError } from './attachmentErrors';
import { createClovaOcrEngine } from './clovaOcrClient';
import { detectAttachmentFileType } from './fileTypeDetector';
import { processImageForOcr } from './imageOcrProcessor';
import { renderPdfPage } from './pdfPageRenderer';
import { detectPdfRendererAvailability } from './pdfPageRenderer';
import { cleanExtractedText, extractPdfText, sanitizeRawTextForStorage } from './pdfTextExtractor';

export type OcrRequiredOptions = {
  type: 'PDF_OCR'; ocrRequiredOnly: true; mixedOnly: false; limit: number;
  attachmentId?: string; plan: boolean; write?: true;
};

export type OcrRequiredDependencies = {
  select?: (options: OcrRequiredOptions) => Promise<ProgramCaseAttachment[]>;
  claim?: (row: ProgramCaseAttachment) => Promise<boolean>;
  downloader?: typeof downloadAttachment;
  detector?: typeof detectAttachmentFileType;
  analyze?: typeof extractPdfText;
  render?: typeof renderPdfPage;
  processImage?: typeof processImageForOcr;
  complete?: (row: ProgramCaseAttachment, data: Record<string, unknown>) => Promise<number>;
  fail?: (row: ProgramCaseAttachment, code: string, message: string) => Promise<void>;
  getConfig?: typeof getAttachmentOcrConfig;
  getClovaConfig?: () => ClovaOcrConfig;
  createEngine?: typeof createClovaOcrEngine;
  rendererAvailability?: typeof detectPdfRendererAvailability;
};

async function select(options: OcrRequiredOptions) {
  return prisma.programCaseAttachment.findMany({
    where: {
      ...(options.attachmentId ? { id: options.attachmentId } : {}), isActive: true,
      fileType: { equals: 'pdf', mode: 'insensitive' }, extractionStatus: 'FAILED', failureCode: 'OCR_REQUIRED',
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: options.limit,
  });
}

export async function runOcrRequiredPdf(options: OcrRequiredOptions, dependencies: OcrRequiredDependencies = {}) {
  const rows = await (dependencies.select ?? select)(options);
  const config = dependencies.getConfig?.() ?? getAttachmentOcrConfig();
  const clova = { ...(dependencies.getClovaConfig?.() ?? getClovaOcrConfig()), maxRetries: 0 };
  const renderer = await (dependencies.rendererAvailability ?? detectPdfRendererAvailability)(config);
  if (options.plan) {
    const preflight = clovaOcrConfigSummary(clova);
    return {
      mode: 'plan', targetMode: 'ocr-required-only', selected: rows.length,
      estimatedPages: 0, estimatedRenderCount: 0, estimatedApiCalls: 0,
      rendererConfigured: renderer.configured, rendererAvailable: renderer.available,
      rendererVersionConfigured: renderer.versionConfigured, rendererVersion: renderer.version,
      preflight: { ...preflight, effectiveMaxRetries: 0 },
      actualApiCalls: 0, databaseMutation: false,
    };
  }
  if (!renderer.available || !renderer.versionConfigured) {
    throw new AttachmentProcessingError('PDF_RENDERER_UNAVAILABLE', 'PDF renderer preflight failed.');
  }
  validateClovaOcrExecutionConfig(clova);
  const results: Array<{
    completed: number;
    failed: number;
    skipped: number;
    actualApiCalls: number;
    pageCount?: number;
    failureCode?: string;
  }> = [];
  for (const row of rows) {
    if (!(await (dependencies.claim ?? (async (target) => (await prisma.programCaseAttachment.updateMany({
      where: { id: target.id, isActive: true, extractionStatus: 'FAILED', failureCode: 'OCR_REQUIRED', updatedAt: target.updatedAt },
      data: { extractionStatus: 'PROCESSING', attemptCount: { increment: 1 }, lastAttemptedAt: new Date(), failureCode: null, failureMessage: null },
    })).count === 1))(row))) {
      results.push({ completed: 0, failed: 0, skipped: 1, actualApiCalls: 0 }); continue;
    }
    let downloaded;
    const pageResults: Array<{ pageNumber: number; rawText: string; cleanedText: string }> = [];
    let calls = 0;
    try {
      downloaded = await (dependencies.downloader ?? downloadAttachment)(row.fileUrl, { networkRetries: 0 });
      await (dependencies.detector ?? detectAttachmentFileType)({
        filePath: downloaded.tempFilePath, dbFileType: 'PDF', requireExpectedMatch: true,
      });
      const analysis = await (dependencies.analyze ?? extractPdfText)(downloaded.tempFilePath);
      if (analysis.pageCount > config.pdfOcrMaxPages) throw new AttachmentProcessingError('PDF_PAGE_LIMIT_EXCEEDED', 'PDF exceeds the page limit.');
      for (let pageNumber = 1; pageNumber <= analysis.pageCount; pageNumber += 1) {
        const rendered = await (dependencies.render ?? renderPdfPage)({
          pdfPath: downloaded.tempFilePath, pageNumber, pageCount: analysis.pageCount,
          workDirectory: path.dirname(downloaded.tempFilePath),
        }, config);
        try {
          const value = await (dependencies.processImage ?? processImageForOcr)({
            sourcePath: rendered.filePath, workDirectory: path.dirname(rendered.filePath), expectedType: 'PNG',
            ocrEngine: (dependencies.createEngine ?? createClovaOcrEngine)(clova),
          }, config);
          calls += value.apiCallCount;
          pageResults.push({ pageNumber, rawText: value.rawText, cleanedText: value.cleanedText });
        } finally { await rendered.cleanup(); }
      }
      const rawText = sanitizeRawTextForStorage(pageResults.map((page) => `[Page ${page.pageNumber}]\n${page.rawText}`).join('\n\n'));
      const cleanedText = cleanExtractedText(pageResults.map((page) => page.cleanedText).join('\n\n'));
      const count = await (dependencies.complete ?? (async (target, data) => (await prisma.programCaseAttachment.updateMany({
        where: { id: target.id, extractionStatus: 'PROCESSING' }, data,
      })).count))(row, {
        extractionStatus: 'COMPLETED', rawText, cleanedText, extractorType: 'CLOVA_OCR_PDF',
        extractorVersion: 'CLOVA_V2+POPPLER', failureCode: null, failureMessage: null, extractedAt: new Date(),
      });
      results.push({ completed: count, failed: 0, skipped: count ? 0 : 1, actualApiCalls: calls, pageCount: pageResults.length });
    } catch (error) {
      const safe = safeAttachmentError(error);
      await (dependencies.fail ?? (async (target, code, message) => { await prisma.programCaseAttachment.updateMany({
        where: { id: target.id, extractionStatus: 'PROCESSING' },
        data: { extractionStatus: 'FAILED', rawText: null, cleanedText: null, failureCode: code, failureMessage: message },
      }); }))(row, safe.code, safe.message);
      results.push({ completed: 0, failed: 1, skipped: 0, actualApiCalls: calls, failureCode: safe.code });
    } finally { await downloaded?.cleanup().catch(() => undefined); }
  }
  const sum = (key: string) => results.reduce((total, result) => total + Number(result[key as keyof typeof result] ?? 0), 0);
  return {
    mode: 'write', targetMode: 'ocr-required-only', selected: rows.length,
    completed: sum('completed'), failed: sum('failed'), skipped: sum('skipped'),
    actualApiCalls: sum('actualApiCalls'), retryCount: 0, databaseMutation: rows.length > 0,
    results,
  };
}
