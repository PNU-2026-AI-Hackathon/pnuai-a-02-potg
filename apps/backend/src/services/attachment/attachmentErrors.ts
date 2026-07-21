export type AttachmentErrorCode =
  | 'INVALID_URL'
  | 'HOST_NOT_ALLOWED'
  | 'PRIVATE_ADDRESS_BLOCKED'
  | 'REDIRECT_LIMIT_EXCEEDED'
  | 'DOWNLOAD_TIMEOUT'
  | 'DOWNLOAD_FAILED'
  | 'FILE_TOO_LARGE'
  | 'EMPTY_FILE'
  | 'HTML_RESPONSE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'FILE_TYPE_MISMATCH'
  | 'PDF_PARSE_FAILED'
  | 'OCR_REQUIRED'
  | 'TEMP_FILE_CLEANUP_FAILED'
  | 'UNKNOWN_ERROR';

export class AttachmentProcessingError extends Error {
  constructor(
    public readonly code: AttachmentErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'AttachmentProcessingError';
  }
}

export function safeAttachmentError(error: unknown) {
  if (error instanceof AttachmentProcessingError) return error;
  return new AttachmentProcessingError('UNKNOWN_ERROR', 'Unexpected attachment processing failure.');
}
