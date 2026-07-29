const assert = require('node:assert/strict');
const {
  buildProgramCaseDocumentById,
  buildProgramCaseDocuments,
  PROGRAM_CASE_DOCUMENT_TYPE,
  PROGRAM_CASE_DOCUMENT_VERSION,
} = require('../dist/services/programCaseDocument/programCaseDocumentService');
const { createProgramCaseDocumentHash } = require('../dist/services/programCaseDocument/programCaseDocumentHash');

function source(id = 'program-1', overrides = {}) {
  return {
    program: {
      id,
      sourceType: 'COMMON',
      sourcePostId: id,
      sourceUrl: `https://example.com/${id}`,
      title: `프로그램 ${id}`,
      targetAudience: '전체',
      instructor: '',
      capacity: 0,
      currentApplicants: 0,
      applicationStatus: '접수중',
      educationStartDate: '2026-01-01',
      educationEndDate: '2026-01-02',
      educationStartDateText: '2026-01-01',
      educationEndDateText: '2026-01-02',
      location: null,
      feeText: null,
      preparationText: null,
      contactText: null,
      notices: '',
      rawText: '원본',
    },
    sessions: [],
    attachments: [],
    ...overrides,
  };
}

function repositoryFixture(sources) {
  const documents = new Map();
  const calls = { create: 0, update: 0 };
  return {
    calls,
    documents,
    repository: {
      async findSource(id) {
        const value = sources.get(id);
        if (value instanceof Error) throw value;
        return value ?? null;
      },
      async findDocument(id, type) {
        return documents.get(`${id}:${type}`) ?? null;
      },
      async createDocument(data) {
        calls.create += 1;
        const key = `${data.programCaseId}:${data.documentType}`;
        if (documents.has(key)) throw new Error('duplicate');
        documents.set(key, { id: `document-${calls.create}`, ...data });
      },
      async updateDocument(id, data) {
        calls.update += 1;
        const entry = [...documents.entries()].find(([, value]) => value.id === id);
        assert.ok(entry);
        documents.set(entry[0], { ...entry[1], ...data });
      },
      async listProgramCaseIds() {
        return [...sources.keys()];
      },
    },
  };
}

function dependencies(fixture, build = (input) => `문서:${input.program.title}`) {
  return {
    repository: fixture.repository,
    build,
    hash: createProgramCaseDocumentHash,
  };
}

async function main() {
  const firstHash = createProgramCaseDocumentHash('동일한 내용');
  assert.equal(firstHash, createProgramCaseDocumentHash('동일한 내용'));
  assert.notEqual(firstHash, createProgramCaseDocumentHash('다른 내용'));
  assert.match(firstHash, /^[0-9a-f]{64}$/);

  const sources = new Map([['program-1', source()]]);
  const fixture = repositoryFixture(sources);
  const deps = dependencies(fixture);
  const created = await buildProgramCaseDocumentById('program-1', deps);
  assert.equal(created.status, 'CREATED');
  assert.equal(created.documentType, PROGRAM_CASE_DOCUMENT_TYPE);
  assert.equal(created.version, PROGRAM_CASE_DOCUMENT_VERSION);
  assert.equal(fixture.calls.create, 1);

  const unchanged = await buildProgramCaseDocumentById('program-1', deps);
  assert.equal(unchanged.status, 'UNCHANGED');
  assert.equal(fixture.calls.create, 1);
  assert.equal(fixture.calls.update, 0);

  const key = `program-1:${PROGRAM_CASE_DOCUMENT_TYPE}`;
  const before = fixture.documents.get(key);
  fixture.documents.set(key, { ...before, version: '0', contentHash: 'old' });
  const updated = await buildProgramCaseDocumentById('program-1', deps);
  assert.equal(updated.status, 'UPDATED');
  assert.equal(fixture.calls.update, 1);
  assert.equal(fixture.documents.size, 1);

  const filteredSource = source('program-2', {
    sessions: [
      { id: 's2', sessionNumber: 2, sessionDate: null, dateText: '둘째', activity: '둘째 활동', sortOrder: 1 },
      { id: 's1', sessionNumber: 1, sessionDate: null, dateText: '첫째', activity: '첫째 활동', sortOrder: 0 },
    ],
    attachments: [
      { id: 'a3', fileName: '공백.txt', fileType: 'txt', detectedFileType: 'TXT', extractionStatus: 'COMPLETED', cleanedText: '   ', extractorType: 'TEXT', isActive: true, createdAt: '2026-01-03' },
      { id: 'a2', fileName: '대기.txt', fileType: 'txt', detectedFileType: 'TXT', extractionStatus: 'PENDING', cleanedText: '대기', extractorType: 'TEXT', isActive: true, createdAt: '2026-01-02' },
      { id: 'a1', fileName: '활성.txt', fileType: 'txt', detectedFileType: 'TXT', extractionStatus: 'COMPLETED', cleanedText: '활성', extractorType: 'TEXT', isActive: true, createdAt: '2026-01-01' },
      { id: 'a0', fileName: '비활성.txt', fileType: 'txt', detectedFileType: 'TXT', extractionStatus: 'COMPLETED', cleanedText: '비활성', extractorType: 'TEXT', isActive: false, createdAt: '2025-01-01' },
    ],
  });
  sources.set('program-2', filteredSource);
  let captured;
  const filtered = await buildProgramCaseDocumentById('program-2', dependencies(fixture, (input) => {
    captured = input;
    return '필터 검증';
  }));
  assert.equal(filtered.status, 'CREATED');
  assert.deepEqual(captured.attachments.map((row) => row.id), ['a1']);
  assert.equal(filtered.withSessions, true);
  assert.equal(filtered.withAttachments, true);

  sources.set('program-bad', new Error('load failed'));
  const batch = await buildProgramCaseDocuments({ all: true }, deps);
  assert.equal(batch.total, 3);
  assert.equal(batch.failed, 1);
  assert.equal(batch.failures[0].programCaseId, 'program-bad');
  assert.equal(batch.failures[0].step, 'LOAD_SOURCE');
  assert.equal(batch.results.at(-1).status, 'FAILED');

  console.log('Program case document service tests passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
