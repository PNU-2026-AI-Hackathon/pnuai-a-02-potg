import path from 'path';

const LANGUAGE_PATTERN = /^[a-z0-9_]+(?:\+[a-z0-9_]+)*$/;

function integerSetting(name: string, value: string | undefined, fallback: number, minimum: number, maximum: number) {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function executableSetting(value: string | undefined, fallback: string) {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  if (candidate.includes('\0') || candidate.includes('\r') || candidate.includes('\n')) {
    throw new Error('OCR executable path contains invalid characters.');
  }
  return path.normalize(candidate);
}

export type AttachmentOcrConfig = {
  tesseractPath: string;
  languages: string[];
  languageArgument: string;
  psm: number;
  ocrTimeoutMs: number;
  ocrOutputMaxBytes: number;
  subprocessStdoutMaxBytes: number;
  subprocessStderrMaxBytes: number;
  imageMaxWidth: number;
  imageMaxHeight: number;
  imageMaxPixels: number;
  imageMaxDecodeBytes: number;
  imageOcrMaxLongEdge: number;
  preprocessedMaxBytes: number;
  pdfRendererPath: string;
  pdfRenderTimeoutMs: number;
  pdfRenderDpi: number;
  pdfOcrMaxPages: number;
};

export function getAttachmentOcrConfig(environment: NodeJS.ProcessEnv = process.env): AttachmentOcrConfig {
  const languageArgument = environment.ATTACHMENT_OCR_LANGUAGES?.trim() || 'kor+eng';
  if (!LANGUAGE_PATTERN.test(languageArgument)) {
    throw new Error('ATTACHMENT_OCR_LANGUAGES must be a plus-separated lowercase language list.');
  }
  return {
    tesseractPath: executableSetting(environment.ATTACHMENT_OCR_TESSERACT_PATH, 'tesseract'),
    languages: languageArgument.split('+'),
    languageArgument,
    psm: integerSetting('ATTACHMENT_OCR_PSM', environment.ATTACHMENT_OCR_PSM, 6, 0, 13),
    ocrTimeoutMs: integerSetting('ATTACHMENT_OCR_TIMEOUT_MS', environment.ATTACHMENT_OCR_TIMEOUT_MS, 60_000, 1_000, 600_000),
    ocrOutputMaxBytes: integerSetting('ATTACHMENT_OCR_OUTPUT_MAX_BYTES', environment.ATTACHMENT_OCR_OUTPUT_MAX_BYTES, 5 * 1024 * 1024, 1, 20 * 1024 * 1024),
    subprocessStdoutMaxBytes: 64 * 1024,
    subprocessStderrMaxBytes: 64 * 1024,
    imageMaxWidth: integerSetting('ATTACHMENT_IMAGE_MAX_WIDTH', environment.ATTACHMENT_IMAGE_MAX_WIDTH, 12_000, 1, 50_000),
    imageMaxHeight: integerSetting('ATTACHMENT_IMAGE_MAX_HEIGHT', environment.ATTACHMENT_IMAGE_MAX_HEIGHT, 12_000, 1, 50_000),
    imageMaxPixels: integerSetting('ATTACHMENT_IMAGE_MAX_PIXELS', environment.ATTACHMENT_IMAGE_MAX_PIXELS, 40_000_000, 1, 250_000_000),
    imageMaxDecodeBytes: integerSetting('ATTACHMENT_IMAGE_MAX_DECODE_BYTES', environment.ATTACHMENT_IMAGE_MAX_DECODE_BYTES, 160_000_000, 1, 1_000_000_000),
    imageOcrMaxLongEdge: integerSetting('ATTACHMENT_IMAGE_OCR_MAX_LONG_EDGE', environment.ATTACHMENT_IMAGE_OCR_MAX_LONG_EDGE, 4_000, 1, 20_000),
    preprocessedMaxBytes: 30 * 1024 * 1024,
    pdfRendererPath: executableSetting(environment.ATTACHMENT_PDF_RENDERER_PATH, 'pdftocairo'),
    pdfRenderTimeoutMs: integerSetting('ATTACHMENT_PDF_RENDER_TIMEOUT_MS', environment.ATTACHMENT_PDF_RENDER_TIMEOUT_MS, 30_000, 1_000, 600_000),
    pdfRenderDpi: integerSetting('ATTACHMENT_PDF_RENDER_DPI', environment.ATTACHMENT_PDF_RENDER_DPI, 200, 72, 600),
    pdfOcrMaxPages: integerSetting('ATTACHMENT_PDF_OCR_MAX_PAGES', environment.ATTACHMENT_PDF_OCR_MAX_PAGES, 50, 1, 500),
  };
}
