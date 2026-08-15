import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { ProgramNoticeGroup, ProgramSection } from './program-prototype';

export type ReviewCurriculum = {
  session: number;
  date: string | null;
  activity: string;
  materialsOrNotes: string | null;
  category: string | null;
  teachingMethod: string | null;
  materials: string | null;
  notes: string | null;
  referenceBooks: string[];
  referenceImages: Array<{ filename: string; mimeType: string; src: string }>;
};

/** 배치 최종 분류. 검수 화면은 이 값으로 목록을 나눈다. */
export type ReviewStatus =
  | 'MANUAL_REVIEW_REQUIRED'
  | 'AUTO_REVIEW_CANDIDATE'
  | 'SINGLE_SESSION_EVENT'
  | 'OCR_REQUIRED'
  | 'OCR_BUDGET_EXCEEDED'
  | 'EXTRACTION_FAILED';

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  MANUAL_REVIEW_REQUIRED: '수동 검수 필요',
  AUTO_REVIEW_CANDIDATE: '자동 검토 후보',
  SINGLE_SESSION_EVENT: '단일 행사',
  OCR_REQUIRED: 'OCR 대기',
  OCR_BUDGET_EXCEEDED: 'OCR 상한 초과',
  EXTRACTION_FAILED: '추출 실패',
};

export type ProgramAttachmentReview = {
  sourceId: number;
  title: string;
  sourceUrl: string;
  originalBody: string;
  attachment: { name: string; url: string; detectedType: string } | null;
  selectedText: string;
  selectedPages: number[];
  confidence: number;
  matchReason: string;
  reviewStatus: ReviewStatus;
  lane: string;
  contentProfile: string;
  bodyPublishable: boolean;
  singleSessionEvent: boolean;
  ocrTargets: Array<{ name: string; url: string; reason: string }>;
  failure: { code: string; message: string; retryable: boolean } | null;
  basicInfo: Array<{ label: string; value: string }>;
  board: { sections: ProgramSection[]; intro: string[]; notices: ProgramNoticeGroup[]; unmappedLabels: string[] };
  curriculum: ReviewCurriculum[];
  extractionWarnings: Array<{ code: string; message: string }>;
  attachments: Array<{ name: string; url: string }>;
  audit: {
    added: Array<{ section: string; label: string; value: string }>;
    skippedDuplicates: Array<{ label: string; value: string }>;
    discardedNoise: Array<{ label: string; value: string; reason: string }>;
    warnings: Array<{ code: string; label: string; basicValue: string | null; attachmentValue: string }>;
  };
};

function backendLocal(...segments: string[]) {
  return [
    path.resolve(process.cwd(), 'apps', 'backend', '.local', ...segments),
    path.resolve(process.cwd(), '..', 'backend', '.local', ...segments),
  ];
}

async function readFirst<T>(candidates: string[]): Promise<T> {
  let lastError: unknown;
  for (const candidate of candidates) {
    try { return JSON.parse(await readFile(candidate, 'utf8')) as T; } catch (error) { lastError = error; }
  }
  throw lastError;
}

