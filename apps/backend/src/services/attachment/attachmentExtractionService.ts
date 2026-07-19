import { AttachmentExtractionStatus, ProgramCaseAttachment } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { downloadAttachment, DownloadedAttachment } from './attachmentDownloader';
import { AttachmentProcessingError, safeAttachmentError } from './attachmentErrors';
import { detectAttachmentFileType, FileTypeDetection } from './fileTypeDetector';
import { extractPdfText, PdfDocumentClassification, PdfTextExtractionResult } from './pdfTextExtractor';

export type AttachmentProcessingResult = {
  attachmentId: string;
  outcome: 'COMPLETED' | 'FAILED';
  classification: PdfDocumentClassification | null;
  pageCount: number | null;
  extractedCharacterCount: number;
  ocrCandidatePages: number[];
  errorCode: string | null;
  dryRun: boolean;
};

export type AttachmentProcessorDependencies = {
  downloader?: typeof downloadAttachment;
  detector?: typeof detectAttachmentFileType;
  pdfExtractor?: typeof extractPdfText;
  now?: () => Date;
};

function failureMessage(error: AttachmentProcessingError) {
  if (error.code === 'OCR_REQUIRED') return 'PDF 텍스트 레이어가 없어 OCR 처리가 필요함';
  return error.message.slice(0, 500);
}

async function markProcessing(attachment: ProgramCaseAttachment, retryFailed: boolean, now: Date) {
  const allowedStatuses: AttachmentExtractionStatus[] = retryFailed
    ? ['PENDING', 'FAILED']
    : ['PENDING'];
  const claimed = await prisma.programCaseAttachment.updateMany({
    where: { id: attachment.id, isActive: true, extractionStatus: { in: allowedStatuses } },
    data: {
      extractionStatus: 'PROCESSING',
      attemptCount: { increment: 1 },
      lastAttemptedAt: now,
      failureCode: null,
      failureMessage: null,
    },
  });
  if (claimed.count !== 1) {
    throw new AttachmentProcessingError('UNKNOWN_ERROR', 'Attachment is not eligible for processing.');
  }
}

function metadata(downloaded?: DownloadedAttachment, detection?: FileTypeDetection) {
  return {
    ...(downloaded ? {
      fileSizeBytes: downloaded.byteSize,
      checksumSha256: downloaded.checksumSha256,
    } : {}),
    ...(detection ? {
      detectedFileType: detection.detectedFileType,
      detectedMimeType: detection.detectedMimeType,
    } : {}),
  };
}

