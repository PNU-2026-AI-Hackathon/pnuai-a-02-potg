import { AttachmentExtractionStatus, ProgramCaseAttachment } from '@prisma/client';
import { getHwpAnalysisLimits } from '../../config/hwpAnalysis';
import { prisma } from '../../lib/prisma';
import { downloadAttachment, DownloadedAttachment } from './attachmentDownloader';
import { AttachmentProcessingError, safeAttachmentError } from './attachmentErrors';
import { detectAttachmentFileType, FileTypeDetection } from './fileTypeDetector';
import { analyzeHwpContainer, HwpContainerAnalysis } from './hwpContainerAnalyzer';
import { extractHwpText, HwpTextExtractionResult } from './hwpTextExtractor';

export type HwpAttachmentProcessingResult = {
  attachmentId: string;
  programCaseId: string;
  outcome: 'COMPLETED' | 'FAILED';
  extractedCharacterCount: number;
  rawTextCharacterCount: number;
  tableCount: number;
  rowCount: number;
  cellCount: number;
  replacementCharacterCount: number;
  detectedFileType: string | null;
  detectedMimeType: string | null;
  byteSize: number | null;
  checksumSha256: string | null;
  extractorType: string | null;
  extractorVersion: string | null;
  errorCode: string | null;
  dryRun: boolean;
};

export type HwpProcessorDependencies = {
  downloader?: typeof downloadAttachment;
  detector?: typeof detectAttachmentFileType;
  containerAnalyzer?: typeof analyzeHwpContainer;
  extractor?: typeof extractHwpText;
  now?: () => Date;
};

export type RunHwpExtractionOptions = {
  type: 'HWP';
  limit: number;
  attachmentId?: string;
  retryFailed: boolean;
  dryRun: boolean;
};

function failureMessage(error: AttachmentProcessingError) {
  return error.message.replace(/[A-Za-z]:[\\/][^\s]+|\/(?:tmp|var\/tmp)\/[^\s]+/g, '[temporary path]').slice(0, 500);
}

async function claimHwp(attachment: ProgramCaseAttachment, retryFailed: boolean, now: Date) {
  const statuses: AttachmentExtractionStatus[] = retryFailed ? ['PENDING', 'FAILED'] : ['PENDING'];
  const claimed = await prisma.programCaseAttachment.updateMany({
    where: {
      id: attachment.id,
      isActive: true,
      fileType: { equals: 'hwp', mode: 'insensitive' },
      extractionStatus: { in: statuses },
      updatedAt: attachment.updatedAt,
    },
    data: {
      extractionStatus: 'PROCESSING',
      attemptCount: { increment: 1 },
      lastAttemptedAt: now,
      failureCode: null,
      failureMessage: null,
    },
  });
  if (claimed.count !== 1) {
    throw new AttachmentProcessingError('UNKNOWN_ERROR', 'Attachment is not eligible for HWP processing.');
  }
}

function validateHwp(
  detection: FileTypeDetection,
  container: HwpContainerAnalysis,
) {
  if (detection.detectedFileType === 'HWPX' || container.isActualHwpx) {
    throw new AttachmentProcessingError('HWP_UNSUPPORTED_HWPX', 'HWPX extraction is not supported.');
  }
  if (detection.detectedFileType !== 'HWP' || container.containerKind !== 'OLE' || !container.ole) {
    throw new AttachmentProcessingError('HWP_CONTAINER_INVALID', 'Downloaded file is not an OLE HWP container.');
  }
  if (!container.ole.fileHeaderPresent || !container.ole.signatureValid) {
    throw new AttachmentProcessingError('HWP_SIGNATURE_MISMATCH', 'HWP FileHeader signature is invalid.');
  }
  if (container.ole.encrypted) {
    throw new AttachmentProcessingError('HWP_ENCRYPTED', 'Encrypted HWP documents are not supported.');
  }
  if (container.ole.distribution) {
    throw new AttachmentProcessingError('HWP_DISTRIBUTION_DOCUMENT', 'Distribution HWP documents are not supported.');
  }
  if (!container.ole.bodyTextPresent) {
    throw new AttachmentProcessingError('HWP_BODY_TEXT_MISSING', 'HWP BodyText storage is missing.');
  }
}

function result(
  attachment: ProgramCaseAttachment,
  dryRun: boolean,
  downloaded?: DownloadedAttachment,
  detection?: FileTypeDetection,
  extraction?: HwpTextExtractionResult,
  error?: AttachmentProcessingError,
): HwpAttachmentProcessingResult {
  return {
    attachmentId: attachment.id,
    programCaseId: attachment.programCaseId,
    outcome: error ? 'FAILED' : 'COMPLETED',
    extractedCharacterCount: extraction?.metadata.nonWhitespaceCharacterCount ?? 0,
    rawTextCharacterCount: extraction?.rawText.length ?? 0,
    tableCount: extraction?.metadata.tableCount ?? 0,
    rowCount: extraction?.metadata.rowCount ?? 0,
    cellCount: extraction?.metadata.cellCount ?? 0,
    replacementCharacterCount: extraction?.metadata.replacementCharacterCount ?? 0,
    detectedFileType: detection?.detectedFileType ?? null,
    detectedMimeType: detection?.detectedMimeType ?? null,
    byteSize: downloaded?.byteSize ?? null,
    checksumSha256: downloaded?.checksumSha256 ?? null,
    extractorType: extraction?.extractorType ?? null,
    extractorVersion: extraction?.extractorVersion ?? null,
    errorCode: error?.code ?? null,
    dryRun,
  };
}

