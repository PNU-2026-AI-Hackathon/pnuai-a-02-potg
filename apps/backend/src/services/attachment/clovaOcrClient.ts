import crypto from 'crypto';
import { openAsBlob } from 'fs';
import { ClovaOcrConfig, validateClovaOcrExecutionConfig } from '../../config/clovaOcr';
import { AttachmentErrorCode, AttachmentProcessingError } from './attachmentErrors';
import { OcrEngine, OcrImageFormat, OcrRecognitionResult } from './ocrEngine';
import { parseClovaOcrResponse } from './clovaOcrResponseParser';

export type ClovaOcrFetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
export type ClovaOcrClientDependencies = {
  fetchImplementation?: ClovaOcrFetch;
  sleep?: (milliseconds: number) => Promise<void>;
  randomUuid?: () => string;
  now?: () => number;
};

export class ClovaOcrRequestError extends AttachmentProcessingError {
  constructor(
    code: AttachmentErrorCode,
    message: string,
    retryable: boolean,
    public readonly httpStatus: number | null,
    public readonly attempts: number,
    public readonly stage: 'CONFIG' | 'REQUEST' | 'RESPONSE',
  ) {
    super(code, message, retryable);
    this.name = 'ClovaOcrRequestError';
  }
}

function requestError(code: AttachmentErrorCode, message: string, input: {
  retryable?: boolean;
  status?: number | null;
  attempts: number;
  stage: 'CONFIG' | 'REQUEST' | 'RESPONSE';
}) {
  return new ClovaOcrRequestError(code, message, input.retryable ?? false, input.status ?? null, input.attempts, input.stage);
}

export async function buildClovaOcrMultipart(input: {
  filePath: string;
  format: OcrImageFormat;
  requestId: string;
  timestamp: number;
}) {
  const form = new FormData();
  const normalizedFormat = input.format === 'jpeg' ? 'jpg' : input.format;
  const message = {
    version: 'V2',
    requestId: input.requestId,
    timestamp: input.timestamp,
    lang: 'ko',
    images: [{ format: normalizedFormat, name: 'ocr-input' }],
    enableTableDetection: false,
  };
  form.append('message', JSON.stringify(message));
  form.append('file', await openAsBlob(input.filePath, { type: normalizedFormat === 'png' ? 'image/png' : 'image/jpeg' }), `ocr-input.${normalizedFormat}`);
  return form;
}

async function readJsonResponse(response: Response, maximumBytes: number, attempts: number, timedOut: () => boolean) {
  if (!response.body) throw requestError('CLOVA_OCR_RESPONSE_INVALID', 'CLOVA OCR response is invalid.', { attempts, stage: 'RESPONSE' });
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw requestError('CLOVA_OCR_RESPONSE_TOO_LARGE', 'CLOVA OCR response exceeded the configured limit.', { attempts, stage: 'RESPONSE' });
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof AttachmentProcessingError) throw error;
    if (timedOut()) throw requestError('CLOVA_OCR_TIMEOUT', 'CLOVA OCR request timed out.', { attempts, stage: 'REQUEST' });
    throw requestError('CLOVA_OCR_RESPONSE_INVALID', 'CLOVA OCR response could not be read.', { attempts, stage: 'RESPONSE' });
  }
  const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw requestError('CLOVA_OCR_RESPONSE_INVALID', 'CLOVA OCR response is not valid UTF-8.', { attempts, stage: 'RESPONSE' }); }
  try { return JSON.parse(text) as unknown; }
  catch { throw requestError('CLOVA_OCR_RESPONSE_INVALID', 'CLOVA OCR response is not valid JSON.', { attempts, stage: 'RESPONSE' }); }
}

function httpError(status: number, attempts: number) {
  if (status === 400) return requestError('CLOVA_OCR_REQUEST_INVALID', 'CLOVA OCR request was rejected.', { status, attempts, stage: 'REQUEST' });
  if (status === 401) return requestError('CLOVA_OCR_AUTH_FAILED', 'CLOVA OCR authentication failed.', { status, attempts, stage: 'REQUEST' });
  if (status === 403) return requestError('CLOVA_OCR_FORBIDDEN', 'CLOVA OCR request is forbidden.', { status, attempts, stage: 'REQUEST' });
  if (status === 429) return requestError('CLOVA_OCR_RATE_LIMITED', 'CLOVA OCR request was rate limited.', { status, attempts, stage: 'REQUEST', retryable: true });
  if (status >= 500) return requestError('CLOVA_OCR_SERVER_ERROR', 'CLOVA OCR service returned an error.', { status, attempts, stage: 'REQUEST', retryable: true });
  return requestError('CLOVA_OCR_REQUEST_FAILED', 'CLOVA OCR request failed.', { status, attempts, stage: 'REQUEST' });
}

