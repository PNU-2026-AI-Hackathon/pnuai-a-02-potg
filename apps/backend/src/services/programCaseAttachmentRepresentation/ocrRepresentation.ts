import { baseRecord, stableHash } from './common';
import { OcrBlock, OcrField, OcrLine, SourceBinary } from './types';

const OCR_PARSER_VERSION = 'clova-structure-parser-v1';
const LINE_DERIVATION_VERSION = 'ocr-line-clustering-v1';
const BLOCK_DERIVATION_VERSION = 'ocr-block-clustering-v1';
const ROLE_CLASSIFIER_VERSION = 'ocr-block-role-classifier-v1';

type Point = { x: number; y: number };
type RawField = { inferText: string; inferConfidence: number; boundingPoly: { vertices: Point[] }; lineBreak?: boolean };

export type SafeOcrResponse = {
  safeArtifactVersion: 'clova-ocr-safe-response/v1';
  sourceSha256: string;
  requestFormatVersion: string;
  responseFormatVersion: string;
  ocrEngine: 'CLOVA_OCR_GENERAL';
  ocrEngineVersion: 'V2';
  imageWidth: number;
  imageHeight: number;
  imageOrientation: number | null;
  inferResult: 'SUCCESS';
  fields: Array<{ fieldOrder: number; inferText: string; inferConfidence: number; boundingPoly: Point[]; lineBreak: boolean | null }>;
  contentHash: string;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid CLOVA OCR response.');
  return value as Record<string, unknown>;
}

function points(value: unknown) {
  const polygon = record(value);
  if (!Array.isArray(polygon.vertices) || polygon.vertices.length < 3) throw new Error('Invalid OCR polygon.');
  return polygon.vertices.map((item) => {
    const point = record(item);
    if (typeof point.x !== 'number' || typeof point.y !== 'number') throw new Error('Invalid OCR polygon point.');
    return { x: point.x, y: point.y };
  });
}

export function sanitizeClovaResponse(value: unknown, sourceSha256: string, imageMetadata: {
  width: number; height: number; orientation: number | null;
}): SafeOcrResponse {
  const response = record(value);
  if (!Array.isArray(response.images) || response.images.length !== 1) throw new Error('Exactly one OCR image is required.');
  const image = record(response.images[0]);
  if (image.inferResult !== 'SUCCESS' || !Array.isArray(image.fields)) throw new Error('CLOVA OCR image failed.');
  const fields = image.fields.map((value, fieldOrder) => {
    const field = record(value) as RawField & Record<string, unknown>;
    if (typeof field.inferText !== 'string' || typeof field.inferConfidence !== 'number' || field.inferConfidence < 0 || field.inferConfidence > 1) {
      throw new Error('Invalid OCR field.');
    }
    return { fieldOrder, inferText: field.inferText, inferConfidence: field.inferConfidence,
      boundingPoly: points(field.boundingPoly), lineBreak: typeof field.lineBreak === 'boolean' ? field.lineBreak : null };
  });
  const content = {
    safeArtifactVersion: 'clova-ocr-safe-response/v1' as const, sourceSha256,
    requestFormatVersion: 'V2', responseFormatVersion: 'V2', ocrEngine: 'CLOVA_OCR_GENERAL' as const,
    ocrEngineVersion: 'V2' as const, imageWidth: imageMetadata.width, imageHeight: imageMetadata.height,
    imageOrientation: imageMetadata.orientation, inferResult: 'SUCCESS' as const, fields,
  };
  return { ...content, contentHash: stableHash(content) };
}

