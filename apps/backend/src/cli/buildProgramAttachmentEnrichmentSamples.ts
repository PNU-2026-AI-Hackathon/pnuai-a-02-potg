import fs from 'fs';
import path from 'path';
import { downloadAttachment } from '../services/attachment/attachmentDownloader';
import { safeAttachmentError } from '../services/attachment/attachmentErrors';
import { detectAttachmentFileType } from '../services/attachment/fileTypeDetector';
import { extractHwpText } from '../services/attachment/hwpTextExtractor';
import { extractPdfText } from '../services/attachment/pdfTextExtractor';
import { fileNameMatchesTitle, matchDocumentSection, splitHwpProgramSections, structureAttachmentText } from '../services/programAttachmentEnrichment/sectionMatcher';
import { extractHwpEmbeddedContent } from '../services/programAttachmentEnrichment/hwpEmbeddedContentExtractor';
import { extractDocumentStructure, extractHwpProgramSections } from '../services/programAttachmentEnrichment/documentCurriculumExtractor';
import { extractAlternativeHwpText } from '../services/programAttachmentEnrichment/hwpAlternativeExtractor';

export type InventoryAttachment = { name: string; url: string; route: string; source: string };
export type InventoryItem = { sourceId: number; sourceUrl: string; title: string; attachments: InventoryAttachment[] };

const DEFAULT_INVENTORY = path.resolve(process.cwd(), '.local', 'program-attachment-inventory', 'inventory.json');
const DEFAULT_OUT = path.resolve(process.cwd(), '.local', 'program-attachment-enrichment', 'samples.json');

function argument(args: string[], name: string, fallback: string) {
  const index = args.indexOf(name);
  return index >= 0 ? path.resolve(args[index + 1]) : fallback;
}

export function select(items: InventoryItem[], route: string, count: number) {
  return items.flatMap((item) => item.attachments
    .filter((attachment) => attachment.route === route)
    .map((attachment) => ({ item, attachment })))
    .slice(0, count);
}

/**
 * 첨부 1건의 다운로드·형식 판별·구간 선택·구조화까지를 담당한다.
 *
 * 전체 351건 배치(`runProgramAttachmentBatch`)도 이 함수를 그대로 재사용한다.
 * 대표 20건과 배치가 같은 코드 경로를 쓰지 않으면 회귀 비교가 성립하지 않는다.
 */
