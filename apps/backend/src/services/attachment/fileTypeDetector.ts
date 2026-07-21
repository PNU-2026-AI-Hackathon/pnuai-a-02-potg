import { open } from 'fs/promises';
import path from 'path';
import { AttachmentProcessingError } from './attachmentErrors';

export type DetectedAttachmentType = 'PDF' | 'HWP' | 'HWPX' | 'JPEG' | 'PNG';

export type FileTypeDetection = {
  detectedFileType: DetectedAttachmentType;
  detectedMimeType: string;
  fileNameExtension: string | null;
  matchesExpectedType: boolean;
};

const MIME_BY_TYPE: Record<DetectedAttachmentType, string> = {
  PDF: 'application/pdf',
  HWP: 'application/x-hwp',
  HWPX: 'application/hwp+zip',
  JPEG: 'image/jpeg',
  PNG: 'image/png',
};

function expectedType(value: string | null | undefined) {
  const normalized = value?.trim().replace(/^\./, '').toUpperCase();
  if (normalized === 'JPG') return 'JPEG';
  return normalized || null;
}

function isHtml(sample: Buffer, responseContentType?: string | null) {
  if (responseContentType?.toLowerCase().split(';')[0].trim() === 'text/html') return true;
  const text = sample.subarray(0, 1024).toString('utf8').replace(/^\uFEFF/, '').trimStart().toLowerCase();
  return text.startsWith('<!doctype html') || text.startsWith('<html') || text.startsWith('<head') || text.startsWith('<body');
}

function detectFromSample(sample: Buffer): DetectedAttachmentType | null {
  if (sample.subarray(0, 5).toString('ascii') === '%PDF-') return 'PDF';
  if (sample.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))) return 'HWP';
  if (sample.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) return 'JPEG';
  if (sample.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'PNG';
  if (sample.subarray(0, 4).equals(Buffer.from('504b0304', 'hex'))) {
    const zipText = sample.toString('latin1');
    if (zipText.includes('application/hwp+zip') || (zipText.includes('Contents/') && zipText.includes('content.hpf'))) {
      return 'HWPX';
    }
  }
  return null;
}

export async function detectAttachmentFileType(input: {
  filePath: string;
  fileName?: string | null;
  dbFileType?: string | null;
  responseContentType?: string | null;
  requireExpectedMatch?: boolean;
}): Promise<FileTypeDetection> {
  const handle = await open(input.filePath, 'r');
  const sample = Buffer.alloc(128 * 1024);
  let bytesRead = 0;
  try {
    ({ bytesRead } = await handle.read(sample, 0, sample.length, 0));
  } finally {
    await handle.close();
  }
  const content = sample.subarray(0, bytesRead);
  if (content.length === 0) throw new AttachmentProcessingError('EMPTY_FILE', 'Downloaded attachment is empty.');
  if (isHtml(content, input.responseContentType)) {
    throw new AttachmentProcessingError('HTML_RESPONSE', 'Attachment response contains an HTML document.');
  }
  const detectedFileType = detectFromSample(content);
  if (!detectedFileType) {
    throw new AttachmentProcessingError('UNSUPPORTED_FILE_TYPE', 'Attachment file type is not supported.');
  }

  const fileNameExtension = input.fileName ? path.extname(input.fileName).slice(1).toUpperCase() || null : null;
  const expected = expectedType(input.dbFileType || fileNameExtension);
  const matchesExpectedType = expected === null || expected === detectedFileType;
  if (input.requireExpectedMatch && !matchesExpectedType) {
    throw new AttachmentProcessingError('FILE_TYPE_MISMATCH', 'Attachment metadata does not match the downloaded file type.');
  }
  return {
    detectedFileType,
    detectedMimeType: MIME_BY_TYPE[detectedFileType],
    fileNameExtension,
    matchesExpectedType,
  };
}
