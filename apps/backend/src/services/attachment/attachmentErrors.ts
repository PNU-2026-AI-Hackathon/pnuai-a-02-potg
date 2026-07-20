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
  | 'OCR_BINARY_NOT_FOUND'
  | 'OCR_VERSION_CHECK_FAILED'
  | 'OCR_LANGUAGE_DATA_MISSING'
  | 'OCR_TIMEOUT'
  | 'OCR_PROCESS_FAILED'
  | 'OCR_OUTPUT_TOO_LARGE'
  | 'IMAGE_DECODE_FAILED'
  | 'IMAGE_DIMENSIONS_MISSING'
  | 'IMAGE_DIMENSION_LIMIT_EXCEEDED'
  | 'IMAGE_PIXEL_LIMIT_EXCEEDED'
  | 'IMAGE_DECODE_MEMORY_LIMIT_EXCEEDED'
  | 'IMAGE_ANIMATION_UNSUPPORTED'
  | 'IMAGE_FORMAT_UNSUPPORTED'
  | 'IMAGE_PREPROCESS_FAILED'
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
