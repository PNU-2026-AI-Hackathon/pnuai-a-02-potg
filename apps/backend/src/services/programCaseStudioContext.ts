import { spawn } from 'node:child_process';
import path from 'node:path';

export const STUDIO_AUDIENCE_FILTERS = new Set([
  'preschool', 'elementary-lower', 'elementary-upper', 'adult', 'everyone',
]);

export type ProgramCaseStudioContextResponse = {
  query: string;
  resultCount: number;
  markdown: string;
  search: {
    source: 'POSTGRESQL_PGVECTOR';
    candidateCount: number;
    eligibleCount: number;
    results: Array<{
      rank: number;
      sourceId: number;
      title: string;
      target: string | null;
      similarity: number;
      rankingScore: number;
      conceptCoverage: number;
      audienceMatch: string;
    }>;
  };
};

const SEARCH_API_TIMEOUT_MS = 15_000;

async function searchWithPersistentApi(
  apiUrl: string,
  query: string,
  audience?: string,
): Promise<ProgramCaseStudioContextResponse> {
  const response = await fetch(new URL('/studio-context', apiUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, audience, limit: 5 }),
    signal: AbortSignal.timeout(SEARCH_API_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => ({})) as Partial<ProgramCaseStudioContextResponse> & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || `Persistent search API failed (${response.status})`);
  }
  if (typeof payload.markdown !== 'string' || !payload.search) {
    throw new Error('Persistent search API returned an invalid response');
  }
  return payload as ProgramCaseStudioContextResponse;
}

/** 프로그램 단위 pgvector 검색과 파일럿 재정렬을 한 프로세스에서 실행한다. */
export function searchProgramCaseStudioContext(
  query: string,
  audience?: string,
): Promise<ProgramCaseStudioContextResponse> {
  const persistentApiUrl = process.env.PROGRAM_CASE_SEARCH_API_URL?.trim();
  if (persistentApiUrl) {
    return searchWithPersistentApi(persistentApiUrl, query, audience);
  }

  // 로컬 개발과 기존 배포의 호환성을 위해 URL이 없을 때만 CLI를 사용한다.
  // 운영 EC2는 PROGRAM_CASE_SEARCH_API_URL을 설정해 KURE 모델을 재사용한다.
  const backendDirectory = path.resolve(__dirname, '../..');
  const pythonExecutable = process.platform === 'win32'
    ? path.join(backendDirectory, '.venv', 'Scripts', 'python.exe')
    : path.join(backendDirectory, '.venv', 'bin', 'python');
  return new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable, [
      path.join(backendDirectory, 'python', 'program_board_pgvector_search.py'),
      'context', '--limit', '5', ...(audience ? ['--audience', audience] : []),
    ], {
      cwd: path.join(backendDirectory, 'python'),
      env: {
        ...process.env,
        KURE_MODEL_CACHE_DIR: process.env.KURE_MODEL_CACHE_DIR || path.join(backendDirectory, '.model-cache'),
        HF_HUB_OFFLINE: '1',
        TRANSFORMERS_OFFLINE: '1',
        PYTHONIOENCODING: 'utf-8',
        PYTHONUTF8: '1',
      },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Studio pgvector search failed (${code}): ${stderr.slice(0, 500)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as ProgramCaseStudioContextResponse);
      } catch (error) {
        reject(new Error(`Studio pgvector search returned invalid JSON: ${String(error)}`));
      }
    });
    child.stdin.end(Buffer.from(query, 'utf8'));
  });
}
