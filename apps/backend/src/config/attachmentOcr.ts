function integerSetting(name: string, value: string | undefined, fallback: number, minimum: number, maximum: number) {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function ratioSetting(name: string, value: string | undefined, fallback: number) {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${name} must be a number from 0 to 1.`);
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
  pdfRenderExecutable: string;
  pdfRenderTimeoutMs: number;
  pdfRenderDpi: number;
  pdfOcrMaxPages: number;
  pdfRenderMaxBytes: number;
  /**
   * 허용하는 OCR API 호출 총량. 도달하면 남은 대상은 처리하지 않고 중단한다.
   *
   * 실행 1회가 아니라 **누적** 기준이다. 대상을 나눠 실행하는 것이 기본 운영 방식이라
   * 실행 단위로 세면 총합이 상한을 넘어도 막히지 않는다.
   */
  ocrMaxCalls: number;
  /** 이 값보다 평균 신뢰도가 낮으면 자동 반영하지 않고 사람 검수로 보낸다. */
  ocrMinConfidence: number;
};

export function getAttachmentOcrConfig(environment: NodeJS.ProcessEnv = process.env): AttachmentOcrConfig {
  return {
    imageMaxWidth: integerSetting('ATTACHMENT_IMAGE_MAX_WIDTH', environment.ATTACHMENT_IMAGE_MAX_WIDTH, 12_000, 1, 50_000),
    imageMaxHeight: integerSetting('ATTACHMENT_IMAGE_MAX_HEIGHT', environment.ATTACHMENT_IMAGE_MAX_HEIGHT, 12_000, 1, 50_000),
    imageMaxPixels: integerSetting('ATTACHMENT_IMAGE_MAX_PIXELS', environment.ATTACHMENT_IMAGE_MAX_PIXELS, 40_000_000, 1, 250_000_000),
    imageMaxDecodeBytes: integerSetting('ATTACHMENT_IMAGE_MAX_DECODE_BYTES', environment.ATTACHMENT_IMAGE_MAX_DECODE_BYTES, 160_000_000, 1, 1_000_000_000),
    imageOcrMaxLongEdge: integerSetting('ATTACHMENT_IMAGE_OCR_MAX_LONG_EDGE', environment.ATTACHMENT_IMAGE_OCR_MAX_LONG_EDGE, 4_000, 1, 20_000),
    preprocessedMaxBytes: 30 * 1024 * 1024,
    pdfRenderExecutable: environment.ATTACHMENT_PDF_RENDER_EXECUTABLE?.trim() || 'pdftocairo',
    pdfRenderTimeoutMs: integerSetting('ATTACHMENT_PDF_RENDER_TIMEOUT_MS', environment.ATTACHMENT_PDF_RENDER_TIMEOUT_MS, 30_000, 1_000, 600_000),
    pdfRenderDpi: integerSetting('ATTACHMENT_PDF_RENDER_DPI', environment.ATTACHMENT_PDF_RENDER_DPI, 200, 72, 600),
    pdfOcrMaxPages: integerSetting('ATTACHMENT_PDF_OCR_MAX_PAGES', environment.ATTACHMENT_PDF_OCR_MAX_PAGES, 50, 1, 50),
    pdfRenderMaxBytes: integerSetting('ATTACHMENT_PDF_RENDER_MAX_BYTES', environment.ATTACHMENT_PDF_RENDER_MAX_BYTES, 20 * 1024 * 1024, 1, 100 * 1024 * 1024),
    ocrMaxCalls: integerSetting('ATTACHMENT_OCR_MAX_CALLS', environment.ATTACHMENT_OCR_MAX_CALLS, 500, 1, 2_000),
    ocrMinConfidence: ratioSetting('ATTACHMENT_OCR_MIN_CONFIDENCE', environment.ATTACHMENT_OCR_MIN_CONFIDENCE, 0.8),
  };
}