async function fetchWithTimeout(fetchImplementation: ClovaOcrFetch, config: ClovaOcrConfig, body: FormData, externalSignal: AbortSignal | undefined, attempts: number) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs);
  const onAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onAbort, { once: true });
  if (externalSignal?.aborted) onAbort();
  try {
    const response = await fetchImplementation(config.invokeUrl, {
      method: 'POST',
      headers: { 'X-OCR-SECRET': config.secret },
      body,
      signal: controller.signal,
    });
    return {
      response,
      timedOut: () => timedOut,
      cleanup: () => {
        clearTimeout(timeout);
        externalSignal?.removeEventListener('abort', onAbort);
      },
    };
  } catch {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort', onAbort);
    if (timedOut) throw requestError('CLOVA_OCR_TIMEOUT', 'CLOVA OCR request timed out.', { attempts, stage: 'REQUEST' });
    if (externalSignal?.aborted) throw requestError('CLOVA_OCR_REQUEST_FAILED', 'CLOVA OCR request was cancelled.', { attempts, stage: 'REQUEST' });
    throw requestError('CLOVA_OCR_REQUEST_FAILED', 'CLOVA OCR network request failed.', { attempts, stage: 'REQUEST', retryable: true });
  }
}

export async function requestClovaOcrResponse(input: {
  filePath: string;
  format: OcrImageFormat;
  signal?: AbortSignal;
}, config: ClovaOcrConfig, dependencies: ClovaOcrClientDependencies = {}) {
  validateClovaOcrExecutionConfig(config);
  const body = await buildClovaOcrMultipart({
    filePath: input.filePath,
    format: input.format,
    requestId: (dependencies.randomUuid ?? crypto.randomUUID)(),
    timestamp: (dependencies.now ?? Date.now)(),
  });
  const pending = await fetchWithTimeout(dependencies.fetchImplementation ?? fetch, config, body, input.signal, 1);
  try {
    if (!pending.response.ok) {
      await pending.response.body?.cancel().catch(() => undefined);
      throw httpError(pending.response.status, 1);
    }
    return await readJsonResponse(pending.response, config.responseMaxBytes, 1, pending.timedOut);
  } finally {
    pending.cleanup();
  }
}

export function createClovaOcrEngine(config: ClovaOcrConfig, dependencies: ClovaOcrClientDependencies = {}): OcrEngine {
  const fetchImplementation = dependencies.fetchImplementation || fetch;
  const sleep = dependencies.sleep || ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const randomUuid = dependencies.randomUuid || crypto.randomUUID;
  const now = dependencies.now || Date.now;
  return {
    async recognize(input): Promise<OcrRecognitionResult> {
      try { validateClovaOcrExecutionConfig(config); }
      catch (error) {
        if (error instanceof AttachmentProcessingError) throw requestError(error.code, error.message, { attempts: 0, stage: 'CONFIG' });
        throw requestError('CLOVA_OCR_CONFIG_MISSING', 'CLOVA OCR configuration is invalid.', { attempts: 0, stage: 'CONFIG' });
      }
      const startedAt = Date.now();
      let apiCallCount = 0;
      let lastError: AttachmentProcessingError | undefined;
      for (let retryCount = 0; retryCount <= config.maxRetries; retryCount += 1) {
        apiCallCount += 1;
        try {
          const body = await buildClovaOcrMultipart({ filePath: input.filePath, format: input.format, requestId: randomUuid(), timestamp: now() });
          const pending = await fetchWithTimeout(fetchImplementation, config, body, input.signal, apiCallCount);
          let parsed;
          try {
            if (!pending.response.ok) {
              await pending.response.body?.cancel().catch(() => undefined);
              throw httpError(pending.response.status, apiCallCount);
            }
            parsed = parseClovaOcrResponse(await readJsonResponse(pending.response, config.responseMaxBytes, apiCallCount, pending.timedOut));
          } finally {
            pending.cleanup();
          }
          return {
            ...parsed,
            engine: 'CLOVA_OCR',
            engineVersion: 'V2',
            durationMs: Date.now() - startedAt,
            apiCallCount,
            retryCount,
          };
        } catch (error) {
          lastError = error instanceof AttachmentProcessingError ? error : requestError('CLOVA_OCR_REQUEST_FAILED', 'CLOVA OCR request failed.', { attempts: apiCallCount, stage: 'REQUEST' });
          if (!lastError.retryable || retryCount >= config.maxRetries) throw lastError;
          await sleep(Math.min(100 * (2 ** retryCount), 1_000));
        }
      }
      throw lastError || requestError('CLOVA_OCR_REQUEST_FAILED', 'CLOVA OCR request failed.', { attempts: apiCallCount, stage: 'REQUEST' });
    },
  };
}
