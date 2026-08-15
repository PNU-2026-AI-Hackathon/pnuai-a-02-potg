import fs from 'fs';
import path from 'path';
import { normalizeProgram } from '../services/programDataNormalization/normalizer';
import type { RawProgram } from '../services/programDataNormalization/types';
import { combinedBasicInfo, mergeProgramAttachment } from '../services/programAttachmentEnrichment/mergeProgramAttachment';
import { processSample, type InventoryAttachment, type InventoryItem } from './buildProgramAttachmentEnrichmentSamples';

const DEFAULT_CRAWL_DIR = path.resolve(process.cwd(), '.local', 'geumjeong-small-library-crawl');
const DEFAULT_INVENTORY = path.resolve(process.cwd(), '.local', 'program-attachment-inventory', 'inventory-all.json');
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), '.local', 'program-attachment-batch');

const DOCUMENT_ROUTES = ['HWP_TEXT', 'HWPX_TEXT', 'PDF_CLASSIFY'];

/**
 * 레코드가 실제로 어느 처리 경로를 타는지.
 *
 * 인벤토리의 `extractionRoutes`는 첨부 확장자별 목록이라 한 레코드에 여러 값이 섞인다.
 * 배치는 레코드 단위로 하나의 경로를 정해야 하므로 별도로 판정한다.
 */
export type BatchLane = 'TEXT_ONLY' | 'DOC_EXTRACT' | 'TEXT_WITH_IMAGE' | 'NO_TEXT_IMAGE_ONLY';

/** 배치 최종 분류. `AUTO_REVIEW_CANDIDATE`는 자동 게시 승인이 아니라 사람이 대조할 수 있는 상태다. */
export type BatchStatus =
  | 'AUTO_REVIEW_CANDIDATE'
  | 'MANUAL_REVIEW_REQUIRED'
  | 'SINGLE_SESSION_EVENT'
  | 'OCR_REQUIRED'
  // OCR 호출 상한에 걸려 이번 배치에서 처리하지 못한 상태. 상한을 올리면 다시 대상이 된다.
  | 'OCR_BUDGET_EXCEEDED'
  | 'EXTRACTION_FAILED';

/**
 * 회차 없이 하루로 끝나는 행사인지.
 *
 * 작가와의 만남·콘서트·20분 체험처럼 애초에 회차표가 없는 프로그램을 회차 추출 실패와 구분한다.
 * 교육 시작일과 종료일이 같은 하루짜리인 것이 유일한 확정 근거이고,
 * 본문이나 첨부가 `N회차`를 언급하면 하루로 보이더라도 단일 행사로 보지 않는다.
 *
 * 원본이 시간대별로 쪼개져 등록됐으면 쪼개진 그대로 각각의 레코드로 유지한다.
 */
export function isSingleSessionEvent(program: { programStartDate: string | null; programEndDate: string | null }, boardText: string) {
  if (!program.programStartDate || program.programStartDate !== program.programEndDate) return false;
  return !/\d+\s*(?:회차|차시)/.test(boardText);
}

type BatchInventoryItem = InventoryItem & {
  contentProfile: string;
  textReadiness: string;
  attachmentCount: number;
  inlineImageCount: number;
};

export function laneOf(item: Pick<BatchInventoryItem, 'contentProfile' | 'attachments'>): BatchLane {
  const hasDocument = item.attachments.some(
    (attachment) => attachment.source === 'attachment' && DOCUMENT_ROUTES.includes(attachment.route),
  );
  if (hasDocument) return 'DOC_EXTRACT';
  if (item.contentProfile === 'text_only') return 'TEXT_ONLY';
  if (item.contentProfile === 'text_with_supplement') return 'TEXT_WITH_IMAGE';
  return 'NO_TEXT_IMAGE_ONLY';
}

function documentAttachmentOf(item: BatchInventoryItem): InventoryAttachment | null {
  return item.attachments.find(
    (attachment) => attachment.source === 'attachment' && DOCUMENT_ROUTES.includes(attachment.route),
  ) ?? null;
}

function latestCrawlFile(dir: string) {
  const files = fs.readdirSync(dir)
    .filter((name) => name.startsWith('geumjeong-small-library-programs-') && name.endsWith('.json'))
    .sort();
  if (!files.length) throw new Error(`크롤링 결과가 없습니다: ${dir}`);
  return path.join(dir, files[files.length - 1]);
}