function bounds(polygons: Point[][]) {
  const values = polygons.flat();
  const left = Math.min(...values.map((point) => point.x)); const right = Math.max(...values.map((point) => point.x));
  const top = Math.min(...values.map((point) => point.y)); const bottom = Math.max(...values.map((point) => point.y));
  return [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
}

function top(field: OcrField) { return Math.min(...field.boundingPoly.map((point) => point.y)); }
function left(field: OcrField) { return Math.min(...field.boundingPoly.map((point) => point.x)); }
function height(field: OcrField) { return Math.max(...field.boundingPoly.map((point) => point.y)) - top(field); }
function average(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }

function classifyBlock(group: OcrLine[], allLines: OcrLine[], index: number, total: number) {
  const text = group.map((line) => line.text).join(' ');
  const evidence: string[] = [];
  const lineHeights = group.map((line) => Math.max(...line.boundingPoly.map((point) => point.y)) - Math.min(...line.boundingPoly.map((point) => point.y)));
  const allHeights = allLines.map((line) => Math.max(...line.boundingPoly.map((point) => point.y)) - Math.min(...line.boundingPoly.map((point) => point.y)));
  const meanHeight = average(lineHeights); const baseline = Math.max(1, average(allHeights));
  let role: OcrBlock['role'] = 'UNKNOWN'; let confidence = 0.45;
  if (/(?:0\d{1,2}[- )]?\d{3,4}[- ]?\d{4}|문의|연락처|담당자)/.test(text) && index >= Math.floor(total * 0.6)) {
    role = 'CONTACT_OR_FOOTER'; confidence = 0.86; evidence.push('CONTACT_PATTERN', 'LOWER_DOCUMENT_REGION');
  } else if (/(?:환불|취소|접수|신청방법|신청기간|유의사항)/.test(text) && group.length >= 3) {
    role = 'ADMINISTRATIVE_NOTICE'; confidence = 0.78; evidence.push('ADMINISTRATIVE_PATTERN');
  } else if (group.length >= 8 && /(?:회차|차시|일자|교육일자|수업|활동|준비물)/.test(text)) {
    role = 'TABLE_OR_GRID'; confidence = 0.84; evidence.push('REPEATED_ROW_LABELS', 'MANY_LINES');
  } else if (group.length <= 3 && meanHeight >= baseline * 1.35) {
    role = 'TITLE_CANDIDATE'; confidence = 0.78; evidence.push('LARGE_TEXT_RELATIVE_TO_DOCUMENT', 'SHORT_BLOCK');
  } else if (index === 0 && group.length <= 3) {
    role = 'HEADER_OR_BRANDING'; confidence = 0.7; evidence.push('TOP_DOCUMENT_REGION', 'SHORT_BLOCK');
  } else if (/(?:대상|일시|장소|기간|시간|모집|정원)/.test(text) && group.length <= 12) {
    role = 'PROGRAM_METADATA'; confidence = 0.7; evidence.push('PROGRAM_METADATA_LABEL');
  } else if (group.length >= 2) {
    role = 'PROGRAM_CONTENT'; confidence = 0.62; evidence.push('MULTI_LINE_CONTENT');
  } else evidence.push('INSUFFICIENT_ROLE_EVIDENCE');
  return { role, roleConfidence: confidence, roleEvidence: evidence, roleClassifierVersion: ROLE_CLASSIFIER_VERSION };
}

function readingOrder(group: OcrLine[]): OcrBlock['readingOrder'] {
  if (group.length < 2) return 'UNRESOLVED';
  const tops = group.map((line) => Math.min(...line.boundingPoly.map((point) => point.y)));
  const lefts = group.map((line) => Math.min(...line.boundingPoly.map((point) => point.x)));
  let upward = 0; let lateral = 0;
  for (let index = 1; index < group.length; index += 1) {
    if (tops[index] + 20 < tops[index - 1]) upward += 1;
    if (Math.abs(lefts[index] - lefts[index - 1]) > 100) lateral += 1;
  }
  if (upward > 0 && lateral > 0) return 'HYBRID_LAYOUT';
  if (upward > 0) return 'COLUMN_MAJOR';
  if (lateral > Math.floor(group.length / 3)) return 'ROW_MAJOR';
  return 'ROW_MAJOR';
}