export async function processHwpAttachment(
  attachment: ProgramCaseAttachment,
  options: Pick<RunHwpExtractionOptions, 'dryRun' | 'retryFailed'>,
  dependencies: HwpProcessorDependencies = {},
): Promise<HwpAttachmentProcessingResult> {
  const now = dependencies.now ?? (() => new Date());
  if (!options.dryRun) await claimHwp(attachment, options.retryFailed, now());

  let downloaded: DownloadedAttachment | undefined;
  let detection: FileTypeDetection | undefined;
  let extraction: HwpTextExtractionResult | undefined;
  let error: AttachmentProcessingError | undefined;
  try {
    downloaded = await (dependencies.downloader ?? downloadAttachment)(attachment.fileUrl);
    detection = await (dependencies.detector ?? detectAttachmentFileType)({
      filePath: downloaded.tempFilePath,
      fileName: attachment.fileName,
      dbFileType: attachment.fileType,
      responseContentType: downloaded.responseContentType,
      requireExpectedMatch: false,
    });
    const container = await (dependencies.containerAnalyzer ?? analyzeHwpContainer)(
      downloaded.tempFilePath,
      downloaded.byteSize,
      getHwpAnalysisLimits(),
    );
    validateHwp(detection, container);
    extraction = await (dependencies.extractor ?? extractHwpText)(downloaded.tempFilePath);
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
      await prisma.programCaseAttachment.updateMany({
        where: { id: attachment.id, extractionStatus: 'PROCESSING' },
        data: {
          ...(downloaded ? { fileSizeBytes: downloaded.byteSize, checksumSha256: downloaded.checksumSha256 } : {}),
          ...(detection ? {
            detectedFileType: detection.detectedFileType,
            detectedMimeType: detection.detectedMimeType,
          } : {}),
          extractionStatus: 'FAILED',
          failureCode: error.code,
          failureMessage: failureMessage(error),
        },
      });
    }
    return result(attachment, options.dryRun, downloaded, detection, extraction, error);
  }
  if (!downloaded || !detection || !extraction) {
    throw new AttachmentProcessingError('UNKNOWN_ERROR', 'HWP processing produced no result.');
  }
  if (!options.dryRun) {
    await prisma.programCaseAttachment.updateMany({
      where: { id: attachment.id, extractionStatus: 'PROCESSING' },
      data: {
        extractionStatus: 'COMPLETED',
        rawText: extraction.rawText,
        cleanedText: extraction.cleanedText,
        extractorType: extraction.extractorType,
        extractorVersion: extraction.extractorVersion,
        detectedFileType: 'HWP',
        detectedMimeType: detection.detectedMimeType,
        fileSizeBytes: downloaded.byteSize,
        checksumSha256: downloaded.checksumSha256,
        failureCode: null,
        failureMessage: null,
        extractedAt: now(),
      },
    });
  }
  return result(attachment, options.dryRun, downloaded, detection, extraction);
}

export async function processSelectedHwpAttachments(
  selected: ProgramCaseAttachment[],
  options: Pick<RunHwpExtractionOptions, 'dryRun' | 'retryFailed'>,
  dependencies: HwpProcessorDependencies = {},
) {
  const results: HwpAttachmentProcessingResult[] = [];
  for (const attachment of selected) {
    try {
      results.push(await processHwpAttachment(attachment, options, dependencies));
    } catch (caught) {
      const error = safeAttachmentError(caught);
      results.push(result(attachment, options.dryRun, undefined, undefined, undefined, error));
    }
  }
  return {
    selected: selected.length,
    completed: results.filter((item) => item.outcome === 'COMPLETED').length,
    failed: results.filter((item) => item.outcome === 'FAILED').length,
    skipped: 0,
    results,
  };
}

export async function runHwpExtraction(
  options: RunHwpExtractionOptions,
  dependencies: HwpProcessorDependencies = {},
) {
  const statuses: AttachmentExtractionStatus[] = options.retryFailed ? ['PENDING', 'FAILED'] : ['PENDING'];
  const selected = await prisma.programCaseAttachment.findMany({
    where: {
      ...(options.attachmentId ? { id: options.attachmentId } : {}),
      isActive: true,
      fileType: { equals: 'hwp', mode: 'insensitive' },
      extractionStatus: { in: statuses },
    },
    orderBy: { createdAt: 'asc' },
    take: options.limit,
  });
  return processSelectedHwpAttachments(selected, options, dependencies);
}
