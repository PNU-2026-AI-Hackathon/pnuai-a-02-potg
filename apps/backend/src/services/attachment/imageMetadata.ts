import sharp from 'sharp';
import { AttachmentOcrConfig } from '../../config/attachmentOcr';
import { AttachmentProcessingError } from './attachmentErrors';

export type ValidatedImageMetadata = {
  format: 'jpeg' | 'png';
  width: number;
  height: number;
  pages: number;
  orientation: number | null;
  hasAlpha: boolean;
  pixelCount: number;
  estimatedRgbaBytes: number;
};

export async function inspectImageMetadata(filePath: string, config: AttachmentOcrConfig): Promise<ValidatedImageMetadata> {
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    metadata = await sharp(filePath, { limitInputPixels: config.imageMaxPixels, animated: true, failOn: 'error' }).metadata();
  } catch (error) {
    if (error instanceof Error && /pixel limit/i.test(error.message)) {
      throw new AttachmentProcessingError('IMAGE_PIXEL_LIMIT_EXCEEDED', 'Image pixel count exceeds the configured limit.');
    }
    throw new AttachmentProcessingError('IMAGE_DECODE_FAILED', 'Image metadata could not be decoded.');
  }
  const pages = metadata.pages ?? 1;
  if (pages > 1) throw new AttachmentProcessingError('IMAGE_ANIMATION_UNSUPPORTED', 'Animated or multi-page images are not supported.');
  if (metadata.format !== 'jpeg' && metadata.format !== 'png') {
    throw new AttachmentProcessingError('IMAGE_FORMAT_UNSUPPORTED', 'Only JPEG and PNG images are supported.');
  }
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height || width <= 0 || height <= 0) {
    throw new AttachmentProcessingError('IMAGE_DIMENSIONS_MISSING', 'Image dimensions are missing.');
  }
  if (width > config.imageMaxWidth || height > config.imageMaxHeight) {
    throw new AttachmentProcessingError('IMAGE_DIMENSION_LIMIT_EXCEEDED', 'Image dimensions exceed the configured limit.');
  }
  const pixelCount = width * height;
  if (!Number.isSafeInteger(pixelCount) || pixelCount > config.imageMaxPixels) {
    throw new AttachmentProcessingError('IMAGE_PIXEL_LIMIT_EXCEEDED', 'Image pixel count exceeds the configured limit.');
  }
  const estimatedRgbaBytes = pixelCount * 4;
  if (!Number.isSafeInteger(estimatedRgbaBytes) || estimatedRgbaBytes > config.imageMaxDecodeBytes) {
    throw new AttachmentProcessingError('IMAGE_DECODE_MEMORY_LIMIT_EXCEEDED', 'Estimated image decode memory exceeds the configured limit.');
  }
  if (Math.max(width / height, height / width) > 100) {
    throw new AttachmentProcessingError('IMAGE_DIMENSION_LIMIT_EXCEEDED', 'Image aspect ratio exceeds the configured safety limit.');
  }
  return {
    format: metadata.format,
    width,
    height,
    pages,
    orientation: metadata.orientation ?? null,
    hasAlpha: metadata.hasAlpha ?? false,
    pixelCount,
    estimatedRgbaBytes,
  };
}
