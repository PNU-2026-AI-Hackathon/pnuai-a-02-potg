import { AttachmentExtractionStatus, ProgramCaseAttachment } from '@prisma/client';
import path from 'path';
import { getAttachmentOcrConfig } from '../../config/attachmentOcr';
import {
  clovaOcrConfigSummary,
  ClovaOcrConfig,
  getClovaOcrConfig,
  validateClovaOcrExecutionConfig,
} from '../../config/clovaOcr';
import { prisma } from '../../lib/prisma';
import { downloadAttachment } from './attachmentDownloader';
import { ClovaOcrRequestError, createClovaOcrEngine } from './clovaOcrClient';
import { safeAttachmentError } from './attachmentErrors';
import { imageOcrLogSummary, processImageForOcr } from './imageOcrProcessor';

export type ImageOcrRunOptions = {
  type: 'IMAGE';
  limit: number;
  attachmentId?: string;
  retryFailed: boolean;
  plan: boolean;
  dryRun: boolean;
};

export type ImageOcrDependencies = {
  select?: (options: ImageOcrRunOptions) => Promise<ProgramCaseAttachment[]>;
  downloader?: typeof downloadAttachment;
  processImage?: typeof processImageForOcr;
  createEngine?: typeof createClovaOcrEngine;
  getConfig?: () => ClovaOcrConfig;
  snapshot?: () => Promise<DatabaseSnapshot>;
  getRow?: (id: string) => Promise<ProgramCaseAttachment>;
};

type DatabaseSnapshot = {
  programCases: number;
  sessions: number;
  attachments: number;
  activeAttachments: number;
  imageStatuses: Record<string, number>;
  pdfStatuses: Record<string, number>;
};

const IMAGE_TYPES = ['jpg', 'jpeg', 'png'];

function statusMap(rows: Array<{ extractionStatus: AttachmentExtractionStatus; _count?: true | { _all?: number } }>) {
  return Object.fromEntries(rows.map((row) => [
    row.extractionStatus,
    typeof row._count === 'object' ? row._count._all ?? 0 : 0,
  ]));
}

async function databaseSnapshot(): Promise<DatabaseSnapshot> {
  const [programCases, sessions, attachments, activeAttachments, imageRows, pdfRows] = await prisma.$transaction([
    prisma.programCase.count(),
    prisma.programCaseSession.count(),
    prisma.programCaseAttachment.count(),
    prisma.programCaseAttachment.count({ where: { isActive: true } }),
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
  ]);
  return {
    programCases,
    sessions,
    attachments,
    activeAttachments,
    imageStatuses: statusMap(imageRows),
    pdfStatuses: statusMap(pdfRows),
  };
}

export async function selectImageOcrCandidates(options: ImageOcrRunOptions) {
  const statuses: AttachmentExtractionStatus[] = options.retryFailed ? ['PENDING', 'FAILED'] : ['PENDING'];
  return prisma.programCaseAttachment.findMany({
    where: {
      ...(options.attachmentId ? { id: options.attachmentId } : {}),
      isActive: true,
      extractionStatus: { in: statuses },
      OR: IMAGE_TYPES.map((value) => ({ fileType: { equals: value, mode: 'insensitive' as const } })),
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: options.limit,
  });
}

function fingerprint(attachment: ProgramCaseAttachment) {
  return {
    id: attachment.id,
    extractionStatus: attachment.extractionStatus,
    attemptCount: attachment.attemptCount,
    lastAttemptedAt: attachment.lastAttemptedAt?.toISOString() ?? null,
    rawTextLength: attachment.rawText?.length ?? null,
    cleanedTextLength: attachment.cleanedText?.length ?? null,
    detectedFileType: attachment.detectedFileType,
    detectedMimeType: attachment.detectedMimeType,
    fileSizeBytes: attachment.fileSizeBytes,
    checksumSha256: attachment.checksumSha256,
    extractorType: attachment.extractorType,
    extractorVersion: attachment.extractorVersion,
    failureCode: attachment.failureCode,
    failureMessage: attachment.failureMessage,
    extractedAt: attachment.extractedAt?.toISOString() ?? null,
    updatedAt: attachment.updatedAt.toISOString(),
  };
}

function same(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function runImageOcr(options: ImageOcrRunOptions, dependencies: ImageOcrDependencies = {}) {
  const config = { ...(dependencies.getConfig?.() ?? getClovaOcrConfig()), maxRetries: 0 };
  validateClovaOcrExecutionConfig(config);
  const preflight = clovaOcrConfigSummary(config);
  const selected = await (dependencies.select ?? selectImageOcrCandidates)(options);

  if (options.plan) {
    return {
      mode: 'plan',
      selected: selected.length,
      estimatedApiCalls: selected.length,
      actualApiCalls: 0,
      databaseMutation: false,
      download: false,
      ocrCall: false,
      preflight,
    };
  }
  if (!options.dryRun) throw new Error('IMAGE extraction requires --plan or --dry-run.');
  if (selected.length !== 1) throw new Error('IMAGE dry-run requires exactly one selected attachment.');

  const target = selected[0];
  const beforeRow = fingerprint(target);
  const snapshot = dependencies.snapshot ?? databaseSnapshot;
  const beforeDatabase = await snapshot();
  const downloader = dependencies.downloader ?? downloadAttachment;
  const processImage = dependencies.processImage ?? processImageForOcr;
  const createEngine = dependencies.createEngine ?? createClovaOcrEngine;
  let downloaded: Awaited<ReturnType<typeof downloadAttachment>> | undefined;
  let actualApiCalls = 0;

  try {
    downloaded = await downloader(target.fileUrl, { networkRetries: 0 });
    const expectedType = target.fileType?.toLowerCase() === 'png' ? 'PNG' : 'JPEG';
    const result = await processImage({
      sourcePath: downloaded.tempFilePath,
      workDirectory: path.dirname(downloaded.tempFilePath),
      expectedType,
      ocrEngine: createEngine(config),
    }, getAttachmentOcrConfig());
    actualApiCalls = result.apiCallCount;

    const after = dependencies.getRow
      ? await dependencies.getRow(target.id)
      : await prisma.programCaseAttachment.findUniqueOrThrow({ where: { id: target.id } });
    const afterDatabase = await snapshot();
    return {
      mode: 'dry-run',
      selected: 1,
      estimatedApiCalls: 1,
      actualApiCalls,
      databaseMutation: false,
      targetFingerprintUnchanged: same(beforeRow, fingerprint(after)),
      aggregateCountsUnchanged: same(beforeDatabase, afterDatabase),
      fileBytes: downloaded.byteSize,
      ...imageOcrLogSummary(result),
      rawTextCharacterCount: result.rawText.length,
      cleanedTextCharacterCount: result.cleanedText.length,
      preflight,
    };
  } catch (error) {
    if (error instanceof ClovaOcrRequestError) actualApiCalls = error.attempts;
    const safe = safeAttachmentError(error);
    throw Object.assign(new Error(safe.message), {
      code: safe.code,
      httpStatus: error instanceof ClovaOcrRequestError ? error.httpStatus : null,
      stage: error instanceof ClovaOcrRequestError ? error.stage : 'PROCESSING',
      retryable: safe.retryable,
      apiCallCount: actualApiCalls,
    });
  } finally {
    await downloaded?.cleanup().catch(() => undefined);
  }
}
