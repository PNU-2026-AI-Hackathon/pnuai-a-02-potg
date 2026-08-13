import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { ProgramNoticeGroup, ProgramSection } from './program-prototype';

export type ReviewCurriculum = {
  session: number;
  date: string | null;
  activity: string;
  materialsOrNotes: string | null;
};

export type ProgramAttachmentReview = {
  sourceId: number;
  title: string;
  sourceUrl: string;
  originalBody: string;
  attachment: { name: string; url: string; detectedType: string };
  selectedText: string;
  selectedPages: number[];
  confidence: number;
  matchReason: string;
  reviewStatus: string;
  basicInfo: Array<{ label: string; value: string }>;
  board: { sections: ProgramSection[]; intro: string[]; notices: ProgramNoticeGroup[]; unmappedLabels: string[] };
  curriculum: ReviewCurriculum[];
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

export async function getProgramAttachmentReviews(): Promise<ProgramAttachmentReview[]> {
  const [crawl, enrichment, merged] = await Promise.all([
    latestCrawl(),
    readFirst<{ results: Array<any> }>(backendLocal('program-attachment-enrichment', 'samples.json')),
    readFirst<{ items: Array<any> }>(backendLocal('program-attachment-enrichment', 'merged-samples.json')),
  ]);
  const rawById = new Map(crawl.records.map((record) => [record.idx, record]));
  const enrichmentById = new Map(enrichment.results.map((item) => [item.sourceId, item]));
  return merged.items.map((item) => {
    const source = enrichmentById.get(item.sourceId);
    const raw = rawById.get(item.sourceId);
    return {
      sourceId: item.sourceId,
      title: item.title,
      sourceUrl: source?.sourceUrl ?? '',
      originalBody: raw?.programContent?.text ?? raw?.detailText ?? '',
      attachment: { name: source?.attachment?.name ?? '첨부파일', url: source?.attachment?.url ?? '', detectedType: source?.detectedType ?? 'UNKNOWN' },
      selectedText: source?.match?.selectedText ?? '',
      selectedPages: item.attachmentEvidence.selectedPages,
      confidence: item.attachmentEvidence.confidence,
      matchReason: item.attachmentEvidence.reason,
      reviewStatus: item.reviewStatus,
      basicInfo: item.basicInfo ?? [],
      board: item.board,
      curriculum: item.curriculum,
      attachments: item.attachments ?? [item.attachmentEvidence].filter((attachment) => attachment?.url),
      audit: item.mergeAudit,
    };
  });
}

export async function getProgramAttachmentReview(sourceId: number) {
  return (await getProgramAttachmentReviews()).find((item) => item.sourceId === sourceId) ?? null;
}
