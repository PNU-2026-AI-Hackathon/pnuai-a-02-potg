import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type SearchProfileResult = {
  rank: number;
  similarity: number;
  programCaseId: string;
  title: string;
  topics: string[];
  targetAgeGroups: string[];
  activityTypes: string[];
  operationTypes: string[];
  sessionCount: number;
  representativeDocument: string;
};

export async function searchProgramCaseProfiles(query: string, limit: number) {
  const backend = path.resolve(__dirname, '../..');
  const python = process.platform === 'win32'
    ? path.join(backend, '.venv', 'Scripts', 'python.exe')
    : path.join(backend, '.venv', 'bin', 'python');
  const { stdout } = await execFileAsync(python, ['-m', 'program_case_search_profile.cli', 'search', '--query', query, '--limit', String(limit)], {
    cwd: backend,
    env: { ...process.env, PYTHONPATH: path.join(backend, 'python'), KURE_MODEL_CACHE_DIR: process.env.KURE_MODEL_CACHE_DIR || path.join(backend, '.model-cache'), PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  return JSON.parse(stdout) as { candidateCount: number; model: string; results: SearchProfileResult[] };
}

export async function compareProgramCaseSearch(query: string, limit: number) {
  const backend = path.resolve(__dirname, '../..');
  const python = process.platform === 'win32' ? path.join(backend, '.venv', 'Scripts', 'python.exe') : path.join(backend, '.venv', 'bin', 'python');
  const { stdout } = await execFileAsync(python, ['-m', 'program_case_search_profile.cli', 'compare', '--query', query, '--limit', String(limit)], {
    cwd: backend,
    env: { ...process.env, PYTHONPATH: path.join(backend, 'python'), KURE_MODEL_CACHE_DIR: process.env.KURE_MODEL_CACHE_DIR || path.join(backend, '.model-cache'), HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  return JSON.parse(stdout) as { pilot: true; chunkCandidateScope: string; profileCandidateScope: string; chunkResults: unknown[]; profileResults: SearchProfileResult[] };
}
