import { createProgramCaseDocumentHash } from '../programCaseDocument/programCaseDocumentHash';
import {
  containsForbiddenProgramCaseSearchPattern,
  sanitizeProgramCaseSearchText,
} from '../programCaseDocument/programCaseDocumentSanitizer';

export const PROGRAM_CASE_DOCUMENT_CHUNK_BUILDER_VERSION = 'program-case-chunk-v2';
export const TARGET_CHUNK_CHARACTERS = 1_500;
export const MAX_CHUNK_CHARACTERS = 2_000;
export const MAX_OVERLAP_CHARACTERS = 150;
export const STRUCTURED_CHUNK_WARNING_CHARACTERS = 4_000;
const MIN_BOUNDARY_RATIO = 0.6;

export type ProgramCaseDocumentChunkTypeValue = 'CORE' | 'SESSIONS' | 'ATTACHMENT';
export type ProgramCaseDocumentChunkWarning = {
  code: 'LONG_STRUCTURED_CHUNK';
  chunkKey: string;
  characterCount: number;
};
export type ProgramCaseDocumentChunk = {
  chunkKey: string;
  chunkOrder: number;
  chunkType: ProgramCaseDocumentChunkTypeValue;
  programCaseAttachmentId: string | null;
  sourceLabel: string | null;
  content: string;
  contentHash: string;
  builderVersion: typeof PROGRAM_CASE_DOCUMENT_CHUNK_BUILDER_VERSION;
  characterCount: number;
  sourceStart: number;
  sourceEnd: number;
  overlapLength: number;
};
export type ProgramCaseDocumentChunkBuilderInput = {
  programCaseDocumentId: string;
  programCaseId: string;
  title: string;
  targetAudience: string | null;
  coreContent: string;
  sessionsContent: string;
  attachments: readonly {
    id: string;
    fileName: string;
    content: string;
    order: number;
  }[];
};
export type ProgramCaseDocumentChunkBuildResult = {
  chunks: ProgramCaseDocumentChunk[];
  warnings: ProgramCaseDocumentChunkWarning[];
};

function normalize(value: string) {
  return value.replace(/\r\n?/g, '\n').trim();
}

function sanitize(value: string, context: 'STRUCTURED_FIELD' | 'RAW_TEXT' | 'ATTACHMENT_TEXT') {
  return sanitizeProgramCaseSearchText(value, context).text;
}

function contextHeader(input: ProgramCaseDocumentChunkBuilderInput, type: ProgramCaseDocumentChunkTypeValue) {
  return [
    `프로그램명: ${normalize(input.title) || '정보 없음'}`,
    `대상: ${normalize(input.targetAudience ?? '') || '정보 없음'}`,
    `청크 유형: ${type}`,
  ];
}

function finalize(
  data: Omit<ProgramCaseDocumentChunk, 'contentHash' | 'builderVersion' | 'characterCount'>,
): ProgramCaseDocumentChunk {
  return {
    ...data,
    contentHash: createProgramCaseDocumentHash(data.content),
    builderVersion: PROGRAM_CASE_DOCUMENT_CHUNK_BUILDER_VERSION,
    characterCount: data.content.length,
  };
}

function findBoundary(text: string, desired: number, maximum: number) {
  const minimum = Math.floor(desired * MIN_BOUNDARY_RATIO);
  const window = text.slice(0, Math.min(desired, maximum));
  const candidates = [
    window.lastIndexOf('\n\n') >= minimum ? window.lastIndexOf('\n\n') + 2 : -1,
    window.lastIndexOf('\n') >= minimum ? window.lastIndexOf('\n') + 1 : -1,
  ];
  for (let index = window.length - 1; index >= minimum; index -= 1) {
    if (/[.!?。！？]/.test(window[index])) {
      candidates.push(index + 1);
      break;
    }
  }
  return candidates.find((candidate) => candidate >= minimum) ?? maximum;
}

function overlapText(text: string) {
  const tail = text.slice(-MAX_OVERLAP_CHARACTERS);
  const paragraph = tail.lastIndexOf('\n\n');
  const value = paragraph >= 0 ? tail.slice(paragraph + 2) : tail;
  return value.trim() ? value : '';
}

function attachmentHeader(
  input: ProgramCaseDocumentChunkBuilderInput,
  attachment: ProgramCaseDocumentChunkBuilderInput['attachments'][number],
  part: number,
  totalParts: number,
) {
  return [
    ...contextHeader(input, 'ATTACHMENT'),
    `첨부파일명: ${normalize(attachment.fileName) || '이름 없음'}`,
    `첨부파일 순서: ${attachment.order + 1}`,
    `파트: ${part + 1}/${totalParts}`,
    '',
    '[첨부파일 내용]',
  ].join('\n');
}

type AttachmentPart = { text: string; start: number; end: number; overlapLength: number };

