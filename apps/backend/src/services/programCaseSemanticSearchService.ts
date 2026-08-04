import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type SemanticSearchResult = {
  rank: number;
  programTitle: string;
  similarity: number;
  chunkType: string;
  programCaseId: string;
};

type CliResponse = {
  results?: SemanticSearchResult[];
};

export async function searchProgramCases(
  query: string,
  limit: number,
): Promise<SemanticSearchResult[]> {
  const backendDirectory = path.resolve(__dirname, '../..');
  const pythonDirectory = path.join(backendDirectory, 'python');
  const modelCacheDirectory = path.join(backendDirectory, '.model-cache');
  const pythonExecutable = process.platform === 'win32'
    ? path.join(backendDirectory, '.venv', 'Scripts', 'python.exe')
    : path.join(backendDirectory, '.venv', 'bin', 'python');

  const { stdout } = await execFileAsync(
    pythonExecutable,
    ['-m', 'program_case_semantic_search.cli', 'search', '--query', query, '--limit', String(limit), '--json'],
    {
      cwd: pythonDirectory,
      env: {
        ...process.env,
        KURE_MODEL_CACHE_DIR: process.env.KURE_MODEL_CACHE_DIR || modelCacheDirectory,
      },
      maxBuffer: 1024 * 1024,
    },
  );
  const payload = JSON.parse(stdout) as CliResponse;

  return (payload.results ?? []).slice(0, limit).map((result) => ({
    rank: result.rank,
    programTitle: result.programTitle,
    similarity: result.similarity,
    chunkType: result.chunkType,
    programCaseId: result.programCaseId,
  }));
}
