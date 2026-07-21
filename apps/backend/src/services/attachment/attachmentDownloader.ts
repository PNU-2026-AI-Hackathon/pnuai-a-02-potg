import crypto from 'crypto';
import { createWriteStream } from 'fs';
import { mkdir, mkdtemp, rm } from 'fs/promises';
import path from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { AttachmentExtractionConfig, getAttachmentExtractionConfig } from '../../config/attachmentExtraction';
import { AttachmentProcessingError } from './attachmentErrors';
import { AddressResolver, validateAttachmentUrl } from './urlSecurity';

type FetchImplementation = typeof fetch;

export type DownloadedAttachment = {
  tempFilePath: string;
  byteSize: number;
  checksumSha256: string;
  responseContentType: string | null;
  finalHost: string;
  cleanup: () => Promise<void>;
};

type DownloaderDependencies = {
  fetchImplementation?: FetchImplementation;
  resolver?: AddressResolver;
};

function isRedirect(status: number) {
  return [301, 302, 303, 307, 308].includes(status);
}

function mapNetworkError(error: unknown) {
  if (error instanceof AttachmentProcessingError) return error;
  if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
    return new AttachmentProcessingError('DOWNLOAD_TIMEOUT', 'Attachment request timed out.', true);
  }
  return new AttachmentProcessingError('DOWNLOAD_FAILED', 'Attachment request failed.', true);
}

async function requestWithRedirects(
  initialUrl: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number,
  config: AttachmentExtractionConfig,
  fetchImplementation: FetchImplementation,
  resolver?: AddressResolver,
) {
  let current = initialUrl;
  for (let redirectCount = 0; ; redirectCount += 1) {
    const validated = await validateAttachmentUrl(current, config.allowedHosts, resolver);
    let response: Response;
    try {
      response = await fetchImplementation(validated, {
        method,
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'moira-attachment-extractor/1.0' },
      });
    } catch (error) {
      throw mapNetworkError(error);
    }
    if (!isRedirect(response.status)) return response;
    await response.body?.cancel();
    if (redirectCount >= config.maxRedirects) {
      throw new AttachmentProcessingError('REDIRECT_LIMIT_EXCEEDED', 'Attachment redirect limit was exceeded.');
    }
    const location = response.headers.get('location');
    if (!location) throw new AttachmentProcessingError('DOWNLOAD_FAILED', 'Attachment redirect is missing a location.');
    current = new URL(location, validated).toString();
  }
}

function contentLength(response: Response) {
  const value = response.headers.get('content-length');
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

async function getWithRetry(
  url: string,
  config: AttachmentExtractionConfig,
  fetchImplementation: FetchImplementation,
  resolver?: AddressResolver,
) {
  let lastError: AttachmentProcessingError | undefined;
  for (let attempt = 0; attempt <= config.networkRetries; attempt += 1) {
    try {
      const response = await requestWithRedirects(url, 'GET', config.downloadTimeoutMs, config, fetchImplementation, resolver);
      if (response.status >= 500) {
        await response.body?.cancel();
        lastError = new AttachmentProcessingError('DOWNLOAD_FAILED', 'Attachment server returned an error.', true);
        continue;
      }
      return response;
    } catch (error) {
      const mapped = mapNetworkError(error);
      if (!mapped.retryable || attempt === config.networkRetries) throw mapped;
      lastError = mapped;
    }
  }
  throw lastError || new AttachmentProcessingError('DOWNLOAD_FAILED', 'Attachment request failed.');
}

export async function downloadAttachment(
  url: string,
  overrides: Partial<AttachmentExtractionConfig> = {},
  dependencies: DownloaderDependencies = {},
): Promise<DownloadedAttachment> {
  const config = { ...getAttachmentExtractionConfig(), ...overrides };
  const fetchImplementation = dependencies.fetchImplementation || fetch;

  try {
    const head = await requestWithRedirects(url, 'HEAD', config.headTimeoutMs, config, fetchImplementation, dependencies.resolver);
    const declaredSize = contentLength(head);
    await head.body?.cancel();
    if (declaredSize !== null && declaredSize > config.maxFileSizeBytes) {
      throw new AttachmentProcessingError('FILE_TOO_LARGE', 'Attachment exceeds the configured size limit.');
    }
  } catch (error) {
    const mapped = mapNetworkError(error);
    if (['HOST_NOT_ALLOWED', 'PRIVATE_ADDRESS_BLOCKED', 'INVALID_URL', 'REDIRECT_LIMIT_EXCEEDED', 'FILE_TOO_LARGE'].includes(mapped.code)) {
      throw mapped;
    }
  }

  const response = await getWithRetry(url, config, fetchImplementation, dependencies.resolver);
  if (!response.ok) {
    await response.body?.cancel();
    throw new AttachmentProcessingError('DOWNLOAD_FAILED', `Attachment server returned HTTP ${response.status}.`);
  }
  const declaredSize = contentLength(response);
  if (declaredSize !== null && declaredSize > config.maxFileSizeBytes) {
    await response.body?.cancel();
    throw new AttachmentProcessingError('FILE_TOO_LARGE', 'Attachment exceeds the configured size limit.');
  }
  if (!response.body) throw new AttachmentProcessingError('DOWNLOAD_FAILED', 'Attachment response has no body.');

  await mkdir(config.tempRootDir, { recursive: true, mode: 0o700 });
  const tempDir = await mkdtemp(path.join(config.tempRootDir, 'job-'));
  const tempFilePath = path.join(tempDir, 'attachment.bin');
  const hash = crypto.createHash('sha256');
  let byteSize = 0;
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    await rm(tempDir, { recursive: true, force: true });
    cleaned = true;
  };

  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      byteSize += chunk.length;
      if (byteSize > config.maxFileSizeBytes) {
        callback(new AttachmentProcessingError('FILE_TOO_LARGE', 'Attachment exceeds the configured size limit.'));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(Readable.fromWeb(response.body as never), limiter, createWriteStream(tempFilePath, { mode: 0o600 }));
    if (byteSize === 0) throw new AttachmentProcessingError('EMPTY_FILE', 'Downloaded attachment is empty.');
    return {
      tempFilePath,
      byteSize,
      checksumSha256: hash.digest('hex'),
      responseContentType: response.headers.get('content-type'),
      finalHost: new URL(response.url || url).hostname,
      cleanup,
    };
  } catch (error) {
    await cleanup().catch(() => undefined);
    throw error instanceof AttachmentProcessingError ? error : mapNetworkError(error);
  }
}