function splitAttachment(
  input: ProgramCaseDocumentChunkBuilderInput,
  attachment: ProgramCaseDocumentChunkBuilderInput['attachments'][number],
) {
  const source = sanitize(attachment.content, 'ATTACHMENT_TEXT');
  if (!source) return [] as AttachmentPart[];
  let estimatedParts = 1;
  let parts: AttachmentPart[] = [];
  for (let pass = 0; pass < 4; pass += 1) {
    parts = [];
    let cursor = 0;
    let overlap = '';
    while (cursor < source.length) {
      const header = attachmentHeader(input, attachment, parts.length, estimatedParts);
      const capacity = MAX_CHUNK_CHARACTERS - header.length - 2;
      if (capacity <= 0) throw new Error('ATTACHMENT_HEADER_TOO_LONG');
      const freshCapacity = capacity - overlap.length;
      if (freshCapacity <= 0) throw new Error('ATTACHMENT_OVERLAP_TOO_LONG');
      const remaining = source.slice(cursor);
      const desired = Math.min(TARGET_CHUNK_CHARACTERS - header.length - 2 - overlap.length, freshCapacity);
      const take = remaining.length <= freshCapacity
        ? remaining.length
        : findBoundary(remaining, Math.max(1, desired), freshCapacity);
      if (take <= 0) throw new Error('ATTACHMENT_SPLIT_DID_NOT_ADVANCE');
      const fresh = remaining.slice(0, take);
      const text = overlap && !fresh.startsWith(overlap) ? `${overlap}${fresh}` : fresh;
      parts.push({ text, start: cursor, end: cursor + take, overlapLength: text.length - fresh.length });
      cursor += take;
      overlap = cursor < source.length ? overlapText(fresh) : '';
    }
    if (parts.length === estimatedParts) break;
    estimatedParts = parts.length;
  }
  return parts;
}

export function buildProgramCaseDocumentChunks(
  input: ProgramCaseDocumentChunkBuilderInput,
): ProgramCaseDocumentChunkBuildResult {
  const chunks: ProgramCaseDocumentChunk[] = [];
  const warnings: ProgramCaseDocumentChunkWarning[] = [];
  const addStructured = (chunkKey: 'core' | 'sessions', chunkType: 'CORE' | 'SESSIONS', body: string) => {
    const source = sanitize(body, 'RAW_TEXT');
    if (!source) return;
    const extra = chunkType === 'SESSIONS' ? ['회차 범위: 전체 회차'] : [];
    const content = [...contextHeader(input, chunkType), ...extra, '', source].join('\n');
    const chunk = finalize({
      chunkKey,
      chunkOrder: chunks.length,
      chunkType,
      programCaseAttachmentId: null,
      sourceLabel: null,
      content,
      sourceStart: 0,
      sourceEnd: source.length,
      overlapLength: 0,
    });
    chunks.push(chunk);
    if (chunk.characterCount > STRUCTURED_CHUNK_WARNING_CHARACTERS) {
      warnings.push({ code: 'LONG_STRUCTURED_CHUNK', chunkKey, characterCount: chunk.characterCount });
    }
  };
  addStructured('core', 'CORE', input.coreContent);
  addStructured('sessions', 'SESSIONS', input.sessionsContent);

  [...input.attachments]
    .map((attachment) => ({
      ...attachment,
      fileName: sanitize(attachment.fileName, 'ATTACHMENT_TEXT'),
    }))
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .forEach((attachment) => {
      const parts = splitAttachment(input, attachment);
      parts.forEach((part, partIndex) => {
        const header = attachmentHeader(input, attachment, partIndex, parts.length);
        const content = `${header}\n\n${part.text}`;
        if (content.length > MAX_CHUNK_CHARACTERS) throw new Error('ATTACHMENT_CHUNK_TOO_LONG');
        chunks.push(finalize({
          chunkKey: `attachment:${attachment.id}:part:${partIndex}`,
          chunkOrder: chunks.length,
          chunkType: 'ATTACHMENT',
          programCaseAttachmentId: attachment.id,
          sourceLabel: normalize(attachment.fileName) || '이름 없음',
          content,
          sourceStart: part.start,
          sourceEnd: part.end,
          overlapLength: part.overlapLength,
        }));
      });
    });

  if (new Set(chunks.map((chunk) => chunk.chunkKey)).size !== chunks.length) {
    throw new Error('DUPLICATE_CHUNK_KEY');
  }
  chunks.forEach((chunk, index) => {
    if (chunk.chunkOrder !== index || !chunk.content.trim() || chunk.characterCount !== chunk.content.length) {
      throw new Error('INVALID_CHUNK');
    }
    if (containsForbiddenProgramCaseSearchPattern(chunk.content)) {
      throw new Error('UNSANITIZED_CHUNK_CONTENT');
    }
  });
  return { chunks, warnings };
}
