import { stat, unlink } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { AttachmentOcrConfig } from '../../config/attachmentOcr';
import { AttachmentProcessingError } from './attachmentErrors';

export type PreprocessedImage = {
  filePath: string;
  width: number;
  height: number;
  byteSize: number;
  cleanup: () => Promise<void>;
};

function containedPath(workDirectory: string, fileName: string) {
  const root = path.resolve(workDirectory);
  const candidate = path.resolve(root, fileName);
  if (path.dirname(candidate) !== root) throw new AttachmentProcessingError('IMAGE_PREPROCESS_FAILED', 'Image work path is invalid.');
  return candidate;
}

export async function preprocessImage(
  sourcePath: string,
  workDirectory: string,
  config: AttachmentOcrConfig,
): Promise<PreprocessedImage> {
  const outputPath = containedPath(workDirectory, 'ocr-input.png');
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    await unlink(outputPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  };
  try {
    const info = await sharp(sourcePath, { limitInputPixels: config.imageMaxPixels, failOn: 'error' })
      .rotate()
      .flatten({ background: '#ffffff' })
      .resize({ width: config.imageOcrMaxLongEdge, height: config.imageOcrMaxLongEdge, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
      .toFile(outputPath);
    const byteSize = (await stat(outputPath)).size;
    if (byteSize > config.preprocessedMaxBytes) {
      throw new AttachmentProcessingError('FILE_TOO_LARGE', 'Preprocessed image exceeds the configured size limit.');
    }
    return { filePath: outputPath, width: info.width, height: info.height, byteSize, cleanup };
  } catch (error) {
    await cleanup().catch(() => undefined);
    if (error instanceof AttachmentProcessingError) throw error;
    throw new AttachmentProcessingError('IMAGE_PREPROCESS_FAILED', 'Image preprocessing failed.');
  }
}
