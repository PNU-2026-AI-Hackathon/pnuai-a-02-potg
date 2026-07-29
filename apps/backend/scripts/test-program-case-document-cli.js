const assert = require('node:assert/strict');
const {
  main,
  parseBuildProgramCaseDocumentsArguments,
} = require('../dist/cli/buildProgramCaseDocuments');

const id = '123e4567-e89b-42d3-a456-426614174001';

function expectError(args, message) {
  assert.throws(() => parseBuildProgramCaseDocumentsArguments(args), message);
}

async function run() {
  assert.deepEqual(parseBuildProgramCaseDocumentsArguments(['--program-case-id', id]), { programCaseId: id });
  assert.deepEqual(parseBuildProgramCaseDocumentsArguments(['--all']), { all: true });
  expectError([], /Exactly one/);
  expectError(['--all', '--program-case-id', id], /Exactly one/);
  expectError(['--program-case-id', 'bad-id'], /UUID/);
  expectError(['--unknown'], /Unknown option/);
  expectError(['--all', '--all'], /Duplicate option/);
  expectError(['--program-case-id', id, '--program-case-id', id], /Duplicate option/);

  let received;
  const result = {
    total: 1, created: 1, updated: 0, unchanged: 0, failed: 0,
    emptyDocuments: 0, withSessions: 0, withAttachments: 0,
    warningCounts: { LONG_ATTACHMENT_TEXT: 0, MULTIPLE_PROGRAM_NAME_MARKERS: 0, LONG_DOCUMENT: 0 },
    failures: [], results: [], durationMs: 1,
  };
  const originalLog = console.log;
  console.log = () => undefined;
  try {
    assert.equal(await main(['--program-case-id', id], async (options) => {
      received = options;
      return result;
    }), result);
  } finally {
    console.log = originalLog;
  }
  assert.deepEqual(received, { programCaseId: id });
  console.log('Program case document CLI tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
