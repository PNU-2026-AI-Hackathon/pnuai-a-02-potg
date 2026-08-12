import { readFile, mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { normalizeProgram } from '../services/programDataNormalization/normalizer';
import type { RawProgram, RepresentativeProgram } from '../services/programDataNormalization/types';

type CrawlPayload = { records: RawProgram[] };
type SourceVerification = {
  verifiedAt: string;
  summary: { total: number; matched: number; mismatched: number; fetchFailed: number };
  results: Array<{
    sourceId: number;
    liveUrl: string;
    status: 'MATCHED' | 'MISMATCH' | 'FETCH_FAILED';
    matches: Record<string, boolean> | null;
    live: Pick<RawProgram, 'title' | 'basicInfo' | 'detailText' | 'onlineApplicationStatus' | 'programContent' | 'noticeText' | 'attachments' | 'hasAttachments'> | null;
    error: string | null;
  }>;
};
type Criterion = { reason: string; matches: (record: RawProgram) => boolean; order?: (left: RawProgram, right: RawProgram) => number };

const compact = (value: string) => value.replace(/\s+/g, '');
const hasLeadingTag = (record: RawProgram) => record.title.trim().startsWith('[');
const defaultOrder = (left: RawProgram, right: RawProgram) => left.idx - right.idx;

const criteria: Criterion[] = [
  { reason: '테스트 제외 레코드', matches: (record) => record.idx === 4201 },
  { reason: '중학생 대상', matches: (record) => record.basicInfo['대상']?.startsWith('중학생 ') },
  { reason: '어르신 대상', matches: (record) => record.basicInfo['대상']?.startsWith('어르신 ') },
  { reason: '어린이 대상', matches: (record) => record.basicInfo['대상']?.startsWith('어린이 ') },
  { reason: '초등학생 대상', matches: (record) => record.basicInfo['대상']?.startsWith('초등학생 ') },
  { reason: '일반인 대상', matches: (record) => record.basicInfo['대상']?.startsWith('일반인 ') },
  { reason: '본문 없음 + 첨부 있음', matches: (record) => !record.detailText && record.hasAttachments },
  { reason: '본문 없음 + 첨부 없음', matches: (record) => !record.detailText && !record.hasAttachments },
  { reason: '가장 긴 본문', matches: (record) => Boolean(record.detailText), order: (left, right) => right.detailText.length - left.detailText.length || left.idx - right.idx },
  { reason: '수강료 무료 + 재료비 동시 표기', matches: (record) => /무료/.test(record.detailText) && /재\s*료\s*비/.test(record.detailText) },
  { reason: '수강료 금액 표기', matches: (record) => /수\s*강\s*료[^\n]*\d[\d,]*\s*원/.test(record.detailText) },
  { reason: '교재비 표기', matches: (record) => /교\s*재\s*비/.test(record.detailText) },
  { reason: '재료비 표기', matches: (record) => /재\s*료\s*비/.test(record.detailText) },
  { reason: '제목 앞 태그 없음', matches: (record) => !hasLeadingTag(record) && record.idx !== 4201 },
  { reason: '복합 교육시간', matches: (record) => /[,/·]|\s및\s/.test(record.basicInfo['교육시간'] ?? '') },
  { reason: '복수 강사', matches: (record) => /,/.test(record.basicInfo['강사'] ?? '') },
  { reason: '괄호가 포함된 강사', matches: (record) => /[（(][^)）]+[)）]/.test(record.basicInfo['강사'] ?? '') },
  { reason: '본문 있음 + 첨부 없음', matches: (record) => Boolean(record.detailText) && !record.hasAttachments },
  { reason: '최신 일반 레코드', matches: (record) => record.idx !== 4201, order: (left, right) => right.idx - left.idx },
  { reason: '가장 오래된 일반 레코드', matches: (record) => record.idx !== 4201 },
];

