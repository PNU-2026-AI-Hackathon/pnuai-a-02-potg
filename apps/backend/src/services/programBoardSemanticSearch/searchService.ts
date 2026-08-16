import { spawn } from 'node:child_process';
import path from 'node:path';
import type { SearchProfileKind } from './profileBuilder';

function pythonPath(backendDirectory: string) {
  return process.platform === 'win32'
    ? path.join(backendDirectory, '.venv', 'Scripts', 'python.exe')
    : path.join(backendDirectory, '.venv', 'bin', 'python');
}

function pythonEnv(backendDirectory: string) {
  return {
    ...process.env,
    KURE_MODEL_CACHE_DIR: process.env.KURE_MODEL_CACHE_DIR || path.join(backendDirectory, '.model-cache'),
    PYTHONIOENCODING: 'utf-8',
    PYTHONUTF8: '1',
    HF_HUB_OFFLINE: '1',
    TRANSFORMERS_OFFLINE: '1',
  };
}

/**
 * 검색 스크립트를 부르고 결과를 읽는다. 질의는 표준입력으로 넘긴다.
 *
 * 윈도우에서는 명령줄 인자가 UTF-8로 전달되지 않아 한글 질의가 CP949로 깨진다.
 * 깨진 질의는 오류를 내지 않고 엉뚱한 결과로 나타나 알아채기 어렵다.
 * 표준입력은 인코딩을 우리가 정할 수 있으므로 질의만 이쪽으로 보낸다.
 */
function runSearchScript<T>(backendDirectory: string, args: string[], query: string): Promise<T> {
  const script = path.join(backendDirectory, 'python', 'program_board_semantic_search.py');
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath(backendDirectory), [script, ...args], {
      cwd: path.join(backendDirectory, 'python'),
      env: pythonEnv(backendDirectory),
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`program board search script failed (${code}): ${stderr.slice(0, 500)}`));
      try {
        resolve(JSON.parse(stdout) as T);
      } catch (reason) {
        reject(new Error(`program board search script returned invalid JSON: ${String(reason)}`));
      }
    });
    child.stdin.end(Buffer.from(query, 'utf8'));
  });
}

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
  return runSearchScript<ProgramBoardSearchResponse>(
    backendDirectory,
    ['search', '--limit', String(limit), '--profile', profile, ...(audience ? ['--audience', audience] : [])],
    query,
  );
}

export async function buildProgramBoardContext(query: string, limit: number, audience?: string) {
  const backendDirectory = path.resolve(__dirname, '../../..');
  return runSearchScript<{ query: string; resultCount: number; markdown: string }>(
    backendDirectory,
    ['context', '--limit', String(limit), ...(audience ? ['--audience', audience] : [])],
    query,
  );
}
