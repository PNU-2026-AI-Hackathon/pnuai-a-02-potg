import { AttachmentProcessingError } from './attachmentErrors';
import { cleanExtractedText, sanitizeRawTextForStorage } from './pdfTextExtractor';

type Vertex = { x: number; y: number };
type ParsedField = {
  index: number;
  inferText: string;
  inferConfidence: number;
  lineBreak?: boolean;
  top: number;
  left: number;
  right: number;
  bottom: number;
};

/**
 * 인식된 글자 조각과 그 위치.
 *
 * 포스터의 회차표는 평탄한 텍스트로는 열이 뒤섞여 복원할 수 없다.
 * 좌표가 있어야 같은 행·같은 열을 묶을 수 있으므로 결과에 남긴다.
 */
export type OcrTextBox = {
  text: string;
  top: number;
  left: number;
  right: number;
  bottom: number;
  confidence: number;
};

export type ClovaOcrParsedResult = {
  rawText: string;
  cleanedText: string;
  fieldCount: number;
  isEmpty: boolean;
  averageConfidence: number | undefined;
  readingOrderStrategy: 'LINE_BREAK' | 'COORDINATE';
  boxes: OcrTextBox[];
};

function invalidResponse(): never {
  throw new AttachmentProcessingError('CLOVA_OCR_RESPONSE_INVALID', 'CLOVA OCR response is invalid.');
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse();
  return value as Record<string, unknown>;
}

function vertices(value: unknown): Vertex[] {
  const polygon = record(value);
  if (!Array.isArray(polygon.vertices) || polygon.vertices.length === 0) invalidResponse();
  return polygon.vertices.map((item) => {
    const vertex = record(item);
    if (typeof vertex.x !== 'number' || !Number.isFinite(vertex.x) || typeof vertex.y !== 'number' || !Number.isFinite(vertex.y)) invalidResponse();
    return { x: vertex.x, y: vertex.y };
  });
}

function parseField(value: unknown, index: number): ParsedField {
  const field = record(value);
  if (typeof field.inferText !== 'string') invalidResponse();
  if (typeof field.inferConfidence !== 'number' || !Number.isFinite(field.inferConfidence) || field.inferConfidence < 0 || field.inferConfidence > 1) invalidResponse();
  if (field.lineBreak !== undefined && typeof field.lineBreak !== 'boolean') invalidResponse();
  const points = vertices(field.boundingPoly);
  return {
    index,
    inferText: field.inferText,
    inferConfidence: field.inferConfidence,
    lineBreak: field.lineBreak as boolean | undefined,
    top: Math.min(...points.map((point) => point.y)),
    left: Math.min(...points.map((point) => point.x)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y)),
  };
}

function lineBreakText(fields: readonly ParsedField[]) {
  let output = '';
  for (const field of fields) {
    const text = field.inferText.trim();
    if (text) output += `${output && !output.endsWith('\n') ? ' ' : ''}${text}`;
    if (field.lineBreak && output && !output.endsWith('\n')) output += '\n';
  }
  return output.trim();
}

function coordinateText(fields: readonly ParsedField[]) {
  return [...fields]
    .sort((left, right) => left.top - right.top || left.left - right.left || left.index - right.index)
    .map((field) => field.inferText.trim())
    .filter(Boolean)
    .join(' ');
}

function sanitizeOcrRawText(value: string) {
  return sanitizeRawTextForStorage(value)
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

export function parseClovaOcrResponse(value: unknown): ClovaOcrParsedResult {
  const response = record(value);
  if (!Array.isArray(response.images) || response.images.length < 1) invalidResponse();
  const image = record(response.images[0]);
  if (typeof image.inferResult !== 'string') invalidResponse();
  if (image.inferResult !== 'SUCCESS') {
    throw new AttachmentProcessingError('CLOVA_OCR_IMAGE_FAILED', 'CLOVA OCR image recognition failed.');
  }
  if (!Array.isArray(image.fields)) invalidResponse();
  const fields = image.fields.map(parseField);
  const usesLineBreak = fields.every((field) => typeof field.lineBreak === 'boolean');
  const rawText = sanitizeOcrRawText(usesLineBreak ? lineBreakText(fields) : coordinateText(fields));
  const cleanedText = cleanExtractedText(rawText);
  const confidenceTotal = fields.reduce((sum, field) => sum + field.inferConfidence, 0);
  return {
    rawText,
    cleanedText,
    fieldCount: fields.length,
    isEmpty: cleanedText.length === 0,
    averageConfidence: fields.length > 0 ? confidenceTotal / fields.length : undefined,
    readingOrderStrategy: usesLineBreak ? 'LINE_BREAK' : 'COORDINATE',
    boxes: fields
      .filter((field) => field.inferText.trim())
      .map((field) => ({
        text: field.inferText.trim(),
        top: field.top,
        left: field.left,
        right: field.right,
        bottom: field.bottom,
        confidence: field.inferConfidence,
      })),
  };
}
