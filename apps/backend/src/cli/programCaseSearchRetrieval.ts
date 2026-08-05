import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildBm25 } from '../services/programCaseSearchRetrieval/bm25';
import { corpus, EVALUATION, RETRIEVAL, ROOT, readJson, sha, stable, writeJson } from '../services/programCaseSearchRetrieval/artifacts';
import { search } from '../services/programCaseSearchRetrieval/searchService';
import { buildQueries, metrics, qrels } from '../services/programCaseSearchEvaluation/evaluation';

const args = process.argv.slice(2);
const has = (value: string) => args.includes(value);
const python = process.platform === 'win32'
  ? path.resolve('.venv/Scripts/python.exe') : path.resolve('.venv/bin/python');
const pythonDirectory = path.resolve('python');
const modelCache = path.resolve('.model-cache');
const offlineEnvironment = {
  ...process.env,
  PYTHONPATH: pythonDirectory,
  KURE_MODEL_CACHE_DIR: modelCache,
  HF_HUB_OFFLINE: '1',
  TRANSFORMERS_OFFLINE: '1',
  PYTHONIOENCODING: 'utf-8',
  PYTHONUTF8: '1',
};

function buildIndexes() {
  for (const type of ['CORE', 'SAFE'] as const) {
    const records = corpus(type);
    const index = buildBm25(records, sha(stable(records.map((record) => record.contentHash))));
    writeJson(path.join(RETRIEVAL, type === 'CORE' ? 'bm25-core-index.json' : 'bm25-safe-index.json'), index);
  }
  writeJson(path.join(RETRIEVAL, 'bm25-tokenizer-manifest.json'), {
    version: 'unicode-light-ko-v1', normalization: 'NFKC', k1: 1.2, b: .75,
  });
}

function embed() {
  fs.mkdirSync(RETRIEVAL, { recursive: true });
  for (const type of ['CORE', 'SAFE'] as const) {
    execFileSync(python, [
      '-m', 'program_case_semantic_search.artifact_cli',
      '--input', path.join(ROOT, 'corpus', type === 'CORE' ? 'search-corpus-core.jsonl' : 'search-corpus-safe.jsonl'),
      '--output', path.join(RETRIEVAL, type === 'CORE' ? 'core-embeddings.json' : 'safe-embeddings.json'),
      '--corpus-type', type,
    ], { cwd: pythonDirectory, stdio: 'inherit', env: offlineEnvironment });
  }
}

function queries() {
  const values = buildQueries();
  writeJson(path.join(EVALUATION, 'queries.json'), values);
  console.log(`queries: ${values.length}`);
}

function validate() {
  const report: Record<string, any> = {
    valid: true,
    corpusDatasetHash: '335173fc6de4ccdd5736230a2843592a152490ce2e6d60e47f7d0745e485d8d5',
  };
  for (const type of ['CORE', 'SAFE'] as const) {
    const records = corpus(type);
    const contentById = new Map(records.map((record) => [record.corpusId, record.contentHash]));
    const values = readJson<any[]>(path.join(RETRIEVAL, type === 'CORE' ? 'core-embeddings.json' : 'safe-embeddings.json'));
    const summary = {
      count: values.length,
      completed: values.filter((value) => value.status === 'COMPLETED').length,
      dimensions: [...new Set(values.map((value) => value.dimension))],
      empty: values.filter((value) => !value.embedding.length).length,
      nan: values.filter((value) => value.embedding.some((number: number) => Number.isNaN(number))).length,
      infinity: values.filter((value) => value.embedding.some((number: number) => !Number.isFinite(number) && !Number.isNaN(number))).length,
      duplicates: values.length - new Set(values.map((value) => value.corpusId)).size,
      contentHashMismatch: values.filter((value) => contentById.get(value.corpusId) !== value.contentHash).length,
      modelContractMissing: values.filter((value) => !value.model || !value.modelRevision || !value.providerVersion || value.normalized !== true).length,
      normalizationMismatch: values.filter((value) => Math.abs(Math.sqrt(value.embedding.reduce((sum: number, number: number) => sum + number * number, 0)) - 1) > 1e-5).length,
    };
    report[type.toLowerCase()] = summary;
    report.valid &&= summary.count === 280 && summary.completed === 280
      && summary.dimensions.length === 1 && summary.dimensions[0] === 1024
      && summary.empty === 0 && summary.nan === 0 && summary.infinity === 0
      && summary.duplicates === 0 && summary.contentHashMismatch === 0
      && summary.modelContractMissing === 0 && summary.normalizationMismatch === 0;
  }
  writeJson(path.join(RETRIEVAL, 'embedding-validation-report.json'), report);
  console.log(JSON.stringify(report, null, 2));
  if (!report.valid) process.exitCode = 1;
}

