import path from 'path';
import { getHwpAnalysisLimits, HwpAnalysisLimits } from '../../config/hwpAnalysis';
import { downloadAttachment } from './attachmentDownloader';
import { safeAttachmentError } from './attachmentErrors';
import { detectAttachmentFileType } from './fileTypeDetector';
import { analyzeHwpContainer, fileNameExtension, HwpContainerAnalysis } from './hwpContainerAnalyzer';

export type HwpAttachmentRow = {
  id: string;
  programCaseId: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  extractionStatus: string;
  extractorType: string | null;
  rawTextPresent: boolean;
  cleanedTextPresent: boolean;
};

export type HwpAttachmentAnalysisResult = HwpAttachmentRow & {
  maskedFileUrl: string;
  fileNameExtension: string | null;
  downloadSucceeded: boolean;
  byteSize: number | null;
  checksumSha256: string | null;
  container: HwpContainerAnalysis | null;
  detectedFileType: 'HWP' | 'HWPX' | 'OTHER' | null;
  extensionMatchesActual: boolean | null;
  dbFileTypeMatchesActual: boolean | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type HwpDatasetAnalysis = {
  analyzedAt: string;
  selection: { isActive: true; fileTypes: ['HWP', 'HWPX']; attachmentId?: string; limit?: number };
  selectedCount: number;
  results: HwpAttachmentAnalysisResult[];
};

export type HwpAnalysisDependencies = {
  downloader?: typeof downloadAttachment;
  containerAnalyzer?: typeof analyzeHwpContainer;
  detector?: typeof detectAttachmentFileType;
  limits?: HwpAnalysisLimits;
  now?: () => Date;
};

export function maskUrl(value: string) {
  try {
    const url = new URL(value);
    if ([...url.searchParams.keys()].length > 0) {
      for (const key of [...url.searchParams.keys()]) url.searchParams.set(key, '***');
    }
    return url.toString();
  } catch {
    return '[invalid-url]';
  }
}

function actualType(container: HwpContainerAnalysis): 'HWP' | 'HWPX' | 'OTHER' {
  if (container.isActualHwp) return 'HWP';
  if (container.isActualHwpx) return 'HWPX';
  return 'OTHER';
}

function normalizedType(value: string | null) {
  const type = value?.replace(/^\./, '').toUpperCase() ?? null;
  return type === 'HWP' || type === 'HWPX' ? type : null;
}

export async function analyzeHwpAttachment(
  row: HwpAttachmentRow,
  dependencies: HwpAnalysisDependencies = {},
): Promise<HwpAttachmentAnalysisResult> {
  const downloader = dependencies.downloader ?? downloadAttachment;
  const containerAnalyzer = dependencies.containerAnalyzer ?? analyzeHwpContainer;
  const detector = dependencies.detector ?? detectAttachmentFileType;
  const limits = dependencies.limits ?? getHwpAnalysisLimits();
  let downloaded: Awaited<ReturnType<typeof downloadAttachment>> | undefined;
  const extension = fileNameExtension(row.fileName);
  try {
    downloaded = await downloader(row.fileUrl, { concurrency: 1 });
    await detector({
      filePath: downloaded.tempFilePath,
      fileName: row.fileName,
      dbFileType: row.fileType,
      responseContentType: downloaded.responseContentType,
      requireExpectedMatch: false,
    });
    const container = await containerAnalyzer(downloaded.tempFilePath, downloaded.byteSize, limits);
    const detectedFileType = actualType(container);
    return {
      ...row,
      fileUrl: maskUrl(row.fileUrl),
      maskedFileUrl: maskUrl(row.fileUrl),
      fileNameExtension: extension,
      downloadSucceeded: true,
      byteSize: downloaded.byteSize,
      checksumSha256: downloaded.checksumSha256,
      container,
      detectedFileType,
      extensionMatchesActual: normalizedType(extension) === detectedFileType,
      dbFileTypeMatchesActual: normalizedType(row.fileType) === detectedFileType,
      errorCode: null,
      errorMessage: null,
    };
  } catch (error) {
    const safe = safeAttachmentError(error);
    return {
      ...row,
      fileUrl: maskUrl(row.fileUrl),
      maskedFileUrl: maskUrl(row.fileUrl),
      fileNameExtension: extension,
      downloadSucceeded: Boolean(downloaded),
      byteSize: downloaded?.byteSize ?? null,
      checksumSha256: downloaded?.checksumSha256 ?? null,
      container: null,
      detectedFileType: null,
      extensionMatchesActual: null,
      dbFileTypeMatchesActual: null,
      errorCode: safe.code,
      errorMessage: safe.message,
    };
  } finally {
    await downloaded?.cleanup().catch(() => undefined);
  }
}

export async function analyzeHwpDataset(
  rows: HwpAttachmentRow[],
  options: { attachmentId?: string; limit?: number },
  dependencies: HwpAnalysisDependencies = {},
): Promise<HwpDatasetAnalysis> {
  const limits = dependencies.limits ?? getHwpAnalysisLimits();
  const startedAt = (dependencies.now ?? (() => new Date()))();
  const deadline = Date.now() + limits.overallTimeoutMs;
  const results: HwpAttachmentAnalysisResult[] = [];
  for (const row of rows) {
    if (Date.now() >= deadline) {
      results.push({
        ...row,
        fileUrl: maskUrl(row.fileUrl),
        maskedFileUrl: maskUrl(row.fileUrl),
        fileNameExtension: path.extname(row.fileName).slice(1).toUpperCase() || null,
        downloadSucceeded: false,
        byteSize: null,
        checksumSha256: null,
        container: null,
        detectedFileType: null,
        extensionMatchesActual: null,
        dbFileTypeMatchesActual: null,
        errorCode: 'HWP_LIMIT_EXCEEDED',
        errorMessage: 'Overall HWP analysis timeout was reached.',
      });
      continue;
    }
    results.push(await analyzeHwpAttachment(row, { ...dependencies, limits }));
  }
  return {
    analyzedAt: startedAt.toISOString(),
    selection: {
      isActive: true,
      fileTypes: ['HWP', 'HWPX'],
      ...(options.attachmentId ? { attachmentId: options.attachmentId } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
    },
    selectedCount: rows.length,
    results,
  };
}
