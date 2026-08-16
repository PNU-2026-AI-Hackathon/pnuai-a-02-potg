import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import type { SearchProfileKind } from './profileBuilder';

const execFileAsync = promisify(execFile);

export type ProgramBoardSearchResponse = {
  query: string;
  limit: number;
  model: string;
  profile: SearchProfileKind;
  requestedAudience: string | null;
  requestedAudienceFilter: string | null;
  filteredOutByAudience: number;
  reranking: 'audience-compatibility-v1';
  candidateCount: number;
  eligibleCount: number;
  results: Array<{
    rank: number;
    sourceId: number;
    sourceUrl: string;
    title: string;
    target: string | null;
    libraryName: string | null;
    summary: string;
    sourceType: 'text' | 'attachment';
    similarity: number;
    rankingScore: number;
    audienceAdjustment: number;
    audienceMatch: string;
    conceptAdjustment: number;
    conceptCoverage: number;
    matchedConcepts: string[];
    missingConcepts: string[];
    detailLevel: 'detailed' | 'partial' | 'basic';
    detailReason: string;
    sessionCount: number;
  }>;
};

export async function searchProgramBoard(
  query: string,
  limit: number,
  profile: SearchProfileKind,
  audience?: string,
): Promise<ProgramBoardSearchResponse> {
  const backendDirectory = path.resolve(__dirname, '../../..');
  const python = process.platform === 'win32'
    ? path.join(backendDirectory, '.venv', 'Scripts', 'python.exe')
    : path.join(backendDirectory, '.venv', 'bin', 'python');
  const script = path.join(backendDirectory, 'python', 'program_board_semantic_search.py');
  const { stdout } = await execFileAsync(
    python,
    [script, 'search', '--query', query, '--limit', String(limit), '--profile', profile,
      ...(audience ? ['--audience', audience] : [])],
    {
      cwd: path.join(backendDirectory, 'python'),
      env: {
        ...process.env,
        KURE_MODEL_CACHE_DIR: process.env.KURE_MODEL_CACHE_DIR || path.join(backendDirectory, '.model-cache'),
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
        HF_HUB_OFFLINE: '1',
        TRANSFORMERS_OFFLINE: '1',
      },
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    },
  );
  return JSON.parse(stdout) as ProgramBoardSearchResponse;
}

export async function buildProgramBoardContext(query: string, limit: number, audience?: string) {
  const backendDirectory = path.resolve(__dirname, '../../..');
  const python = process.platform === 'win32'
    ? path.join(backendDirectory, '.venv', 'Scripts', 'python.exe')
    : path.join(backendDirectory, '.venv', 'bin', 'python');
  const { stdout } = await execFileAsync(
    python,
    [path.join(backendDirectory, 'python', 'program_board_semantic_search.py'), 'context', '--query', query, '--limit', String(limit),
      ...(audience ? ['--audience', audience] : [])],
    {
      cwd: path.join(backendDirectory, 'python'),
      env: { ...process.env, KURE_MODEL_CACHE_DIR: process.env.KURE_MODEL_CACHE_DIR || path.join(backendDirectory, '.model-cache'), PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1' },
      encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    },
  );
  return JSON.parse(stdout) as { query: string; resultCount: number; markdown: string };
}