type PoolInput = { queryId: string; queryEmbedding: number[]; chunk: { rawChunkCandidates: number; uniquePrograms: number; duplicatesRemoved: number; results: any[] } };
function pool() {
  const queryFile = path.join(EVALUATION, 'queries.json');
  if (!fs.existsSync(queryFile)) queries();
  const inputFile = path.join(EVALUATION, 'pool-inputs.json');
  execFileSync(python, [
    '-m', 'program_case_semantic_search.pool_cli', '--queries', queryFile,
    '--output', inputFile, '--cache', modelCache, '--limit', '10',
  ], { cwd: pythonDirectory, stdio: 'inherit', env: offlineEnvironment });
  const queryRecords = readJson<any[]>(queryFile);
  const inputs = readJson<PoolInput[]>(inputFile);
  const allCorpus = corpus('CORE');
  const groupByProgramCase = new Map<string, string>();
  const recordByGroup = new Map(allCorpus.map((record) => [record.groupId, record]));
  for (const record of allCorpus) for (const id of record.memberProgramCaseIds) groupByProgramCase.set(id, record.groupId);
  const rows: any[] = [];
  const diagnostics: any[] = [];
  for (const query of queryRecords) {
    const input = inputs.find((item) => item.queryId === query.queryId);
    if (!input) throw new Error(`missing pool input for ${query.queryId}`);
    const candidates = new Map<string, any>();
    const add = (method: string, groupId: string, rank: number, scores: Record<string, number>, extra: Record<string, unknown> = {}) => {
      const record = recordByGroup.get(groupId);
      if (!record) return;
      let candidate = candidates.get(groupId);
      if (!candidate) {
        candidate = { queryId: query.queryId, resultKey: groupId, groupId, canonicalTitle: record.canonicalTitle, retrievalMethods: [], ranks: {}, scores: {}, evaluationStatus: 'UNEVALUATED', contentHash: record.contentHash, ...extra };
        candidates.set(groupId, candidate);
      }
      candidate.retrievalMethods.push(method); candidate.ranks[method] = rank; candidate.scores[method] = scores;
    };
    for (const result of input.chunk.results) {
      const groupId = groupByProgramCase.get(result.programCaseId);
      if (groupId) add('CHUNK_P0', groupId, result.rank, { similarity: result.similarity }, { programCaseId: result.programCaseId, chunkId: result.chunkId, chunkType: result.chunkType });
    }
    for (const corpusType of ['CORE', 'SAFE'] as const) for (const method of ['BM25', 'DENSE', 'HYBRID'] as const) {
      const methodKey = `${method}_${corpusType}`;
      const results = search({ query: query.queryText, method, corpusType, limit: 10, queryEmbedding: method === 'BM25' ? undefined : input.queryEmbedding });
      if (new Set(results.map((result) => result.groupId)).size !== results.length) throw new Error(`${query.queryId} ${methodKey} duplicate group`);
      results.forEach((result) => add(methodKey, result.groupId, result.rank, {
        ...(result.bm25Score == null ? {} : { bm25Score: result.bm25Score }),
        ...(result.similarity == null ? {} : { similarity: result.similarity }),
        ...(result.rrfScore == null ? {} : { rrfScore: result.rrfScore }),
      }));
    }
    rows.push(...[...candidates.values()].sort((a, b) => a.resultKey.localeCompare(b.resultKey)));
    diagnostics.push({ queryId: query.queryId, poolSize: candidates.size, chunk: input.chunk });
  }
  writeJson(path.join(EVALUATION, 'pooled-results.json'), rows);
  writeJson(path.join(EVALUATION, 'pooling-report.json'), { queryCount: queryRecords.length, pooledResultCount: rows.length, duplicateEvaluationUnits: rows.length - new Set(rows.map((row) => `${row.queryId}:${row.resultKey}`)).size, diagnostics });
  console.log(JSON.stringify({ queries: queryRecords.length, pooledResults: rows.length }, null, 2));
}

if (has('--all') || has('--embed')) embed();
if (has('--all') || has('--build-bm25')) buildIndexes();
if (has('--all') || has('--build-query-set')) queries();
if (has('--all') || has('--validate')) validate();
if (has('--all') || has('--pool')) pool();
if (has('--metrics')) {
  const value = metrics(); writeJson(path.join(EVALUATION, 'qrels.json'), qrels()); writeJson(path.join(EVALUATION, 'metrics.json'), value); console.log(value);
}
if (has('--evaluation-report')) {
  const value = metrics();
  writeJson(path.join(EVALUATION, 'evaluation-report.json'), { evaluationVersion: 'program-case-search-evaluation-v1', querySetVersion: 'program-case-search-queries-v1', corpusDatasetHash: '335173fc6de4ccdd5736230a2843592a152490ce2e6d60e47f7d0745e485d8d5', final: value.evaluatedQueries === value.totalQueries, ...value });
}
if (has('--public-summary')) {
  const value = metrics();
  const output = path.resolve('../..', 'docs/analysis/data/program-case-search-metrics.public.json');
  writeJson(output, { status: value.status, final: value.evaluatedQueries === value.totalQueries, totalQueries: value.totalQueries, evaluatedQueries: value.evaluatedQueries, relevantThreshold: value.relevantThreshold, methods: value.methods, metricsHash: value.metricsHash });
  console.log(`public summary: ${output}`);
}
if (has('--audit')) console.log({ root: ROOT, corpus: corpus('CORE').length, safe: corpus('SAFE').length, databaseWrites: 0 });