function argumentOf(args: string[], name: string, fallback: string) {
  const index = args.indexOf(name);
  return index >= 0 ? path.resolve(args[index + 1]) : fallback;
}

function numberOption(args: string[], name: string, fallback: number, min: number, max: number) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name}은 ${min}~${max} 정수여야 합니다.`);
  }
  return value;
}

/**
 * 첨부를 열지 않는 경로의 공통 결과. 본문 정제 결과는 그대로 사용하고
 * 첨부는 확인하지 않았음을 상태로 남긴다.
 */
function bodyOnlyItem(raw: RawProgram, item: BatchInventoryItem, lane: BatchLane, status: BatchStatus) {
  const normalized = normalizeProgram(raw);
  const ocrTargets = lane === 'TEXT_ONLY'
    ? []
    : item.attachments.map((attachment) => ({
      name: attachment.name,
      url: attachment.url,
      source: attachment.source,
      reason: '텍스트 레이어가 없는 이미지 첨부이므로 OCR 없이는 내용을 추출할 수 없다',
    }));
  return {
    schemaVersion: 'program-board-attachment-merge/v1',
    sourceId: normalized.sourceId,
    sourceUrl: normalized.sourceUrl,
    title: normalized.title,
    contentProfile: item.contentProfile,
    lane,
    extractionRoute: lane === 'TEXT_ONLY' ? 'TEXT_ONLY' : 'IMAGE_OCR',
    textReadiness: item.textReadiness,
    attachmentReviewStatus: lane === 'TEXT_ONLY' ? null : 'ATTACHMENT_UNCHECKED',
    reviewStatus: status,
    // 본문만으로 화면을 구성할 수 있는지. `true`라도 첨부 확인이 끝난 것은 아니므로
    // 정제 완료가 아니며, OCR 이후 회차 정보로 보완해야 한다.
    bodyPublishable: lane !== 'NO_TEXT_IMAGE_ONLY',
    singleSessionEvent: false,
    basicInfo: combinedBasicInfo(normalized, []),
    board: normalized.board,
    curriculum: [],
    attachmentEvidence: null,
    attachments: normalized.attachments,
    ocrTargets,
    extractionWarnings: [],
    mergeAudit: { added: [], skippedDuplicates: [], discardedNoise: [], warnings: [] },
    failure: null,
  };
}

async function processDocumentRecord(
  raw: RawProgram,
  item: BatchInventoryItem,
  knownProgramTitles: string[],
  embeddedImageRoot: string,
  alternateUrlsOf: (attachment: InventoryAttachment) => string[],
) {
  const attachment = documentAttachmentOf(item);
  if (!attachment) throw new Error(`문서 첨부가 없습니다: ${item.sourceId}`);
  const normalized = normalizeProgram(raw);
  const sample = await processSample(
    { item, attachment },
    knownProgramTitles,
    embeddedImageRoot,
    alternateUrlsOf(attachment),
  );

  const failure = 'failure' in sample ? sample.failure : null;
  const structured = ('structured' in sample ? sample.structured : null)
    ?? { labeled: [], curriculum: [], extractionWarnings: [] };
  const match = ('match' in sample ? sample.match : null)
    ?? { status: 'FAILED', selectedPages: [], score: 0, reason: failure?.message ?? '첨부 추출 실패' };

  const merged = mergeProgramAttachment({
    program: normalized,
    attachment: { name: attachment.name, url: attachment.url },
    match,
    structured,
  });

  // 구간은 찾았는데 회차가 한 행도 안 나온 경우. 회차표가 원래 없는 단일 행사와
  // 표를 못 읽은 경우가 섞이므로, 하루짜리 행사가 아니면 사람이 원본을 봐야 한다.
  const sectionFound = ['WHOLE_DOCUMENT', 'SECTION_MATCHED'].includes(match.status);
  const singleSession = isSingleSessionEvent(normalized, JSON.stringify(merged.board));
  const curriculumMissing = !failure && merged.curriculum.length === 0 && !singleSession;
  // 장마다 회차 번호를 1부터 다시 매긴 계획서가 있다. 번호가 겹치면 순서를 믿을 수 없다.
  const duplicatedSessions = merged.curriculum.length > 0
    && new Set(merged.curriculum.map((session: { session: number }) => session.session)).size !== merged.curriculum.length;
  const extractionWarnings = [
    ...merged.extractionWarnings,
    ...(curriculumMissing ? [{
      code: 'CURRICULUM_NOT_EXTRACTED',
      message: sectionFound
        ? `첨부 구간은 찾았으나(${match.status}) 회차를 한 행도 추출하지 못했다. 원본 표를 확인해야 한다.`
        : '첨부에서 프로그램 구간을 찾지 못해 회차를 추출하지 못했다. 원본을 확인해야 한다.',
    }] : []),
    ...(duplicatedSessions ? [{
      code: 'CURRICULUM_SESSION_DUPLICATED',
      message: '회차 번호가 중복된다. 장마다 번호를 다시 매긴 문서일 수 있어 순서를 확인해야 한다.',
    }] : []),
  ];

  const status: BatchStatus = failure ? statusOfFailure(failure.code)
    : singleSession && merged.curriculum.length === 0 ? 'SINGLE_SESSION_EVENT'
      : curriculumMissing || duplicatedSessions || merged.reviewStatus === 'MANUAL_REVIEW_REQUIRED' ? 'MANUAL_REVIEW_REQUIRED'
        : 'AUTO_REVIEW_CANDIDATE';

  return {
    ...merged,
    extractionWarnings,
    singleSessionEvent: singleSession,
    bodyPublishable: true,
    sourceUrl: item.sourceUrl,
    contentProfile: item.contentProfile,
    lane: 'DOC_EXTRACT' as const,
    extractionRoute: attachment.route,
    textReadiness: item.textReadiness,
    attachmentReviewStatus: failure ? 'MANUAL_REVIEW_REQUIRED' : 'ATTACHMENT_ENRICHED',
    reviewStatus: status,
    ocrTargets: status === 'OCR_REQUIRED'
      ? [{
        name: attachment.name,
        url: attachment.url,
        source: attachment.source,
        reason: '텍스트 레이어가 없는 스캔 문서이므로 OCR 없이는 내용을 추출할 수 없다',
      }]
      : [],
    detectedType: 'detectedType' in sample ? sample.detectedType : null,
    checksumSha256: 'checksumSha256' in sample ? sample.checksumSha256 : null,
    failure: failure ? { ...failure, retryable: isRetryable(failure.code) } : null,
    // 검수 화면에서 원본과 대조할 추출문. 게시 데이터에는 넣지 않고 별도 근거 파일로 분리한다.
    selectedText: 'selectedText' in match ? match.selectedText : '',
  };
}

/**
 * 스캔 PDF는 추출기가 `OCR_REQUIRED`로 실패를 알린다. 이것은 파이프라인 결함이 아니라
 * OCR 정책이 확정되어야 진행 가능한 상태이므로 실패가 아닌 별도 큐로 보낸다.
 */
export function statusOfFailure(code: string): BatchStatus {
  return code === 'OCR_REQUIRED' ? 'OCR_REQUIRED' : 'EXTRACTION_FAILED';
}

/**
 * 네트워크·일시 오류만 재시도 대상으로 본다.
 * 형식 미지원, 구간 미발견, 파싱 실패는 재실행해도 같은 결과가 나온다.
 */
export function isRetryable(code: string) {
  return ['DOWNLOAD_TIMEOUT', 'DOWNLOAD_FAILED', 'REDIRECT_LIMIT_EXCEEDED', 'PDF_RENDER_TIMEOUT'].includes(code);
}

export async function runBatch(options: {
  records: RawProgram[];
  inventoryItems: BatchInventoryItem[];
  lanes: BatchLane[];
  /** DOC_EXTRACT 안에서 HWP만 또는 PDF만 돌릴 때 사용한다. null이면 문서 경로 전체. */
  documentRoutes: string[] | null;
  limit: number | null;
  sourceIds: number[] | null;
  embeddedImageRoot: string;
  previous: Map<number, any>;
  retryFailedOnly: boolean;
  onProgress?: (done: number, total: number, sourceId: number) => void;
}) {
  const recordById = new Map(options.records.map((record) => [record.idx, record]));
  const knownProgramTitles = options.inventoryItems.map((item) => item.title);
  const allAttachments = options.inventoryItems.flatMap((item) => item.attachments);
  const alternateUrlsOf = (attachment: InventoryAttachment) => {
    const normalizedName = attachment.name.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
    return [...new Set(allAttachments
      .filter((candidate) => candidate.url !== attachment.url
        && candidate.name.normalize('NFKC').toLowerCase().replace(/\s+/g, '') === normalizedName)
      .map((candidate) => candidate.url))];
  };

  let targets = options.inventoryItems.filter((item) => options.lanes.includes(laneOf(item)));
  if (options.documentRoutes) {
    targets = targets.filter((item) => laneOf(item) !== 'DOC_EXTRACT'
      || options.documentRoutes!.includes(documentAttachmentOf(item)?.route ?? ''));
  }
  if (options.sourceIds) targets = targets.filter((item) => options.sourceIds!.includes(item.sourceId));
  if (options.retryFailedOnly) {
    targets = targets.filter((item) => options.previous.get(item.sourceId)?.failure?.retryable === true);
  }
  if (options.limit != null) targets = targets.slice(0, options.limit);

  const items: any[] = [];
  let done = 0;
  for (const item of targets) {
    const raw = recordById.get(item.sourceId);
    if (!raw) throw new Error(`크롤링 원본에서 sourceId를 찾을 수 없습니다: ${item.sourceId}`);
    const lane = laneOf(item);
    if (lane === 'DOC_EXTRACT') {
      items.push(await processDocumentRecord(raw, item, knownProgramTitles, options.embeddedImageRoot, alternateUrlsOf));
    } else if (lane === 'TEXT_ONLY') {
      items.push(bodyOnlyItem(raw, item, lane, 'AUTO_REVIEW_CANDIDATE'));
    } else {
      items.push(bodyOnlyItem(raw, item, lane, 'OCR_REQUIRED'));
    }
    options.onProgress?.(++done, targets.length, item.sourceId);
  }
  return items;
}

function countBy<T>(rows: T[], pick: (row: T) => string | null | undefined) {
  const result: Record<string, number> = {};
  for (const row of rows) {
    const key = pick(row);
    if (key) result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

export function summarize(items: any[]) {
  return {
    byLane: countBy(items, (item) => item.lane),
    byProfile: countBy(items, (item) => item.contentProfile),
    byRoute: countBy(items, (item) => item.extractionRoute),
    byStatus: countBy(items, (item) => item.reviewStatus),
    curriculumPrograms: items.filter((item) => item.curriculum.length > 0).length,
    curriculumSessions: items.reduce((sum, item) => sum + item.curriculum.length, 0),
    addedItems: items.reduce((sum, item) => sum + item.mergeAudit.added.length, 0),
    skippedDuplicates: items.reduce((sum, item) => sum + item.mergeAudit.skippedDuplicates.length, 0),
    discardedNoise: items.reduce((sum, item) => sum + item.mergeAudit.discardedNoise.length, 0),
    conflicts: items.reduce((sum, item) => sum + item.mergeAudit.warnings.length, 0),
    manualReviewReasons: countBy(
      items.filter((item) => item.reviewStatus === 'MANUAL_REVIEW_REQUIRED')
        .flatMap((item) => [...item.mergeAudit.warnings, ...item.extractionWarnings]),
      (warning: any) => warning.code,
    ),
    failureReasons: countBy(items, (item) => item.failure?.code),
    singleSessionEvents: items.filter((item) => item.reviewStatus === 'SINGLE_SESSION_EVENT').length,
    ocrQueueRecords: items.filter((item) => item.reviewStatus === 'OCR_REQUIRED').length,
    ocrQueueUniqueFiles: new Set(items.flatMap((item) => item.ocrTargets.map((target: any) => target.url))).size,
    // 본문만으로 화면을 구성할 수 있는 레코드. 첨부 확인이 끝났다는 뜻은 아니다.
    bodyPublishableRecords: items.filter((item) => item.bodyPublishable).length,
    attachmentUncheckedRecords: items.filter((item) => item.attachmentReviewStatus === 'ATTACHMENT_UNCHECKED').length,
  };
}

export async function main(args = process.argv.slice(2)) {
  const crawl = argumentOf(args, '--crawl', latestCrawlFile(DEFAULT_CRAWL_DIR));
  const inventoryPath = argumentOf(args, '--inventory', DEFAULT_INVENTORY);
  const outDir = argumentOf(args, '--out', DEFAULT_OUT_DIR);
  const limit = args.includes('--limit') ? numberOption(args, '--limit', 0, 1, 351) : null;
  const routeIndex = args.indexOf('--route');
  const sourceIdIndex = args.indexOf('--source-id');
  const resume = args.includes('--resume');
  const retryFailedOnly = args.includes('--retry-failed');

  const laneByRoute: Record<string, BatchLane> = {
    TEXT_ONLY: 'TEXT_ONLY',
    HWP_TEXT: 'DOC_EXTRACT',
    HWPX_TEXT: 'DOC_EXTRACT',
    PDF_CLASSIFY: 'DOC_EXTRACT',
    IMAGE_OCR: 'TEXT_WITH_IMAGE',
  };
  let lanes: BatchLane[] = ['TEXT_ONLY', 'DOC_EXTRACT', 'TEXT_WITH_IMAGE', 'NO_TEXT_IMAGE_ONLY'];
  let documentRoutes: string[] | null = null;
  if (routeIndex >= 0) {
    const route = args[routeIndex + 1];
    const lane = laneByRoute[route];
    if (!lane) throw new Error(`알 수 없는 경로: ${route} (${Object.keys(laneByRoute).join(' | ')})`);
    lanes = lane === 'TEXT_WITH_IMAGE' ? ['TEXT_WITH_IMAGE', 'NO_TEXT_IMAGE_ONLY'] : [lane];
    if (lane === 'DOC_EXTRACT') documentRoutes = [route];
  }
  const sourceIds = sourceIdIndex >= 0
    ? args.slice(sourceIdIndex + 1).filter((value) => /^\d+$/.test(value)).map(Number)
    : null;

  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8')) as {
    profile: string; items: BatchInventoryItem[]; input?: string;
  };
  if (inventory.profile !== 'all') {
    throw new Error('전체 배치는 --profile all 인벤토리가 필요합니다. program-attachment-inventory:build -- --profile all 을 먼저 실행하세요.');
  }
  const records = (JSON.parse(fs.readFileSync(crawl, 'utf8')) as { records: RawProgram[] }).records;

  const outputPath = path.join(outDir, 'full.json');
  // 경로별로 나눠 실행하는 것이 기본 운영 방식이므로 이전 결과는 항상 이어받는다.
  // `--resume`은 누적 여부가 아니라 "이미 끝난 레코드를 다시 처리할지"만 결정한다.
  const previousItems: any[] = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, 'utf8')).items ?? []
    : [];
  const previous = new Map<number, any>(previousItems.map((item) => [item.sourceId, item]));

  let inventoryItems = inventory.items;
  if (resume && !retryFailedOnly) {
    inventoryItems = inventoryItems.filter((item) => {
      const done = previous.get(item.sourceId);
      return !done || done.reviewStatus === 'EXTRACTION_FAILED';
    });
  }

  const started = Date.now();
  const produced = await runBatch({
    records,
    inventoryItems,
    lanes,
    documentRoutes,
    limit,
    sourceIds,
    embeddedImageRoot: path.join(outDir, 'embedded-images'),
    previous,
    retryFailedOnly,
    onProgress: (done, total, sourceId) => {
      if (done % 10 === 0 || done === total) console.error(`  진행 ${done}/${total} (최근 ${sourceId})`);
    },
  });

  const merged = new Map<number, any>(previous);
  for (const item of produced) merged.set(item.sourceId, item);
  const withEvidence = [...merged.values()].sort((a, b) => a.sourceId - b.sourceId);

  // 첨부 추출문은 게시 데이터에서 떼어내 검수 근거 파일에만 보존한다.
  const evidencePath = path.join(outDir, 'evidence.json');
  const previousEvidence: Record<string, string> = fs.existsSync(evidencePath)
    ? JSON.parse(fs.readFileSync(evidencePath, 'utf8')).selectedText ?? {}
    : {};
  const items = withEvidence.map(({ selectedText, ...item }) => {
    if (typeof selectedText === 'string' && selectedText) previousEvidence[item.sourceId] = selectedText.slice(0, 10_000);
    return item;
  });

  const report = {
    schemaVersion: 'program-board-attachment-batch/v1',
    generatedAt: new Date().toISOString(),
    sourceCrawlFile: path.basename(crawl),
    policy: { ocrInvoked: false, llmInvoked: false, lanes, limit, resume, retryFailedOnly },
    elapsedMs: Date.now() - started,
    count: items.length,
    processedThisRun: produced.length,
    summary: summarize(items),
    items,
  };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(evidencePath, `${JSON.stringify({
    schemaVersion: 'program-attachment-batch-evidence/v1',
    note: '검수 화면 대조용 첨부 추출문. 게시 데이터에 넣지 않는다.',
    selectedText: previousEvidence,
  }, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    output: outputPath,
    count: report.count,
    processedThisRun: report.processedThisRun,
    summary: report.summary,
  }, null, 2));
  return report;
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
