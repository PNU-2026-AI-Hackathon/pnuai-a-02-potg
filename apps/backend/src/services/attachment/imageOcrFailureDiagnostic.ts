import { AttachmentProcessingError, safeAttachmentError } from './attachmentErrors';

export type DiagnosticCategory = 'TEMPORARY_NETWORK' | 'PERMANENT_INPUT' | 'CODE_OR_POLICY' | 'UNKNOWN';

export function classifyImageAnalysisFailure(error: unknown, stage: string) {
  const safe = safeAttachmentError(error);
  const statusMatch = safe.message.match(/HTTP\s+(\d{3})/i);
  const httpStatus = statusMatch ? Number(statusMatch[1]) : null;
  let code = safe.code as string;
  let category: DiagnosticCategory = 'UNKNOWN';

  if (safe.code === 'DOWNLOAD_TIMEOUT') {
    code = 'REQUEST_TIMEOUT';
    category = 'TEMPORARY_NETWORK';
  } else if (safe.code === 'DOWNLOAD_FAILED') {
    if (httpStatus === 404) { code = 'HTTP_NOT_FOUND'; category = 'PERMANENT_INPUT'; }
    else if (httpStatus === 403) { code = 'HTTP_FORBIDDEN'; category = 'PERMANENT_INPUT'; }
    else if (httpStatus === 429) { code = 'HTTP_RATE_LIMITED'; category = 'TEMPORARY_NETWORK'; }
    else if (httpStatus && httpStatus >= 500) { code = 'HTTP_SERVER_ERROR'; category = 'TEMPORARY_NETWORK'; }
    else { code = 'NETWORK_CONNECTION_FAILED'; category = 'TEMPORARY_NETWORK'; }
  } else if (safe.code === 'HOST_NOT_ALLOWED') {
    code = 'SOURCE_NOT_ALLOWED';
    category = 'CODE_OR_POLICY';
  } else if (safe.code === 'PRIVATE_ADDRESS_BLOCKED' || safe.code === 'REDIRECT_LIMIT_EXCEEDED') {
    category = 'CODE_OR_POLICY';
  } else if (safe.code === 'HTML_RESPONSE') {
    code = 'HTML_RESPONSE_RECEIVED';
    category = 'PERMANENT_INPUT';
  } else if (safe.code === 'FILE_TYPE_MISMATCH') {
    code = 'SIGNATURE_METADATA_MISMATCH';
    category = 'PERMANENT_INPUT';
  } else if (['EMPTY_FILE', 'FILE_TOO_LARGE', 'UNSUPPORTED_FILE_TYPE', 'IMAGE_DECODE_FAILED',
    'IMAGE_DIMENSIONS_MISSING', 'IMAGE_ANIMATION_UNSUPPORTED', 'IMAGE_FORMAT_UNSUPPORTED'].includes(safe.code)) {
    category = 'PERMANENT_INPUT';
  } else if (safe instanceof AttachmentProcessingError && safe.code !== 'UNKNOWN_ERROR') {
    category = safe.retryable ? 'TEMPORARY_NETWORK' : 'PERMANENT_INPUT';
  }
  return {
    stage,
    code,
    httpStatus,
    category,
    retryCandidate: category === 'TEMPORARY_NETWORK',
    automaticOcrEligible: false,
  };
}
