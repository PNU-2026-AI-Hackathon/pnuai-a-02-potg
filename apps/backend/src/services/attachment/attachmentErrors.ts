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
  | 'SUBPROCESS_NOT_FOUND'
  | 'SUBPROCESS_TIMEOUT'
  | 'SUBPROCESS_OUTPUT_LIMIT_EXCEEDED'
  | 'SUBPROCESS_EXIT_FAILED'
  | 'SUBPROCESS_TERMINATED'
  | 'CLOVA_OCR_DISABLED'
  | 'CLOVA_OCR_CONFIG_MISSING'
  | 'CLOVA_OCR_AUTH_FAILED'
  | 'CLOVA_OCR_FORBIDDEN'
  | 'CLOVA_OCR_RATE_LIMITED'
  | 'CLOVA_OCR_TIMEOUT'
  | 'CLOVA_OCR_REQUEST_INVALID'
  | 'CLOVA_OCR_REQUEST_FAILED'
  | 'CLOVA_OCR_SERVER_ERROR'
  | 'CLOVA_OCR_RESPONSE_TOO_LARGE'
  | 'CLOVA_OCR_RESPONSE_INVALID'
  | 'CLOVA_OCR_IMAGE_FAILED'
  | 'IMAGE_DECODE_FAILED'
  | 'IMAGE_DIMENSIONS_MISSING'
  | 'IMAGE_DIMENSION_LIMIT_EXCEEDED'
  | 'IMAGE_PIXEL_LIMIT_EXCEEDED'
  | 'IMAGE_DECODE_MEMORY_LIMIT_EXCEEDED'
  | 'IMAGE_ANIMATION_UNSUPPORTED'
  | 'IMAGE_FORMAT_UNSUPPORTED'
  | 'IMAGE_PREPROCESS_FAILED'
  | 'CHECKSUM_DONOR_CONFLICT'
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
