import { AttachmentProcessingError } from '../services/attachment/attachmentErrors';

function booleanSetting(value: string | undefined) {
  if (value === undefined || value.trim() === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new AttachmentProcessingError('CLOVA_OCR_CONFIG_MISSING', 'CLOVA OCR enabled setting is invalid.');
}

function integerSetting(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new AttachmentProcessingError('CLOVA_OCR_CONFIG_MISSING', 'CLOVA OCR numeric setting is invalid.');
  }
  return parsed;
}

export type ClovaOcrConfig = {
  enabled: boolean;
  invokeUrl: string;
  secret: string;
  timeoutMs: number;
  responseMaxBytes: number;
  maxRetries: number;
};

export function getClovaOcrConfig(environment: NodeJS.ProcessEnv = process.env): ClovaOcrConfig {
  return {
    enabled: booleanSetting(environment.CLOVA_OCR_ENABLED),
    invokeUrl: environment.CLOVA_OCR_INVOKE_URL?.trim() || '',
    secret: environment.CLOVA_OCR_SECRET?.trim() || '',
    timeoutMs: integerSetting(environment.CLOVA_OCR_TIMEOUT_MS, 30_000, 1_000, 120_000),
    responseMaxBytes: integerSetting(environment.CLOVA_OCR_RESPONSE_MAX_BYTES, 5 * 1024 * 1024, 1, 20 * 1024 * 1024),
    maxRetries: integerSetting(environment.CLOVA_OCR_MAX_RETRIES, 1, 0, 2),
  };
}

export function validateClovaOcrExecutionConfig(config: ClovaOcrConfig) {
  if (!config.enabled) throw new AttachmentProcessingError('CLOVA_OCR_DISABLED', 'CLOVA OCR is disabled.');
  if (!config.invokeUrl || !config.secret) throw new AttachmentProcessingError('CLOVA_OCR_CONFIG_MISSING', 'CLOVA OCR configuration is incomplete.');
  let url: URL;
  try { url = new URL(config.invokeUrl); }
  catch { throw new AttachmentProcessingError('CLOVA_OCR_CONFIG_MISSING', 'CLOVA OCR invoke URL is invalid.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new AttachmentProcessingError('CLOVA_OCR_CONFIG_MISSING', 'CLOVA OCR invoke URL is invalid.');
  }
}

export function clovaOcrConfigSummary(config: ClovaOcrConfig) {
  return {
    enabled: config.enabled,
    invokeUrlConfigured: config.invokeUrl.length > 0,
    secretConfigured: config.secret.length > 0,
    timeoutMs: config.timeoutMs,
    maxRetries: config.maxRetries,
  };
}
