const { spawnSync } = require('node:child_process');
const path = require('node:path');

const backend = path.resolve(__dirname, '..');
const python = process.platform === 'win32'
  ? path.join(backend, '.venv', 'Scripts', 'python.exe')
  : path.join(backend, '.venv', 'bin', 'python');
const result = spawnSync(python, ['-m', 'program_case_search_profile.cli', ...process.argv.slice(2)], {
  cwd: backend,
  env: { ...process.env, PYTHONPATH: path.join(backend, 'python'), PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