export async function processPdfAttachment(
  attachment: ProgramCaseAttachment,
  options: { dryRun: boolean; retryFailed: boolean },
  dependencies: AttachmentProcessorDependencies = {},
): Promise<AttachmentProcessingResult> {
  const downloader = dependencies.downloader || downloadAttachment;
  const detector = dependencies.detector || detectAttachmentFileType;
  const pdfExtractor = dependencies.pdfExtractor || extractPdfText;
  const now = dependencies.now || (() => new Date());

  if (!options.dryRun) await markProcessing(attachment, options.retryFailed, now());

  let downloaded: DownloadedAttachment | undefined;
  let detection: FileTypeDetection | undefined;
  let extraction: PdfTextExtractionResult | undefined;
  let error: AttachmentProcessingError | undefined;

  try {
    downloaded = await downloader(attachment.fileUrl);
    detection = await detector({
      filePath: downloaded.tempFilePath,
      fileName: attachment.fileName,
      dbFileType: attachment.fileType,
      responseContentType: downloaded.responseContentType,
      requireExpectedMatch: true,
    });
    if (detection.detectedFileType !== 'PDF') {
      throw new AttachmentProcessingError('UNSUPPORTED_FILE_TYPE', 'Only PDF text extraction is supported.');
    }
    extraction = await pdfExtractor(downloaded.tempFilePath);
    if (extraction.classification === 'OCR_REQUIRED') {
      error = new AttachmentProcessingError('OCR_REQUIRED', 'PDF text layer is insufficient for text extraction.');
    }
  } catch (caught) {
    error = safeAttachmentError(caught);
  }

  if (downloaded) {
    try {
      await downloaded.cleanup();
    } catch {
      error = new AttachmentProcessingError('TEMP_FILE_CLEANUP_FAILED', 'Temporary attachment file cleanup failed.');
    }
  }

  if (error) {
    if (!options.dryRun) {
      await prisma.programCaseAttachment.update({
        where: { id: attachment.id },
        data: {
          ...metadata(downloaded, detection),
          extractionStatus: 'FAILED',
          ...(detection?.detectedFileType === 'PDF' ? {
            extractorType: 'PDFJS_TEXT',
            extractorVersion: extraction?.extractorVersion,
          } : {}),
          failureCode: error.code,
          failureMessage: failureMessage(error),
        },
      });
    }
    return {
      attachmentId: attachment.id,
      outcome: 'FAILED',
      classification: extraction?.classification || null,
      pageCount: extraction?.pageCount || null,
      extractedCharacterCount: extraction?.totalNonWhitespaceCharacterCount || 0,
      ocrCandidatePages: extraction?.ocrCandidatePages || [],
      errorCode: error.code,
      dryRun: options.dryRun,
    };
  }

  if (!extraction || !detection || !downloaded) {
    throw new AttachmentProcessingError('UNKNOWN_ERROR', 'Attachment processing produced no result.');
  }
  if (!options.dryRun) {
    await prisma.programCaseAttachment.update({
      where: { id: attachment.id },
      data: {
        ...metadata(downloaded, detection),
        extractionStatus: 'COMPLETED',
        rawText: extraction.rawText,
        cleanedText: extraction.cleanedText,
        extractorType: extraction.classification === 'MIXED' ? 'PDFJS_TEXT_PARTIAL' : 'PDFJS_TEXT',
        extractorVersion: extraction.extractorVersion,
        failureCode: null,
        failureMessage: null,
        extractedAt: now(),
      },
    });
  }
  return {
    attachmentId: attachment.id,
    outcome: 'COMPLETED',
    classification: extraction.classification,
    pageCount: extraction.pageCount,
    extractedCharacterCount: extraction.totalNonWhitespaceCharacterCount,
    ocrCandidatePages: extraction.ocrCandidatePages,
    errorCode: null,
    dryRun: options.dryRun,
  };
}

export type RunAttachmentExtractionOptions = {
  type: 'PDF';
  limit: number;
  attachmentId?: string;
  retryFailed: boolean;
  dryRun: boolean;
};

export async function processSelectedPdfAttachments(
  selected: ProgramCaseAttachment[],
  options: Pick<RunAttachmentExtractionOptions, 'dryRun' | 'retryFailed'>,
  dependencies: AttachmentProcessorDependencies = {},
) {
  const results: AttachmentProcessingResult[] = [];
  for (const attachment of selected) {
    try {
      results.push(await processPdfAttachment(attachment, options, dependencies));
    } catch (caught) {
      const error = safeAttachmentError(caught);
      if (!options.dryRun) {
        await prisma.programCaseAttachment.update({
          where: { id: attachment.id },
          data: {
            extractionStatus: 'FAILED',
            failureCode: error.code,
            failureMessage: failureMessage(error),
          },
        }).catch(() => undefined);
      }
      results.push({
        attachmentId: attachment.id,
        outcome: 'FAILED',
        classification: null,
        pageCount: null,
        extractedCharacterCount: 0,
        ocrCandidatePages: [],
        errorCode: error.code,
        dryRun: options.dryRun,
      });
    }
  }
  return {
    selected: selected.length,
    completed: results.filter((result) => result.outcome === 'COMPLETED').length,
    failed: results.filter((result) => result.outcome === 'FAILED').length,
    skipped: 0,
    textPdf: results.filter((result) => result.classification === 'TEXT').length,
    mixedPdf: results.filter((result) => result.classification === 'MIXED').length,
    ocrRequired: results.filter((result) => result.classification === 'OCR_REQUIRED').length,
    results,
  };
}

export async function runAttachmentExtraction(
  options: RunAttachmentExtractionOptions,
  dependencies: AttachmentProcessorDependencies = {},
) {
  const statuses: AttachmentExtractionStatus[] = options.retryFailed ? ['PENDING', 'FAILED'] : ['PENDING'];
  const selected = await prisma.programCaseAttachment.findMany({
    where: {
      ...(options.attachmentId ? { id: options.attachmentId } : {}),
      isActive: true,
      extractionStatus: { in: statuses },
      fileType: { equals: 'pdf', mode: 'insensitive' },
    },
    orderBy: { createdAt: 'asc' },
    take: options.limit,
  });
  return processSelectedPdfAttachments(selected, options, dependencies);
}
