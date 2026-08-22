const assert = require('node:assert/strict');
const { parseSourceSnapshotArguments } = require('../dist/cli/programCaseSourceSnapshot');

assert.equal(parseSourceSnapshotArguments([]).mode, 'dry-run');
assert.equal(parseSourceSnapshotArguments(['--dry-run']).mode, 'dry-run');
assert.equal(parseSourceSnapshotArguments(['--build']).mode, 'build');
assert.equal(parseSourceSnapshotArguments(['--validate']).mode, 'validate');
assert.equal(parseSourceSnapshotArguments(['--output=custom']).outputDirectory.endsWith('custom'), true);
assert.throws(() => parseSourceSnapshotArguments(['--build', '--validate']), /Only one/);
assert.throws(() => parseSourceSnapshotArguments(['--unknown']), /Unknown option/);
assert.throws(() => parseSourceSnapshotArguments(['--output']), /requires a value/);
console.log('Program case source snapshot CLI tests passed.');
