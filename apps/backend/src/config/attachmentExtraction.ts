import os from 'os';
import path from 'path';

const DEFAULT_ALLOWED_HOSTS = ['www.geumjeong.go.kr'];

function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

function allowedHosts(value: string | undefined) {
  const hosts = value
    ?.split(',')
    .map((host) => host.trim().toLowerCase())
    .filter((host) => host.length > 0 && host !== '*');
  return hosts && hosts.length > 0 ? hosts : DEFAULT_ALLOWED_HOSTS;
}

export type AttachmentExtractionConfig = {
  allowedHosts: readonly string[];
  downloadTimeoutMs: number;
  headTimeoutMs: number;
  maxFileSizeBytes: number;
  maxRedirects: number;
  concurrency: number;
  tempRootDir: string;
  networkRetries: number;
};

export function getAttachmentExtractionConfig(): AttachmentExtractionConfig {
  return {
    allowedHosts: allowedHosts(process.env.ATTACHMENT_ALLOWED_HOSTS),
    downloadTimeoutMs: positiveInteger(process.env.ATTACHMENT_DOWNLOAD_TIMEOUT_MS, 20_000, 120_000),
    headTimeoutMs: positiveInteger(process.env.ATTACHMENT_HEAD_TIMEOUT_MS, 10_000, 60_000),
    maxFileSizeBytes: positiveInteger(process.env.ATTACHMENT_MAX_FILE_SIZE_BYTES, 30 * 1024 * 1024, 100 * 1024 * 1024),
    maxRedirects: positiveInteger(process.env.ATTACHMENT_MAX_REDIRECTS, 3, 10),
    concurrency: positiveInteger(process.env.ATTACHMENT_EXTRACTION_CONCURRENCY, 1, 4),
    tempRootDir: process.env.ATTACHMENT_TEMP_DIR?.trim() || path.join(os.tmpdir(), 'moira-attachment-extraction'),
    networkRetries: 1,
  };
}