export async function processSample(
  candidate: { item: InventoryItem; attachment: InventoryAttachment },
  knownProgramTitles: string[],
  embeddedImageRoot: string,
  alternateAttachmentUrls: string[] = [],
) {
  let downloaded: Awaited<ReturnType<typeof downloadAttachment>> | undefined;
  try {
    let downloadError: unknown;
    for (const url of [candidate.attachment.url, ...alternateAttachmentUrls]) {
      try { downloaded = await downloadAttachment(url); break; } catch (error) { downloadError = error; }
    }
    if (!downloaded) throw downloadError;
    const detected = await detectAttachmentFileType({
      filePath: downloaded.tempFilePath,
      fileName: candidate.attachment.name,
      responseContentType: downloaded.responseContentType,
    });
    if (detected.detectedFileType === 'HWP') {
      const extraction = await extractHwpText(downloaded.tempFilePath);
      const embedded = await extractHwpEmbeddedContent(downloaded.tempFilePath, path.join(embeddedImageRoot, String(candidate.item.sourceId)));
      // 표 셀 구조로 구간을 나눈다. 평탄화 텍스트는 셀 안 줄바꿈과 <도서명> 표기를 잃는다.
      // 표 파싱이 실패하면 검증된 기존 텍스트 분할로 물러선다.
      let tableSections: Awaited<ReturnType<typeof extractHwpProgramSections>> = [];
      try { tableSections = await extractHwpProgramSections(downloaded.tempFilePath); } catch { /* 텍스트 경로 사용 */ }
      const sections = tableSections.length
        ? tableSections.map((section) => ({ pageNumber: section.index, text: section.text }))
        : splitHwpProgramSections(extraction.cleanedText);
      const sharedDocument = sections.length > 1;
      let match = matchDocumentSection({
        pages: sections,
        targetTitle: candidate.item.title,
        knownProgramTitles,
        singleProgramDocument: !sharedDocument,
      });
      // 본문에 제목 표기가 없는 단일 프로그램 문서는 파일명이 제목과 맞는지로 판단한다.
      if (match.status === 'NOT_FOUND' && !sharedDocument
        && fileNameMatchesTitle(path.parse(candidate.attachment.name).name, candidate.item.title)) {
        match = {
          status: 'WHOLE_DOCUMENT',
          selectedText: extraction.cleanedText,
          selectedPages: [1],
          score: 1,
          reason: '본문에 제목 표기가 없으나 단일 프로그램 문서이고 첨부 파일명이 제목과 일치',
        };
      }
      const structured = structureAttachmentText(match.selectedText);
      // 표 셀에서 직접 읽은 결과가 있으면 그것을 신뢰한다. 줄바꿈·열 경계·<도서명>이 보존된다.
      const selected = tableSections.filter((section) => match.selectedPages.includes(section.index));
      if (selected.length) {
        const tableCurriculum = selected.flatMap((section) => section.curriculum);
        if (tableCurriculum.length) structured.curriculum = tableCurriculum;
        // 표 IR은 라벨의 공백을 제거해 오므로(`학습자준비물`) 텍스트 경로의 `학습자 준비물`과
        // 같은 항목으로 보고 합친다. 그렇지 않으면 같은 값이 두 번 게시된다.
        const sameLabel = (left: string, right: string) => left.replace(/\s+/g, '') === right.replace(/\s+/g, '');
        for (const labeled of selected.flatMap((section) => section.labeled)) {
          const existing = structured.labeled.findIndex((item) => sameLabel(item.label, labeled.label));
          if (existing >= 0) structured.labeled[existing] = { label: structured.labeled[existing].label, value: labeled.value };
          else structured.labeled.push(labeled);
        }
        structured.notices = [...new Set([
          ...(structured.notices ?? []),
          ...selected.flatMap((section) => section.notices),
        ])];
      }
      // 보조 파서와 임베디드 이미지 추출은 파일 전체를 대상으로 한다.
      // 여러 프로그램이 든 문서에서는 어느 구간의 값인지 확정할 수 없으므로 쓰지 않는다.
      if (!sharedDocument && !selected.length) {
        try {
          const alternative = structureAttachmentText(extractAlternativeHwpText(downloaded.tempFilePath).replace(/\t/g, ' | '));
          if (alternative.curriculum.length === structured.curriculum.length) {
            structured.curriculum = structured.curriculum.map((row) => {
              const candidate = alternative.curriculum.find((item) => item.session === row.session);
              return candidate && candidate.content.length > row.content.length ? candidate : row;
            });
          }
        } catch { /* 보조 파서 실패 시 검증된 기본 추출 결과 유지 */ }
      }
      return {
        sourceId: candidate.item.sourceId,
        title: candidate.item.title,
        sourceUrl: candidate.item.sourceUrl,
        attachment: candidate.attachment,
        checksumSha256: downloaded.checksumSha256,
        detectedType: detected.detectedFileType,
        sharedDocument,
        extraction: { characterCount: extraction.cleanedText.length, tableCount: extraction.metadata.tableCount },
        match: { ...match, selectedText: match.selectedText.slice(0, 10_000) },
        structured: { ...structured, embedded: sharedDocument ? [] : embedded.curriculumReferences },
        reviewStatus: ['WHOLE_DOCUMENT', 'SECTION_MATCHED'].includes(match.status)
          ? 'AUTO_REVIEW_CANDIDATE' : 'MANUAL_REVIEW_REQUIRED',
      };
    }
    if (detected.detectedFileType === 'PDF') {
      const extraction = await extractPdfText(downloaded.tempFilePath);
      const match = matchDocumentSection({
        pages: extraction.pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
        targetTitle: candidate.item.title,
        knownProgramTitles,
      });
      const structured = structureAttachmentText(match.selectedText);
      const tableStructure = match.selectedPages.length
        ? await extractDocumentStructure(downloaded.tempFilePath, match.selectedPages, path.join(embeddedImageRoot, String(candidate.item.sourceId)))
        : { curriculum: [], labeled: [], notices: [] };
      const tableCurriculum = tableStructure.curriculum;
      for (const labeled of tableStructure.labeled) {
        const existing = structured.labeled.findIndex((item) => item.label === labeled.label);
        if (existing >= 0) structured.labeled[existing] = labeled;
        else structured.labeled.push(labeled);
      }
      structured.notices = [...new Set([...(structured.notices ?? []), ...tableStructure.notices])];
      return {
        sourceId: candidate.item.sourceId,
        title: candidate.item.title,
        sourceUrl: candidate.item.sourceUrl,
        attachment: candidate.attachment,
        checksumSha256: downloaded.checksumSha256,
        detectedType: detected.detectedFileType,
        extraction: {
          characterCount: extraction.cleanedText.length,
          pageCount: extraction.pageCount,
          classification: extraction.classification,
          pageHeadings: extraction.pages.map((page) => ({
            pageNumber: page.pageNumber,
            text: page.text.replace(/\s+/g, ' ').trim().slice(0, 180),
          })),
        },
        match: { ...match, selectedText: match.selectedText.slice(0, 10_000) },
        structured: { ...structured, curriculum: tableCurriculum.length ? tableCurriculum : structured.curriculum },
        reviewStatus: match.status === 'SECTION_MATCHED' ? 'AUTO_REVIEW_CANDIDATE' : 'MANUAL_REVIEW_REQUIRED',
      };
    }
    throw new Error(`지원하지 않는 표본 형식: ${detected.detectedFileType}`);
  } catch (error) {
    const safe = safeAttachmentError(error);
    return {
      sourceId: candidate.item.sourceId,
      title: candidate.item.title,
      sourceUrl: candidate.item.sourceUrl,
      attachment: candidate.attachment,
      reviewStatus: 'MANUAL_REVIEW_REQUIRED',
      failure: { code: safe.code, message: safe.message },
    };
  } finally {
    await downloaded?.cleanup().catch(() => undefined);
  }
}