export function selectRepresentativePrograms(records: RawProgram[]) {
  const selected = new Set<number>();
  return criteria.map((criterion) => {
    const candidates = records.filter((record) => !selected.has(record.idx) && criterion.matches(record));
    candidates.sort(criterion.order ?? defaultOrder);
    const raw = candidates[0];
    if (!raw) throw new Error(`REPRESENTATIVE_NOT_FOUND: ${criterion.reason}`);
    selected.add(raw.idx);
    return { selectionReason: criterion.reason, raw, normalized: normalizeProgram(raw) } satisfies RepresentativeProgram;
  });
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function reviewHtml(items: RepresentativeProgram[], verification: SourceVerification | null) {
  const verificationById = new Map(verification?.results.map((result) => [result.sourceId, result]) ?? []);
  const cards = items.map((item, index) => {
    const source = verificationById.get(item.raw.idx);
    const liveContent = source?.live
      ? JSON.stringify(source.live, null, 2)
      : JSON.stringify({ status: source?.status ?? 'NOT_VERIFIED', error: source?.error ?? null }, null, 2);
    return `
    <article class="card" data-status="${item.normalized.normalizationStatus}">
      <header><span class="number">${index + 1}</span><div><strong>${escapeHtml(item.selectionReason)}</strong><h2>${escapeHtml(item.raw.title)}</h2><a href="${escapeHtml(source?.liveUrl ?? item.raw.url)}" target="_blank" rel="noreferrer">공공예약 원사이트 열기</a></div><span class="source-status">${source?.status ?? 'NOT_VERIFIED'}</span><span class="status">${item.normalized.normalizationStatus}</span></header>
      <div class="columns">
        <section><h3>공공예약 원사이트 스냅샷</h3><pre>${escapeHtml(liveContent)}</pre></section>
        <section><h3>크롤링 결과</h3><pre>${escapeHtml(JSON.stringify({ idx: item.raw.idx, url: item.raw.url, title: item.raw.title, basicInfo: item.raw.basicInfo, detailText: item.raw.detailText, attachments: item.raw.attachments }, null, 2))}</pre></section>
        <section><h3>정제 결과</h3><pre>${escapeHtml(JSON.stringify(item.normalized, null, 2))}</pre></section>
      </div>
    </article>`;
  }).join('\n');
  const verificationSummary = verification
    ? `원사이트 검증 ${verification.summary.matched}/${verification.summary.total} 일치 · 불일치 ${verification.summary.mismatched} · 조회 실패 ${verification.summary.fetchFailed}`
    : '원사이트 검증 결과 없음';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>프로그램 대표 20건 정제 검수</title><style>
  :root{font-family:system-ui,sans-serif;color:#172033;background:#f3f5f8}body{margin:0;padding:24px}.page{max-width:1900px;margin:auto}h1{margin:0}.summary{color:#526078;margin:8px 0 22px}.card{background:white;border:1px solid #dbe1ea;border-radius:12px;margin:16px 0;overflow:hidden;box-shadow:0 2px 8px #1720330d}.card header{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #e5e9f0}.card h2{font-size:16px;margin:3px 0}.card a{font-size:12px;color:#2f65d5}.number{background:#2f65d5;color:white;border-radius:999px;min-width:28px;height:28px;display:grid;place-items:center}.status,.source-status{padding:4px 8px;border-radius:6px;background:#eef2f8;font-size:12px}.source-status{margin-left:auto;background:#e8f6ee;color:#176b3a}.columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}.columns section{min-width:0;padding:16px}.columns section+section{border-left:1px solid #e5e9f0}h3{margin:0 0 10px;font-size:14px;color:#526078}pre{white-space:pre-wrap;overflow-wrap:anywhere;margin:0;font:12px/1.55 ui-monospace,monospace}@media(max-width:1100px){.columns{grid-template-columns:1fr}.columns section+section{border-left:0;border-top:1px solid #e5e9f0}}
  </style></head><body><main class="page"><h1>프로그램 대표 20건 정제 검수</h1><p class="summary">${escapeHtml(verificationSummary)}<br>공공예약 원사이트 스냅샷, 크롤링 결과, 정제 결과를 비교합니다. 전체 351건 정제는 실행하지 않았습니다.</p>${cards}</main></body></html>`;
}

async function main() {
  const [inputArg, outputArg, verificationArg] = process.argv.slice(2);
  if (!inputArg || !outputArg) throw new Error('Usage: <input-crawl-json> <output-directory>');
  const input = path.resolve(inputArg);
  const output = path.resolve(outputArg);
  const payload = JSON.parse(await readFile(input, 'utf8')) as CrawlPayload;
  const verification = verificationArg
    ? JSON.parse(await readFile(path.resolve(verificationArg), 'utf8')) as SourceVerification
    : null;
  const liveById = new Map(verification?.results.flatMap((result) => result.live ? [[result.sourceId, result.live] as const] : []) ?? []);
  const enrichedRecords = payload.records.map((record) => {
    const live = liveById.get(record.idx);
    return live ? { ...record, ...live } : record;
  });
  const selected = selectRepresentativePrograms(enrichedRecords);
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'representative-20.review.json'), `${JSON.stringify({ input: path.basename(input), count: selected.length, sourceVerification: verification, items: selected }, null, 2)}\n`);
  await writeFile(path.join(output, 'representative-20.review.html'), reviewHtml(selected, verification));
  console.log(JSON.stringify({ count: selected.length, ids: selected.map((item) => item.raw.idx), output }, null, 2));
}

if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