export function buildOcrRepresentation(source: SourceBinary, safe: SafeOcrResponse) {
  if (safe.sourceSha256 !== source.sourceSha256) throw new Error('OCR artifact source hash mismatch.');
  const fields = safe.fields.map((raw) => {
    const content = { fieldOrder: raw.fieldOrder, inferText: raw.inferText, inferConfidence: raw.inferConfidence,
      boundingPoly: raw.boundingPoly, lineBreak: raw.lineBreak, requestFormatVersion: safe.requestFormatVersion,
      responseFormatVersion: safe.responseFormatVersion, ocrEngine: safe.ocrEngine, ocrEngineVersion: safe.ocrEngineVersion,
      imageWidth: safe.imageWidth, imageHeight: safe.imageHeight, imageOrientation: safe.imageOrientation,
      safeResponseArtifactHash: safe.contentHash };
    return { ...baseRecord({ source, kind: 'CLOVA_OCR_FIELD', origin: 'PARSER_NATIVE', parser: safe.ocrEngine,
      parserVersion: OCR_PARSER_VERSION, structuralOrder: raw.fieldOrder, structuralPosition: `field:${raw.fieldOrder}`, content,
      confidence: raw.inferConfidence }), ...content } as OcrField;
  });
  const allLineBreaks = fields.every((field) => field.lineBreak !== null);
  const groups: OcrField[][] = [];
  if (allLineBreaks) {
    let group: OcrField[] = [];
    for (const field of fields) {
      group.push(field);
      if (field.lineBreak) { groups.push(group); group = []; }
    }
    if (group.length) groups.push(group);
  } else {
    const ordered = [...fields].sort((a, b) => top(a) - top(b) || left(a) - left(b) || a.fieldOrder - b.fieldOrder);
    for (const field of ordered) {
      const current = groups.length ? groups[groups.length - 1] : undefined;
      const threshold = Math.max(4, average((current ?? [field]).map(height)) * 0.55);
      if (!current || Math.abs(top(field) - average(current.map(top))) > threshold) groups.push([field]);
      else current.push(field);
    }
    groups.forEach((group) => group.sort((a, b) => left(a) - left(b) || a.fieldOrder - b.fieldOrder));
  }
  const lines = groups.filter((group) => group.some((field) => field.inferText.trim())).map((group, index) => {
    const content = { fieldRefs: group.map((field) => field.recordId), text: group.map((field) => field.inferText.trim()).filter(Boolean).join(' '),
      boundingPoly: bounds(group.map((field) => field.boundingPoly)) };
    return { ...baseRecord({ source, kind: 'DERIVED_OCR_LINE', origin: 'DERIVED', parser: safe.ocrEngine,
      parserVersion: OCR_PARSER_VERSION, structuralOrder: index, structuralPosition: `line:${index}`, content,
      confidence: average(group.map((field) => field.inferConfidence)), derivationRule: allLineBreaks ? 'CLOVA_LINE_BREAK' : 'Y_COORDINATE_CLUSTER',
      derivationVersion: LINE_DERIVATION_VERSION, inputUnitRefs: content.fieldRefs }), ...content } as OcrLine;
  });
  const blockGroups: OcrLine[][] = [];
  for (const line of lines) {
    const current = blockGroups.length ? blockGroups[blockGroups.length - 1] : undefined;
    const previousLine = current?.[current.length - 1];
    const currentBottom = previousLine ? Math.max(...previousLine.boundingPoly.map((point: Point) => point.y)) : 0;
    const lineTop = Math.min(...line.boundingPoly.map((point) => point.y));
    const lineHeight = Math.max(...line.boundingPoly.map((point) => point.y)) - lineTop;
    if (!current || lineTop - currentBottom > Math.max(12, lineHeight * 1.4)) blockGroups.push([line]); else current.push(line);
  }
  const blocks = blockGroups.map((group, index) => {
    const classification = classifyBlock(group, lines, index, blockGroups.length);
    const content = { lineRefs: group.map((line) => line.recordId), text: group.map((line) => line.text).join('\n'),
      boundingPoly: bounds(group.map((line) => line.boundingPoly)), ...classification, readingOrder: readingOrder(group) };
    return { ...baseRecord({ source, kind: 'DERIVED_OCR_BLOCK', origin: 'DERIVED', parser: safe.ocrEngine,
      parserVersion: OCR_PARSER_VERSION, structuralOrder: index, structuralPosition: `block:${index}`, content,
      confidence: average(group.map((line) => line.confidence)), derivationRule: 'VERTICAL_GAP_CLUSTER',
      derivationVersion: BLOCK_DERIVATION_VERSION, inputUnitRefs: content.lineRefs }), ...content } as OcrBlock;
  });
  return { safeResponse: safe, fields, lines, blocks };
}
