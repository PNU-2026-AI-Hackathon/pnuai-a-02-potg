import fs from 'fs';
import path from 'path';
import { contentProfileOf } from './buildProgramBoardData';
import { normalizeProgram } from '../services/programDataNormalization/normalizer';
import type { NormalizedProgram, RawAttachment, RawProgram } from '../services/programDataNormalization/types';

const DEFAULT_CRAWL_DIR = path.resolve(process.cwd(), '.local', 'geumjeong-small-library-crawl');
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), '.local', 'program-attachment-inventory');

export type TextReadiness = 'TEXT_READY' | 'TEXT_PARTIAL' | 'TEXT_INSUFFICIENT';
export type ExtractionRoute = 'HWP_TEXT' | 'HWPX_TEXT' | 'PDF_CLASSIFY' | 'IMAGE_OCR' | 'UNKNOWN_REVIEW';

/**
 * 인벤토리 대상 범위.
 *
 * `text_with_supplement`는 #145까지의 기본값이며 첨부 보강이 필요한 레코드만 담는다.
 * `all`은 전체 351건 배치를 위해 텍스트 전용·이미지 전용·첨부 전용·빈 레코드까지 포함한다.
 */
export type InventoryProfile = 'text_with_supplement' | 'all';

/** 첨부가 없어 본문 정제 결과만 사용하는 레코드의 경로. 첨부 확장자 판별과는 무관하다. */
export const TEXT_ONLY_ROUTE = 'TEXT_ONLY';

type InventoryAttachment = RawAttachment & {
  extension: string | null;
  route: ExtractionRoute;
  source: 'attachment' | 'inline_image';
};

function latestCrawlFile(dir: string) {
  const files = fs.readdirSync(dir)
    .filter((name) => name.startsWith('geumjeong-small-library-programs-') && name.endsWith('.json'))
    .sort();
  if (!files.length) throw new Error(`크롤링 결과가 없습니다: ${dir}`);
  return path.join(dir, files[files.length - 1]);
}

function extensionOf(name: string, url: string) {
  for (const value of [name, url]) {
    try {
      const pathname = value === url ? new URL(value).pathname : value;
      const extension = path.extname(pathname).toLowerCase();
      if (extension) return extension;
    } catch {
      const extension = path.extname(value).toLowerCase();
      if (extension) return extension;
    }
  }
  return null;
}

export function extractionRouteOf(extension: string | null): ExtractionRoute {
  if (extension === '.hwp') return 'HWP_TEXT';
  if (extension === '.hwpx') return 'HWPX_TEXT';
  if (extension === '.pdf') return 'PDF_CLASSIFY';
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff'].includes(extension ?? '')) return 'IMAGE_OCR';
  return 'UNKNOWN_REVIEW';
}

function meaningfulContentCount(normalized: NormalizedProgram) {
  return normalized.board.intro.length
    + normalized.board.sections.reduce((sum, section) => sum + section.items.length, 0)
    + normalized.programContent.tables.length;
}

export function textReadinessOf(normalized: NormalizedProgram): TextReadiness {
  const coreFields = [
    normalized.targetDetail ?? normalized.targetGroup,
    normalized.programStartDate,
    normalized.scheduleText,
    normalized.capacity,
  ].filter((value) => value !== null && value !== undefined && value !== '').length;
  const contentCount = meaningfulContentCount(normalized);
  if (coreFields >= 3 && contentCount > 0) return 'TEXT_READY';
  if (coreFields >= 2 || contentCount > 0) return 'TEXT_PARTIAL';
  return 'TEXT_INSUFFICIENT';
}

function attachmentRows(raw: RawProgram): InventoryAttachment[] {
  const attachments = raw.attachments.map((attachment) => {
    const extension = extensionOf(attachment.name, attachment.url);
    return { ...attachment, extension, route: extractionRouteOf(extension), source: 'attachment' as const };
  });
  const inlineImages = (raw.programContent?.images ?? []).map((image, index) => {
    const extension = extensionOf(image.alt, image.url);
    return {
      name: image.alt.trim() || `본문 이미지 ${index + 1}`,
      url: image.url,
      extension,
      route: 'IMAGE_OCR' as const,
      source: 'inline_image' as const,
    };
  });
  return [...attachments, ...inlineImages];
}

export function buildProgramAttachmentInventory(records: RawProgram[], profile: InventoryProfile = 'text_with_supplement') {
  const targets = records
    .filter((raw) => profile === 'all' || contentProfileOf(raw) === 'text_with_supplement')
    .map((raw) => {
      const normalized = normalizeProgram(raw);
      const attachments = attachmentRows(raw);
      const routes = [...new Set(attachments.map((attachment) => attachment.route))];
      return {
        sourceId: raw.idx,
        sourceUrl: raw.url,
        title: raw.title,
        contentProfile: contentProfileOf(raw),
        bodyTextLength: String(raw.programContent?.text ?? raw.detailText ?? '').trim().length,
        structuredItemCount: normalized.board.sections.reduce((sum, section) => sum + section.items.length, 0),
        introLineCount: normalized.board.intro.length,
        tableCount: raw.programContent?.tables?.length ?? 0,
        inlineImageCount: raw.programContent?.images?.length ?? 0,
        attachmentCount: raw.attachments.length,
        textReadiness: textReadinessOf(normalized),
        attachmentReviewStatus: 'ATTACHMENT_UNCHECKED' as const,
        extractionRoutes: routes.length ? routes : [TEXT_ONLY_ROUTE],
        attachments,
        warnings: normalized.warnings,
      };
    });

  const countBy = <T extends string>(values: T[]) => Object.fromEntries(
    [...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length]),
  );
  return {
    schemaVersion: 'program-attachment-inventory/v1',
    generatedAt: new Date().toISOString(),
    profile,
    count: targets.length,
    stats: {
      contentProfiles: countBy(targets.map((item) => item.contentProfile)),
      textReadiness: countBy(targets.map((item) => item.textReadiness)),
      extractionRoutes: countBy(targets.flatMap((item) => item.extractionRoutes)),
      attachmentFiles: targets.reduce((sum, item) => sum + item.attachmentCount, 0),
      inlineImages: targets.reduce((sum, item) => sum + item.inlineImageCount, 0),
      unknownRouteRecords: targets.filter((item) => item.extractionRoutes.includes('UNKNOWN_REVIEW')).length,
    },
    items: targets,
  };
}

export async function main(args = process.argv.slice(2)) {
  const inputIndex = args.indexOf('--input');
  const outIndex = args.indexOf('--out');
  const profileIndex = args.indexOf('--profile');
  const profile = (profileIndex >= 0 ? args[profileIndex + 1] : 'text_with_supplement') as InventoryProfile;
  if (!['text_with_supplement', 'all'].includes(profile)) {
    throw new Error(`알 수 없는 프로파일: ${profile} (text_with_supplement | all)`);
  }
  const inputFile = inputIndex >= 0 ? path.resolve(args[inputIndex + 1]) : latestCrawlFile(DEFAULT_CRAWL_DIR);
  const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : DEFAULT_OUT_DIR;
  const payload = JSON.parse(fs.readFileSync(inputFile, 'utf8')) as { records: RawProgram[] };
  const result = { ...buildProgramAttachmentInventory(payload.records, profile), input: path.basename(inputFile) };
  fs.mkdirSync(outDir, { recursive: true });
  const output = path.join(outDir, profile === 'all' ? 'inventory-all.json' : 'inventory.json');
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output, count: result.count, stats: result.stats }, null, 2));
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