async function latestCrawl() {
  let lastError: unknown;
  for (const directory of backendLocal('geumjeong-small-library-crawl')) {
    try {
      const file = (await readdir(directory)).filter((name) => name.startsWith('geumjeong-small-library-programs-') && name.endsWith('.json')).sort().at(-1);
      if (file) return readFirst<{ records: Array<{ idx: number; detailText: string; programContent?: { text?: string } }> }>([path.join(directory, file)]);
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

async function readOptional<T>(candidates: string[]): Promise<T | null> {
  try { return await readFirst<T>(candidates); } catch { return null; }
}

/**
 * 검수 대상을 읽는다.
 *
 * 351건 배치 결과(`program-attachment-batch/full.json`)를 우선 사용하고,
 * 배치를 아직 돌리지 않은 환경에서는 대표 20건 산출물로 물러선다.
 * 첨부 추출문은 게시 데이터에 없으므로 `evidence.json`에서 따로 읽는다.
 */
export async function getProgramAttachmentReviews(): Promise<ProgramAttachmentReview[]> {
  const [crawl, batch, evidence, samples, merged] = await Promise.all([
    latestCrawl(),
    readOptional<{ items: Array<any> }>(backendLocal('program-attachment-batch', 'full.json')),
    readOptional<{ selectedText: Record<string, string> }>(backendLocal('program-attachment-batch', 'evidence.json')),
    readOptional<{ results: Array<any> }>(backendLocal('program-attachment-enrichment', 'samples.json')),
    readOptional<{ items: Array<any> }>(backendLocal('program-attachment-enrichment', 'merged-samples.json')),
  ]);
  const items = batch?.items ?? merged?.items ?? [];
  if (!items.length) throw new Error('검수할 정제 결과가 없습니다. program-attachment-batch:run 을 먼저 실행하세요.');

  const rawById = new Map(crawl.records.map((record) => [record.idx, record]));
  const sampleById = new Map((samples?.results ?? []).map((item) => [item.sourceId, item]));
  const imageRoots = batch ? ['program-attachment-batch', 'program-attachment-enrichment'] : ['program-attachment-enrichment'];

  return Promise.all(items.map(async (item) => {
    const sample = sampleById.get(item.sourceId);
    const raw = rawById.get(item.sourceId);
    const attachmentEvidence = item.attachmentEvidence ?? null;
    return {
      sourceId: item.sourceId,
      title: item.title,
      sourceUrl: item.sourceUrl ?? sample?.sourceUrl ?? '',
      originalBody: raw?.programContent?.text ?? raw?.detailText ?? '',
      attachment: attachmentEvidence
        ? {
          name: attachmentEvidence.name ?? sample?.attachment?.name ?? '첨부파일',
          url: attachmentEvidence.url ?? '',
          detectedType: item.detectedType ?? sample?.detectedType ?? 'UNKNOWN',
        }
        : null,
      selectedText: evidence?.selectedText?.[String(item.sourceId)] ?? sample?.match?.selectedText ?? '',
      selectedPages: attachmentEvidence?.selectedPages ?? [],
      confidence: attachmentEvidence?.confidence ?? 0,
      matchReason: attachmentEvidence?.reason ?? '',
      reviewStatus: item.reviewStatus as ReviewStatus,
      lane: item.lane ?? 'DOC_EXTRACT',
      contentProfile: item.contentProfile ?? '',
      bodyPublishable: item.bodyPublishable ?? true,
      singleSessionEvent: item.singleSessionEvent ?? false,
      ocrTargets: item.ocrTargets ?? [],
      failure: item.failure ?? null,
      basicInfo: item.basicInfo ?? [],
      board: item.board,
      curriculum: await Promise.all((item.curriculum ?? []).map(async (session: any) => ({
        ...session,
        category: session.category ?? null,
        teachingMethod: session.teachingMethod ?? null,
        materials: session.materials ?? session.materialsOrNotes ?? null,
        notes: session.notes ?? null,
        referenceBooks: session.referenceBooks ?? [],
        referenceImages: await Promise.all((session.referenceImages ?? []).map(async (image: { filename: string; mimeType: string }) => {
          const candidates = imageRoots.flatMap((root) => backendLocal(root, 'embedded-images', String(item.sourceId), image.filename));
          let data: Buffer | null = null;
          for (const candidate of candidates) {
            try { data = await readFile(candidate); break; } catch { /* 다음 로컬 경로 확인 */ }
          }
          return { ...image, src: data ? `data:${image.mimeType};base64,${data.toString('base64')}` : '' };
        })),
      }))),
      extractionWarnings: item.extractionWarnings ?? [],
      attachments: item.attachments ?? [attachmentEvidence].filter((attachment) => attachment?.url),
      audit: item.mergeAudit,
    };
  }));
}

export async function getProgramAttachmentReview(sourceId: number) {
  return (await getProgramAttachmentReviews()).find((item) => item.sourceId === sourceId) ?? null;
}
