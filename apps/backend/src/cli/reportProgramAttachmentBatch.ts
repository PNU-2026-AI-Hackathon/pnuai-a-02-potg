import fs from 'fs';
import path from 'path';
import { summarize } from './runProgramAttachmentBatch';

const DEFAULT_DIR = path.resolve(process.cwd(), '.local', 'program-attachment-batch');

/**
 * 배치 결과를 상태별 산출물로 나눈다.
 *
 * 사람이 실제로 열어보는 파일은 `manual-review.json`과 `failures.json`이고,
 * `ocr-queue.json`은 비용 정책이 확정되기 전까지 대기 목록으로만 쓴다.
 */
export function splitBatch(items: any[]) {
  const ocrItems = items.filter((item) => item.reviewStatus === 'OCR_REQUIRED');
  const ocrFiles = new Map<string, { url: string; name: string; sourceIds: number[] }>();
  for (const item of ocrItems) {
    for (const target of item.ocrTargets ?? []) {
      const existing = ocrFiles.get(target.url);
      if (existing) existing.sourceIds.push(item.sourceId);
      else ocrFiles.set(target.url, { url: target.url, name: target.name, sourceIds: [item.sourceId] });
    }
  }

  return {
    autoReview: items.filter((item) => item.reviewStatus === 'AUTO_REVIEW_CANDIDATE'),
    // 회차표가 애초에 없는 하루짜리 행사. 회차 0건이 정상이므로 검수 대상이 아니다.
    singleSessionEvents: items.filter((item) => item.reviewStatus === 'SINGLE_SESSION_EVENT'),
    manualReview: items.filter((item) => item.reviewStatus === 'MANUAL_REVIEW_REQUIRED')
      .map((item) => ({
        sourceId: item.sourceId,
        title: item.title,
        sourceUrl: item.sourceUrl,
        lane: item.lane,
        extractionRoute: item.extractionRoute,
        reasons: item.mergeAudit.warnings,
        extractionWarnings: item.extractionWarnings,
        attachmentEvidence: item.attachmentEvidence,
      })),
    ocrQueue: {
      records: ocrItems.map((item) => ({
        sourceId: item.sourceId,
        title: item.title,
        sourceUrl: item.sourceUrl,
        contentProfile: item.contentProfile,
        textReadiness: item.textReadiness,
        hasBodyText: item.lane !== 'NO_TEXT_IMAGE_ONLY',
        // 본문만으로 먼저 게시할 수 있는 레코드. OCR로 회차를 보완하기 전까지 정제 완료가 아니다.
        bodyPublishable: item.bodyPublishable,
        targets: item.ocrTargets,
      })),
      // 같은 포스터가 여러 회차 레코드에 붙어 있으므로 파일 단위로 접으면 OCR 호출량이 줄어든다.
      uniqueFiles: [...ocrFiles.values()].sort((a, b) => b.sourceIds.length - a.sourceIds.length),
    },
    failures: items.filter((item) => item.reviewStatus === 'EXTRACTION_FAILED')
      .map((item) => ({
        sourceId: item.sourceId,
        title: item.title,
        sourceUrl: item.sourceUrl,
        extractionRoute: item.extractionRoute,
        attachment: item.attachmentEvidence,
        failure: item.failure,
      })),
  };
}

export async function main(args = process.argv.slice(2)) {
  const dirIndex = args.indexOf('--dir');
  const dir = dirIndex >= 0 ? path.resolve(args[dirIndex + 1]) : DEFAULT_DIR;
  const fullPath = path.join(dir, 'full.json');
  if (!fs.existsSync(fullPath)) {
    throw new Error(`배치 결과가 없습니다: ${fullPath} (program-attachment-batch:run 을 먼저 실행하세요)`);
  }
  const batch = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as { items: any[]; sourceCrawlFile: string };
  const split = splitBatch(batch.items);
  const summary = summarize(batch.items);

  const stats = {
    schemaVersion: 'program-attachment-batch-stats/v1',
    generatedAt: new Date().toISOString(),
    sourceCrawlFile: batch.sourceCrawlFile,
    total: batch.items.length,
    ...summary,
    documentLaneSuccessRate: rate(
      batch.items.filter((item) => item.lane === 'DOC_EXTRACT' && item.reviewStatus !== 'EXTRACTION_FAILED').length,
      batch.items.filter((item) => item.lane === 'DOC_EXTRACT').length,
    ),
    humanReviewLoad: {
      manualReviewRecords: split.manualReview.length,
      failureRecords: split.failures.length,
      singleSessionEventRecords: split.singleSessionEvents.length,
      totalRecordsNeedingPerson: split.manualReview.length + split.failures.length,
      averageReasonsPerManualRecord: split.manualReview.length
        ? Number((split.manualReview.reduce((sum, item) => sum + item.reasons.length, 0) / split.manualReview.length).toFixed(2))
        : 0,
    },
    ocrQueue: {
      records: split.ocrQueue.records.length,
      uniqueFiles: split.ocrQueue.uniqueFiles.length,
      recordsWithBodyText: split.ocrQueue.records.filter((item) => item.hasBodyText).length,
      recordsWithoutBodyText: split.ocrQueue.records.filter((item) => !item.hasBodyText).length,
    },
  };

  const written: Record<string, number> = {};
  const write = (name: string, payload: unknown, count: number) => {
    fs.writeFileSync(path.join(dir, name), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    written[name] = count;
  };
  write('auto-review.json', { count: split.autoReview.length, items: split.autoReview }, split.autoReview.length);
  write('single-session-events.json',
    { count: split.singleSessionEvents.length, items: split.singleSessionEvents }, split.singleSessionEvents.length);
  write('manual-review.json', { count: split.manualReview.length, items: split.manualReview }, split.manualReview.length);
  write('ocr-queue.json', { policy: { ocrInvoked: false }, ...split.ocrQueue }, split.ocrQueue.records.length);
  write('failures.json', { count: split.failures.length, items: split.failures }, split.failures.length);
  write('stats.json', stats, batch.items.length);

  console.log(JSON.stringify({ dir, written, stats }, null, 2));
  return { stats, split };
}

function rate(numerator: number, denominator: number) {
  return denominator ? Number(((numerator / denominator) * 100).toFixed(1)) : null;
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
