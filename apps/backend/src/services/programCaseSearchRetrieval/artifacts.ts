import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { SearchCorpusRecord } from '../programCaseSearchCorpus/types';
import { CorpusType, EmbeddingRecord } from './types';

export const ROOT = path.resolve(__dirname, '../../../.local/program-case-search-v2');
export const RETRIEVAL = path.join(ROOT, 'retrieval');
export const EVALUATION = path.join(ROOT, 'evaluation');
export const sha = (value: unknown) => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export const stable = (value: unknown): string => Array.isArray(value) ? `[${value.map(stable).join(',')}]` : value && typeof value === 'object' ? `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}` : JSON.stringify(value);
export function readJson<T>(file: string): T { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; }
export function writeJson(file: string, value: unknown) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
export function corpus(type: CorpusType): SearchCorpusRecord[] {
  const file = path.join(ROOT, 'corpus', type === 'CORE' ? 'search-corpus-core.jsonl' : 'search-corpus-safe.jsonl');
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}
export function embeddings(type: CorpusType): EmbeddingRecord[] {
  return readJson(path.join(RETRIEVAL, type === 'CORE' ? 'core-embeddings.json' : 'safe-embeddings.json'));
}
