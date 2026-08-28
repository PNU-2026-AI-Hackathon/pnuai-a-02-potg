const assert = require('node:assert/strict');
const {
  main,
  parseBuildProgramCaseDocumentChunksArguments,
} = require('../dist/cli/buildProgramCaseDocumentChunks');
const id = '123e4567-e89b-42d3-a456-426614174001';
assert.deepEqual(parseBuildProgramCaseDocumentChunksArguments(['--all']), { all: true });
assert.deepEqual(parseBuildProgramCaseDocumentChunksArguments(['--program-case-document-id', id]), { programCaseDocumentId: id });
assert.deepEqual(parseBuildProgramCaseDocumentChunksArguments([`--program-case-document-id=${id}`]), { programCaseDocumentId: id });
assert.throws(() => parseBuildProgramCaseDocumentChunksArguments([]), /Exactly one/);
assert.throws(() => parseBuildProgramCaseDocumentChunksArguments(['--all', '--program-case-document-id', id]), /Exactly one/);
assert.throws(() => parseBuildProgramCaseDocumentChunksArguments(['--unknown']), /Unknown/);
(async () => {
  const result = {
    documentsProcessed: 1, documentsSucceeded: 1, documentsFailed: 0,
    chunksCreated: 1, chunksUpdated: 0, chunksUnchanged: 0, chunksDeleted: 0,
    totalChunks: 1, warningCount: 0, failures: [], results: [], durationMs: 1,
  };
  const log = console.log; console.log = () => undefined;
  try { assert.equal(await main(['--all'], async () => result), result); }
  finally { console.log = log; }
  console.log('Program case document chunk CLI tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
