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

/** 프로그램 단위 pgvector 검색과 파일럿 재정렬을 한 프로세스에서 실행한다. */
export function searchProgramCaseStudioContext(
  query: string,
  audience?: string,
): Promise<ProgramCaseStudioContextResponse> {
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
