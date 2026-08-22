export type CorpusType = 'CORE' | 'SAFE';
export type SearchMethod = 'BM25' | 'DENSE' | 'HYBRID' | 'HYBRID_TARGETED';

export type EmbeddingRecord = {
  corpusId: string; groupId: string; corpusType: CorpusType; contentHash: string;
  model: string; modelRevision: string; providerVersion: string; dimension: number;
  normalized: boolean; embedding: number[]; embeddingHash: string;
  status: 'COMPLETED' | 'FAILED'; error: string | null; generatedAt: null;
};

export type SearchResult = {
  rank: number; groupId: string; corpusId: string; canonicalTitle: string;
  representativeProgramCaseId: string; memberProgramCaseIds: string[];
  metadata: Record<string, unknown>; bm25Rank: number | null; denseRank: number | null;
  bm25Score: number | null; similarity: number | null; rrfScore: number | null;
  appliedBoosts: string[]; contentHash: string;
};
