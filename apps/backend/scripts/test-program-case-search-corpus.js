const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildAll, hash, loadBuildInputs, normalizeTitle, sanitizeSearchText, summarize } = require('../dist/services/programCaseSearchCorpus/builder');
const { buildCorpusArtifacts } = require('../dist/services/programCaseSearchCorpus/artifactStore');
const { ProgramCaseSearchInspector } = require('../dist/services/programCaseSearchCorpus/inspectorService');

const root = path.resolve(__dirname, '../.local/program-case-search-v2');
const inputs = loadBuildInputs(root);
const first = buildAll(inputs);
const second = buildAll(inputs);
assert.strictEqual(hash(first), hash(second), 'pipeline must be deterministic');
assert.strictEqual(first.groups.length, first.coreCorpus.length);
assert.strictEqual(first.groups.length, first.safeCorpus.length);
assert.strictEqual(new Set(first.groups.flatMap((g) => g.memberProgramCaseIds)).size, inputs.programCases.length);
assert.strictEqual(first.safety.filter((d) => ['AMBIGUOUS', 'NO_RELIABLE_MATCH'].includes(d.candidateStatus) && d.safetyStatus === 'SAFE_FOR_CORPUS').length, 0);
assert.deepStrictEqual(normalizeTitle('향기로운 크리스마스 캔들 만들기 2차(11:00~12:00)'), {
  originalTitle: '향기로운 크리스마스 캔들 만들기 2차(11:00~12:00)', baseTitle: '향기로운 크리스마스 캔들 만들기', normalizedBaseTitle: '향기로운크리스마스캔들만들기', occurrenceDateCandidate: null, timeCandidate: '11:00~12:00', roundCandidate: 2, institutionPrefix: null,
});
assert(!sanitizeSearchText('문의: 051-123-4567 강사: 홍길동 test@example.com').match(/051|홍길동|@/));
const report = summarize(inputs, first);
assert.strictEqual(report.privacyScan.matches, 0);
assert.strictEqual(report.databaseWriteCount, 0);
const built = buildCorpusArtifacts(root);
assert.strictEqual(built.summary.datasetHash, report.datasetHash);
for (const name of ['program-groups.jsonl', 'section-safety-decisions.jsonl', 'search-corpus-core.jsonl', 'search-corpus-safe.jsonl', 'validation-report.json']) assert(fs.existsSync(path.join(root, 'corpus', name)));
const inspector = new ProgramCaseSearchInspector(root);
assert.strictEqual(inspector.summary().databaseWriteCount, 0);
const listed = inspector.list({});
assert.strictEqual(listed.length, inputs.programCases.length);
assert(inspector.programCase(listed[0].programCaseId));
assert.strictEqual(inspector.source('../validation-report.json'), null, 'path traversal input must be rejected');
assert.strictEqual(inspector.asset('0'.repeat(64)), null, 'unknown hashes must not expose files');
console.log(JSON.stringify({ ok: true, counts: report.counts, datasetHash: report.datasetHash }, null, 2));
