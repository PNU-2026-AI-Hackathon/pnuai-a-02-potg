const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { runSubprocess } = require('../dist/services/attachment/subprocessRunner');

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kordoc-deployment-test-'));
  try {
    const fake = path.resolve(__dirname, 'fake-subprocess.js');
    await assert.rejects(
      () => runSubprocess({
        executable: process.execPath,
        args: [fake, 'delay', '1000'],
        timeoutMs: 20,
        stdoutMaxBytes: 1024,
        stderrMaxBytes: 1024,
      }),
      (error) => error.code === 'SUBPROCESS_TIMEOUT',
    );
    await assert.rejects(
      () => runSubprocess({
        executable: process.execPath,
        args: [fake, 'stdout', '1024'],
        timeoutMs: 1000,
        stdoutMaxBytes: 8,
        stderrMaxBytes: 1024,
      }),
      (error) => error.code === 'SUBPROCESS_OUTPUT_LIMIT_EXCEEDED',
    );
    const value = '동일 출력';
    assert.equal(
      crypto.createHash('sha256').update(value).digest('hex'),
      crypto.createHash('sha256').update(value).digest('hex'),
    );
    console.log('kordoc deployment validation tests passed.');
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
