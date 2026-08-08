const assert = require('node:assert/strict');
const {
  buildProgramCaseDocumentChunks,
  MAX_CHUNK_CHARACTERS,
  MAX_OVERLAP_CHARACTERS,
  PROGRAM_CASE_DOCUMENT_CHUNK_BUILDER_VERSION,
} = require('../dist/services/programCaseDocumentChunk/programCaseDocumentChunkBuilder');
const { createProgramCaseDocumentHash } = require('../dist/services/programCaseDocument/programCaseDocumentHash');

const paragraph = '문단 원문을 그대로 보존합니다. '.repeat(100);
const longText = `${paragraph}\n\n${paragraph}\n\n${paragraph}`;
const input = {
  programCaseDocumentId: 'document-1',
  programCaseId: 'program-1',
  title: '어린이 독서교실',
  targetAudience: '초등학생',
  coreContent: '[프로그램 기본 정보]\n\n프로그램명: 어린이 독서교실',
  sessionsContent: '[회차별 활동]\n\n1회차\n- 활동: 독서',
  attachments: [
    { id: 'attachment-b', fileName: '긴 계획서.pdf', content: longText, order: 1 },
    { id: 'attachment-a', fileName: '짧은 안내.txt', content: '고치지 않는 원문', order: 0 },
  ],
};

const first = buildProgramCaseDocumentChunks(input);
const second = buildProgramCaseDocumentChunks(input);
assert.deepEqual(first, second);
assert.equal(first.chunks.filter((x) => x.chunkType === 'CORE').length, 1);
assert.equal(first.chunks.filter((x) => x.chunkType === 'SESSIONS').length, 1);
const attachments = first.chunks.filter((x) => x.chunkType === 'ATTACHMENT');
assert.ok(attachments.length > 2);
assert.ok(attachments.every((x) => x.content.length <= MAX_CHUNK_CHARACTERS));
assert.ok(attachments.every((x) => x.overlapLength <= MAX_OVERLAP_CHARACTERS));
assert.deepEqual(first.chunks.map((x) => x.chunkOrder), first.chunks.map((_, i) => i));
assert.ok(first.chunks.every((x) => x.characterCount === x.content.length));
assert.ok(first.chunks.every((x) => x.contentHash === createProgramCaseDocumentHash(x.content)));
assert.ok(first.chunks.every((x) => x.builderVersion === PROGRAM_CASE_DOCUMENT_CHUNK_BUILDER_VERSION));
assert.match(first.chunks[0].content, /프로그램명: 어린이 독서교실/);
assert.match(first.chunks[0].content, /대상: 초등학생/);
assert.equal(attachments[0].chunkKey, 'attachment:attachment-a:part:0');
assert.equal(attachments[0].programCaseAttachmentId, 'attachment-a');
assert.match(attachments[0].content, /파트: 1\/1/);
const longParts = attachments.filter((x) => x.programCaseAttachmentId === 'attachment-b');
assert.deepEqual(longParts.map((x) => x.chunkKey), longParts.map((_, i) => `attachment:attachment-b:part:${i}`));
assert.equal(longParts.map((x) => longText.trim().slice(x.sourceStart, x.sourceEnd)).join(''), longText.trim());
assert.ok(longParts.slice(1).every((x) => x.overlapLength >= 0));

const noSessions = buildProgramCaseDocumentChunks({ ...input, sessionsContent: '', attachments: [] });
assert.equal(noSessions.chunks.length, 1);
assert.throws(() => buildProgramCaseDocumentChunks({
  ...input,
  attachments: [
    { id: 'same', fileName: 'a', content: 'a', order: 0 },
    { id: 'same', fileName: 'b', content: 'b', order: 1 },
  ],
}), /DUPLICATE_CHUNK_KEY/);
const warning = buildProgramCaseDocumentChunks({ ...input, coreContent: '가'.repeat(4_001), sessionsContent: '', attachments: [] });
assert.equal(warning.warnings.length, 1);
assert.match(attachments[0].content, /고치지 않는 원문/);
console.log('Program case document chunk builder tests passed.');