export async function main(args = process.argv.slice(2)) {
  const input = argument(args, '--input', DEFAULT_INVENTORY);
  const output = argument(args, '--out', DEFAULT_OUT);
  const perTypeIndex = args.indexOf('--per-type');
  const perType = perTypeIndex >= 0 ? Number(args[perTypeIndex + 1]) : 5;
  if (!Number.isSafeInteger(perType) || perType < 1 || perType > 10) throw new Error('--per-type은 1~10 정수여야 합니다.');
  const inventory = JSON.parse(fs.readFileSync(input, 'utf8')) as { items: InventoryItem[]; input?: string };
  const candidates = [...select(inventory.items, 'HWP_TEXT', perType), ...select(inventory.items, 'PDF_CLASSIFY', perType)];
  const knownProgramTitles = inventory.items.map((item) => item.title);
  const results: Awaited<ReturnType<typeof processSample>>[] = [];
  const embeddedImageRoot = path.join(path.dirname(output), 'embedded-images');
  for (const candidate of candidates) {
    const normalizedName = candidate.attachment.name.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
    const alternateAttachmentUrls = inventory.items.flatMap((item) => item.attachments)
      .filter((attachment) => attachment.url !== candidate.attachment.url
        && attachment.name.normalize('NFKC').toLowerCase().replace(/\s+/g, '') === normalizedName)
      .map((attachment) => attachment.url);
    results.push(await processSample(candidate, knownProgramTitles, embeddedImageRoot, [...new Set(alternateAttachmentUrls)]));
  }
  const checksumGroups = new Map<string, number[]>();
  for (const result of results) {
    if (!('checksumSha256' in result) || typeof result.checksumSha256 !== 'string') continue;
    checksumGroups.set(result.checksumSha256, [...(checksumGroups.get(result.checksumSha256) ?? []), result.sourceId]);
  }
  const report = {
    schemaVersion: 'program-attachment-enrichment-samples/v1',
    generatedAt: new Date().toISOString(),
    crawlInput: inventory.input ?? null,
    policy: { perType, imageOcrIncluded: false },
    summary: {
      selected: results.length,
      autoReviewCandidates: results.filter((result) => result.reviewStatus === 'AUTO_REVIEW_CANDIDATE').length,
      manualReviewRequired: results.filter((result) => result.reviewStatus === 'MANUAL_REVIEW_REQUIRED').length,
      matchStatus: Object.fromEntries(['WHOLE_DOCUMENT', 'SECTION_MATCHED', 'AMBIGUOUS', 'NOT_FOUND'].map((status) => [
        status,
        results.filter((result) => 'match' in result && result.match?.status === status).length,
      ])),
      sharedFileGroups: [...checksumGroups.values()].filter((ids) => ids.length > 1).length,
    },
    sharedFiles: [...checksumGroups.entries()].filter(([, ids]) => ids.length > 1)
      .map(([checksumSha256, sourceIds]) => ({ checksumSha256, sourceIds })),
    results,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output, summary: report.summary }, null, 2));
  return report;
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
