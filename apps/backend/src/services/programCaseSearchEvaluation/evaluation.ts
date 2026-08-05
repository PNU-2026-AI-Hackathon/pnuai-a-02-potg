import path from 'node:path';
import { EVALUATION, readJson, sha, stable, writeJson } from '../programCaseSearchRetrieval/artifacts';

export const QUERY_SET_VERSION = 'program-case-search-queries-v1';
export const EVALUATION_VERSION = 'program-case-search-evaluation-v1';
export type QueryRecord = { queryId: string; queryText: string; queryType: string; targetIntent: Record<string, unknown>; notes: string; querySetVersion: string; contentHash: string };
export type Label = { queryId: string; resultKey: string; groupId: string; relevance: number; reviewerNote: string; evaluationVersion: string; reviewedAt: string; contentHash: string };
type PoolRow = { queryId: string; resultKey: string; retrievalMethods: string[]; ranks: Record<string, number> };

const seeds = ['초등학생 환경 체험 프로그램','성인 대상 디지털 교육','유아와 부모가 함께하는 그림책 활동','청년층 건강 프로그램','어린이 글쓰기와 토론 프로그램','한 번만 진행하는 공예 체험','여러 회차로 진행하는 독서 프로그램','지역 주민이 함께 참여하는 공동체 프로그램','청소년을 위한 진로 프로그램','중학생 과학 실험','고등학생 진학 상담','노년층 스마트폰 교육','가족 참여 문화 행사','부모 교육 프로그램','영유아 음악 놀이','초등 저학년 독서','초등 고학년 코딩','성인 인문학 강좌','작가와의 만남','주말 어린이 체험','평일 저녁 성인 강좌','도서관 자원봉사 교육','지역 역사 탐방','건강한 식생활 교육','다문화 가족 프로그램','장애인 문화 활동','온라인 비대면 강좌','무료 일회성 특강','장기 독서 모임','적합한 결과가 없을 것 같은 우주비행사 훈련'];
export function buildQueries(): QueryRecord[] {
  return seeds.map((queryText, index) => {
    const base = { queryId: `q${String(index + 1).padStart(3, '0')}`, queryText, queryType: index === 29 ? 'NO_EXPECTED_MATCH' : 'MIXED_INTENT', targetIntent: {}, notes: '사람 평가용 고정 seed query', querySetVersion: QUERY_SET_VERSION };
    return { ...base, contentHash: sha(stable(base)) };
  });
}

function loadLabels(): Label[] { try { return readJson(path.join(EVALUATION, 'relevance-labels.json')); } catch { return []; } }
function loadPool(): PoolRow[] { try { return readJson(path.join(EVALUATION, 'pooled-results.json')); } catch { return []; } }
export function qrels(labels = loadLabels()) { return labels.map(({ queryId, resultKey, groupId, relevance, contentHash }) => ({ queryId, resultKey, groupId, relevance, contentHash })).sort((a, b) => a.queryId.localeCompare(b.queryId) || a.resultKey.localeCompare(b.resultKey)); }

export function saveLabel(input: Omit<Label, 'contentHash'>) {
  if (!Number.isInteger(input.relevance) || input.relevance < 0 || input.relevance > 3) throw new Error('relevance must be an integer from 0 to 3');
  const labels = loadLabels();
  const hashInput = { ...input, reviewedAt: undefined };
  const value = { ...input, contentHash: sha(stable(hashInput)) };
  const index = labels.findIndex((label) => label.queryId === input.queryId && label.resultKey === input.resultKey);
  if (index >= 0) labels[index] = value; else labels.push(value);
  writeJson(path.join(EVALUATION, 'relevance-labels.json'), labels);
  writeJson(path.join(EVALUATION, 'qrels.json'), qrels(labels));
  return value;
}

export function calculateMetrics(pool: PoolRow[], labels: Label[]) {
  const byKey = new Map(labels.map((label) => [`${label.queryId}:${label.resultKey}`, label.relevance]));
  const poolByQuery = new Map<string, PoolRow[]>();
  for (const row of pool) poolByQuery.set(row.queryId, [...(poolByQuery.get(row.queryId) ?? []), row]);
  const completedQueries = [...poolByQuery.entries()].filter(([, rows]) => rows.length > 0 && rows.every((row) => byKey.has(`${row.queryId}:${row.resultKey}`))).map(([queryId]) => queryId);
  const methods = [...new Set(pool.flatMap((row) => row.retrievalMethods ?? []))].sort();
  const methodRows = methods.map((method) => {
    let precision = 0, nDcg = 0, reciprocalRank = 0, success = 0, mean = 0;
    for (const queryId of completedQueries) {
      const all = poolByQuery.get(queryId) ?? [];
      const ranked = all.filter((row) => row.retrievalMethods.includes(method)).sort((a, b) => (a.ranks[method] ?? 999) - (b.ranks[method] ?? 999)).slice(0, 5);
      const relevance = ranked.map((row) => byKey.get(`${queryId}:${row.resultKey}`) ?? 0);
      precision += relevance.filter((value) => value >= 2).length / 5;
      mean += relevance.reduce((sum, value) => sum + value, 0) / 5;
      const first = relevance.findIndex((value) => value >= 2); reciprocalRank += first < 0 ? 0 : 1 / (first + 1);
      success += relevance.slice(0, 3).some((value) => value >= 2) ? 1 : 0;
      const dcg = relevance.reduce((sum, value, index) => sum + (2 ** value - 1) / Math.log2(index + 2), 0);
      const ideal = all.map((row) => byKey.get(`${queryId}:${row.resultKey}`) ?? 0).sort((a, b) => b - a).slice(0, 5).reduce((sum, value, index) => sum + (2 ** value - 1) / Math.log2(index + 2), 0);
      nDcg += ideal ? dcg / ideal : 0;
    }
    const count = completedQueries.length || 1;
    return { method, evaluatedQueries: completedQueries.length, precisionAt5: precision / count, nDcgAt5: nDcg / count, mrr: reciprocalRank / count, successAt3: success / count, meanRelevanceAt5: mean / count };
  });
  const result = { status: completedQueries.length ? 'PROVISIONAL' : 'AWAITING_HUMAN_LABELS', relevantThreshold: 2, totalQueries: poolByQuery.size, evaluatedQueries: completedQueries.length, labeledResults: labels.length, methods: methodRows };
  return { ...result, metricsHash: sha(stable(result)) };
}

export function metrics() { return calculateMetrics(loadPool(), loadLabels()); }
