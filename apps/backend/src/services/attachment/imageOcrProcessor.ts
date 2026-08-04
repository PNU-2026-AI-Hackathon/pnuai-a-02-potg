import { AttachmentOcrConfig } from '../../config/attachmentOcr';
import { detectAttachmentFileType } from './fileTypeDetector';
import { inspectImageMetadata, ValidatedImageMetadata } from './imageMetadata';
import { preprocessImage } from './imagePreprocessor';
import { OcrEngine, OcrRecognitionResult } from './ocrEngine';

export type ImageOcrProcessorDependencies = {
  detector?: typeof detectAttachmentFileType;
  metadataInspector?: typeof inspectImageMetadata;
  preprocessor?: typeof preprocessImage;
};

export type ImageOcrProcessingResult = {
  detectedFormat: 'JPEG' | 'PNG';
  width: number;
  height: number;
  pixelCount: number;
  preprocessedWidth: number;
  preprocessedHeight: number;
  engine: string;
  engineVersion: string;
  rawText: string;
  cleanedText: string;
  isEmpty: boolean;
  durationMs: number;
  apiCallCount: number;
  retryCount: number;
  averageConfidence?: number;
  fieldCount?: number;
  readingOrderStrategy?: OcrRecognitionResult['readingOrderStrategy'];
};

export function imageOcrLogSummary(result: ImageOcrProcessingResult) {
  return {
    detectedFormat: result.detectedFormat,
    width: result.width,
    height: result.height,
    pixelCount: result.pixelCount,
    preprocessedWidth: result.preprocessedWidth,
    preprocessedHeight: result.preprocessedHeight,
    engine: result.engine,
    engineVersion: result.engineVersion,
    isEmpty: result.isEmpty,
    durationMs: result.durationMs,
    apiCallCount: result.apiCallCount,
    retryCount: result.retryCount,
    averageConfidence: result.averageConfidence,
    fieldCount: result.fieldCount,
    readingOrderStrategy: result.readingOrderStrategy,
  };
}

export async function processImageForOcr(input: {
  sourcePath: string;
  workDirectory: string;
  expectedType: 'JPEG' | 'PNG';
  ocrEngine: OcrEngine;
  signal?: AbortSignal;
}, config: AttachmentOcrConfig, dependencies: ImageOcrProcessorDependencies = {}): Promise<ImageOcrProcessingResult> {
  const detector = dependencies.detector || detectAttachmentFileType;
  const metadataInspector = dependencies.metadataInspector || inspectImageMetadata;
  const preprocessor = dependencies.preprocessor || preprocessImage;
  const startedAt = Date.now();
  const detection = await detector({ filePath: input.sourcePath, dbFileType: input.expectedType, requireExpectedMatch: true });
  if (detection.detectedFileType !== 'JPEG' && detection.detectedFileType !== 'PNG') throw new Error('Image detector returned a non-image type.');
  const metadata: ValidatedImageMetadata = await metadataInspector(input.sourcePath, config);
  let prepared: Awaited<ReturnType<typeof preprocessImage>> | undefined;
  try {
    prepared = await preprocessor(input.sourcePath, input.workDirectory, config);
    const result = await input.ocrEngine.recognize({ filePath: prepared.filePath, format: 'png', signal: input.signal });
    return {
      detectedFormat: detection.detectedFileType,
      width: metadata.width,
      height: metadata.height,
      pixelCount: metadata.pixelCount,
      preprocessedWidth: prepared.width,
      preprocessedHeight: prepared.height,
      engine: result.engine,
      engineVersion: result.engineVersion,
      rawText: result.rawText,
      cleanedText: result.cleanedText,
      isEmpty: result.isEmpty,
      durationMs: Date.now() - startedAt,
      apiCallCount: result.apiCallCount,
      retryCount: result.retryCount,
      averageConfidence: result.averageConfidence,
      fieldCount: result.fieldCount,
      readingOrderStrategy: result.readingOrderStrategy,
    };
  } finally {
    await prepared?.cleanup().catch(() => undefined);
  }
}
