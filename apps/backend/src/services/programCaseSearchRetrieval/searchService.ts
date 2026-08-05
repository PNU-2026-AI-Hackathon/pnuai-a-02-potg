import path from 'node:path';
import { corpus, embeddings, readJson, RETRIEVAL } from './artifacts';
import { Bm25Index, searchBm25 } from './bm25';
import { CorpusType, SearchMethod, SearchResult } from './types';
export const RRF_VERSION = 'rrf-v1'; export const RRF_CONSTANT = 60;
export type SearchOptions = { query: string; method: SearchMethod; corpusType: CorpusType; limit: number; queryEmbedding?: number[]; targetAgeGroup?: string; grade?: number };
const dot = (a: number[], b: number[]) => a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
export function search(options: SearchOptions): SearchResult[] {
  const records = corpus(options.corpusType); const byId = new Map(records.map((r) => [r.corpusId, r]));
  const index = readJson<Bm25Index>(path.join(RETRIEVAL, options.corpusType === 'CORE' ? 'bm25-core-index.json' : 'bm25-safe-index.json'));
  const bm = searchBm25(index, options.query).slice(0, 50); const bmRank = new Map(bm.map((x, i) => [x.corpusId, { rank: i + 1, score: x.score }]));
  const dense = options.queryEmbedding ? embeddings(options.corpusType).filter((x) => x.status === 'COMPLETED').map((x) => ({ corpusId: x.corpusId, similarity: dot(options.queryEmbedding!, x.embedding) })).sort((a, b) => b.similarity - a.similarity).slice(0, 50) : [];
  const denseRank = new Map(dense.map((x, i) => [x.corpusId, { rank: i + 1, similarity: x.similarity }]));
  const ids = options.method === 'BM25' ? bm.map((x) => x.corpusId) : options.method === 'DENSE' ? dense.map((x) => x.corpusId) : [...new Set([...bm.map((x) => x.corpusId), ...dense.map((x) => x.corpusId)])];
  return ids.map((id) => { const r = byId.get(id)!; const b = bmRank.get(id), d = denseRank.get(id); const appliedBoosts: string[] = []; let score = (b ? 1 / (RRF_CONSTANT + b.rank) : 0) + (d ? 1 / (RRF_CONSTANT + d.rank) : 0); const meta = r.metadata as any; if (options.method === 'HYBRID_TARGETED' && options.targetAgeGroup && Array.isArray(meta.targetAgeGroups) && meta.targetAgeGroups.includes(options.targetAgeGroup)) { score += .002; appliedBoosts.push('TARGET_AGE_GROUP:+0.002'); } if (options.grade != null && meta.gradeRangeCandidate && (options.grade < meta.gradeRangeCandidate.min || options.grade > meta.gradeRangeCandidate.max)) return null; return { rank: 0, groupId: r.groupId, corpusId: r.corpusId, canonicalTitle: r.canonicalTitle, representativeProgramCaseId: r.representativeProgramCaseId, memberProgramCaseIds: r.memberProgramCaseIds, metadata: r.metadata, bm25Rank: b?.rank ?? null, denseRank: d?.rank ?? null, bm25Score: b?.score ?? null, similarity: d?.similarity ?? null, rrfScore: options.method.startsWith('HYBRID') ? score : null, appliedBoosts, contentHash: r.contentHash, _score: options.method === 'BM25' ? b?.score ?? 0 : options.method === 'DENSE' ? d?.similarity ?? -1 : score }; }).filter(Boolean).sort((a: any, b: any) => b._score - a._score || a.groupId.localeCompare(b.groupId)).slice(0, options.limit).map((x: any, i) => { const { _score, ...result } = x; return { ...result, rank: i + 1 }; });
}
