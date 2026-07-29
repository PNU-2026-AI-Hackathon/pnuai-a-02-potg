const assert = require('node:assert/strict');
const {
  syncProgramCaseDocumentChunks,
  syncProgramCaseDocumentChunksById,
} = require('../dist/services/programCaseDocumentChunk/programCaseDocumentChunkService');

function document(id, attachmentText = '첨부 원문') {
  return {
    id, documentType: 'SEARCH', programCaseId: `program-${id}`,
    programCase: {
      id: `program-${id}`, title: `프로그램 ${id}`, targetAudience: '전체',
      sourceType: 'TEST', sourcePostId: id, sourceUrl: 'https://example.invalid',
      instructor: '', capacity: 0, currentApplicants: 0, applicationStatus: '접수중',
      educationStartDate: '2026-01-01', educationEndDate: '2026-01-02',
      educationStartDateText: '2026-01-01', educationEndDateText: '2026-01-02',
      location: null, feeText: null, preparationText: null, contactText: null,
      notices: '', rawText: '원본', sessions: [],
      attachments: attachmentText === null ? [] : [{
        id: `attachment-${id}`, fileName: '첨부.txt', cleanedText: attachmentText,
        createdAt: '2026-01-01', isActive: true, extractionStatus: 'COMPLETED',
      }],
    },
  };
}

function fixture() {
  const sources = new Map([['one', document('one')], ['two', document('two')]]);
  const stored = new Map();
  const writes = { create: 0, update: 0, delete: 0 };
  return {
    sources, stored, writes,
    repository: {
      async findDocument(id) { const value = sources.get(id); if (value instanceof Error) throw value; return value ?? null; },
      async listSearchDocumentIds() { return [...sources.keys()]; },
      async sync(id, chunks) {
        const old = stored.get(id) ?? new Map();
        const next = new Map(); let created = 0, updated = 0, unchanged = 0;
        for (const chunk of chunks) {
          const before = old.get(chunk.chunkKey);
          if (!before) { created++; writes.create++; }
          else if (JSON.stringify(before) === JSON.stringify(chunk)) unchanged++;
          else { updated++; writes.update++; }
          next.set(chunk.chunkKey, chunk);
        }
        const deleted = [...old.keys()].filter((key) => !next.has(key)).length;
        writes.delete += deleted; stored.set(id, next);
        return { created, updated, unchanged, deleted };
      },
    },
  };
}

(async () => {
  const f = fixture();
  const created = await syncProgramCaseDocumentChunksById('one', f.repository);
  assert.equal(created.status, 'SUCCESS');
  assert.ok(created.created > 0);
  const beforeWrites = { ...f.writes };
  const unchanged = await syncProgramCaseDocumentChunksById('one', f.repository);
  assert.equal(unchanged.created, 0);
  assert.equal(unchanged.updated, 0);
  assert.deepEqual(f.writes, beforeWrites);
  f.sources.set('one', document('one', '변경된 첨부 원문'));
  const updated = await syncProgramCaseDocumentChunksById('one', f.repository);
  assert.equal(updated.updated, 1);
  f.sources.set('one', document('one', null));
  const removed = await syncProgramCaseDocumentChunksById('one', f.repository);
  assert.equal(removed.deleted, 1);
  f.sources.set('bad', new Error('load failed'));
  const batch = await syncProgramCaseDocumentChunks({ all: true }, f.repository);
  assert.equal(batch.documentsFailed, 1);
  assert.equal(batch.documentsSucceeded, 2);
  console.log('Program case document chunk service tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
