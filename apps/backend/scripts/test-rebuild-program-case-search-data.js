const assert = require('node:assert/strict');
const {
  PRODUCTION_CONFIRMATION,
  assertExecutionAllowed,
  parseArguments,
} = require('./rebuild-program-case-search-data');

assert.deepEqual(parseArguments([]), {
  execute: false, dryRun: true, audit: false, confirmation: false, batchSize: 25,
});
assert.equal(parseArguments(['--dry-run', '--batch-size=10']).batchSize, 10);
assert.throws(() => parseArguments(['--batch-size=0']), /INVALID_BATCH_SIZE/);
assert.throws(() => parseArguments(['--batch-size=101']), /INVALID_BATCH_SIZE/);
assert.throws(() => parseArguments(['--execute', '--dry-run']), /CONFLICTING_MODE/);
assert.doesNotThrow(() => assertExecutionAllowed(parseArguments([]), 'moira'));
assert.doesNotThrow(() => assertExecutionAllowed(parseArguments([]), 'moira_pgvector_integration_test'));
assert.throws(
  () => assertExecutionAllowed(parseArguments(['--execute']), 'moira'),
  /PRODUCTION_CONFIRMATION_REQUIRED/,
);
assert.throws(
  () => assertExecutionAllowed(parseArguments(['--execute', PRODUCTION_CONFIRMATION]), 'other'),
  /DATABASE_NOT_ALLOWLISTED/,
);
assert.doesNotThrow(() => assertExecutionAllowed(
  parseArguments(['--execute', PRODUCTION_CONFIRMATION]),
  'moira',
));

const source = require('node:fs').readFileSync(require.resolve('./rebuild-program-case-search-data'), 'utf8');
assert.match(source, /SET TRANSACTION READ ONLY/);
assert.match(source, /prisma\.\$transaction/);
assert.match(source, /maxWait: 10_000, timeout: 60_000/);
assert.match(source, /documentsUnchanged/);
assert.match(source, /changedRows/);
assert.doesNotMatch(source, /console\.log\([^)]*(content|rawText|cleanedText|sourceUrl)/);
console.log(JSON.stringify({ passed: true, cases: 12 }));
