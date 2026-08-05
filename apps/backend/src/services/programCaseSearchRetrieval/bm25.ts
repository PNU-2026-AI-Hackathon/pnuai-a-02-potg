import { SearchCorpusRecord } from '../programCaseSearchCorpus/types';
import { tokenize, BM25_TOKENIZER_VERSION } from './tokenizer';
import { sha, stable } from './artifacts';

export type Bm25Index = { version: string; corpusHash: string; documentCount: number; averageLength: number; k1: number; b: number; documentFrequency: Record<string, number>; documents: Array<{ corpusId: string; groupId: string; length: number; terms: Record<string, number> }>; indexHash: string };
export function buildBm25(records: SearchCorpusRecord[], corpusHash: string): Bm25Index {
  const df: Record<string, number> = {};
  const documents = records.map((record) => { const tokens = tokenize(record.lexicalText); const terms: Record<string, number> = {}; tokens.forEach((t) => terms[t] = (terms[t] ?? 0) + 1); Object.keys(terms).forEach((t) => df[t] = (df[t] ?? 0) + 1); return { corpusId: record.corpusId, groupId: record.groupId, length: tokens.length, terms }; });
  const base = { version: BM25_TOKENIZER_VERSION, corpusHash, documentCount: documents.length, averageLength: documents.reduce((a, d) => a + d.length, 0) / documents.length, k1: 1.2, b: .75, documentFrequency: df, documents };
  return { ...base, indexHash: sha(stable(base)) };
}
export function searchBm25(index: Bm25Index, query: string) {
  const tokens = [...new Set(tokenize(query))]; const n = index.documentCount;
  return index.documents.map((doc) => ({ ...doc, score: tokens.reduce((sum, term) => { const tf = doc.terms[term] ?? 0; if (!tf) return sum; const idf = Math.log(1 + (n - (index.documentFrequency[term] ?? 0) + .5) / ((index.documentFrequency[term] ?? 0) + .5)); return sum + idf * tf * (index.k1 + 1) / (tf + index.k1 * (1 - index.b + index.b * doc.length / index.averageLength)); }, 0) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.groupId.localeCompare(b.groupId));
}
