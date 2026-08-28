const { spawnSync } = require('node:child_process');
const path = require('node:path');

const backend = path.resolve(__dirname, '..');
const python = process.platform === 'win32'
  ? path.join(backend, '.venv', 'Scripts', 'python.exe')
  : path.join(backend, '.venv', 'bin', 'python');
const result = spawnSync(
  python,
  [path.join(backend, 'python', 'program_board_pgvector_search.py'), ...process.argv.slice(2)],
  {
    cwd: path.join(backend, 'python'),
    stdio: 'inherit',
    env: {
      ...process.env,
      KURE_MODEL_CACHE_DIR: process.env.KURE_MODEL_CACHE_DIR || path.join(backend, '.model-cache'),
      PYTHONIOENCODING: 'utf-8',
      PYTHONUTF8: '1',
      HF_HUB_OFFLINE: '1',
      TRANSFORMERS_OFFLINE: '1',
    },
  },
);
process.exit(result.status ?? 1);
