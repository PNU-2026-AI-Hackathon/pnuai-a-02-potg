function integerSetting(name: string, value: string | undefined, fallback: number, minimum: number, maximum: number) {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

export type AttachmentOcrConfig = {
  imageMaxWidth: number;
  imageMaxHeight: number;
  imageMaxPixels: number;
  imageMaxDecodeBytes: number;
  imageOcrMaxLongEdge: number;
  preprocessedMaxBytes: number;
  pdfRenderTimeoutMs: number;
  pdfRenderDpi: number;
  pdfOcrMaxPages: number;
};

export function getAttachmentOcrConfig(environment: NodeJS.ProcessEnv = process.env): AttachmentOcrConfig {
  return {
    imageMaxWidth: integerSetting('ATTACHMENT_IMAGE_MAX_WIDTH', environment.ATTACHMENT_IMAGE_MAX_WIDTH, 12_000, 1, 50_000),
    imageMaxHeight: integerSetting('ATTACHMENT_IMAGE_MAX_HEIGHT', environment.ATTACHMENT_IMAGE_MAX_HEIGHT, 12_000, 1, 50_000),
    imageMaxPixels: integerSetting('ATTACHMENT_IMAGE_MAX_PIXELS', environment.ATTACHMENT_IMAGE_MAX_PIXELS, 40_000_000, 1, 250_000_000),
    imageMaxDecodeBytes: integerSetting('ATTACHMENT_IMAGE_MAX_DECODE_BYTES', environment.ATTACHMENT_IMAGE_MAX_DECODE_BYTES, 160_000_000, 1, 1_000_000_000),
    imageOcrMaxLongEdge: integerSetting('ATTACHMENT_IMAGE_OCR_MAX_LONG_EDGE', environment.ATTACHMENT_IMAGE_OCR_MAX_LONG_EDGE, 4_000, 1, 20_000),
    preprocessedMaxBytes: 30 * 1024 * 1024,
    pdfRenderTimeoutMs: integerSetting('ATTACHMENT_PDF_RENDER_TIMEOUT_MS', environment.ATTACHMENT_PDF_RENDER_TIMEOUT_MS, 30_000, 1_000, 600_000),
    pdfRenderDpi: integerSetting('ATTACHMENT_PDF_RENDER_DPI', environment.ATTACHMENT_PDF_RENDER_DPI, 200, 72, 600),
    pdfOcrMaxPages: integerSetting('ATTACHMENT_PDF_OCR_MAX_PAGES', environment.ATTACHMENT_PDF_OCR_MAX_PAGES, 50, 1, 500),
  };
}
