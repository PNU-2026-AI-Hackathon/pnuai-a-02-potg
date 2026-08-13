import fs from 'fs';
import path from 'path';
import { downloadAttachment } from '../services/attachment/attachmentDownloader';
import { safeAttachmentError } from '../services/attachment/attachmentErrors';
import { detectAttachmentFileType } from '../services/attachment/fileTypeDetector';
import { extractHwpText } from '../services/attachment/hwpTextExtractor';
import { extractPdfText } from '../services/attachment/pdfTextExtractor';
import { matchDocumentSection, structureAttachmentText } from '../services/programAttachmentEnrichment/sectionMatcher';

type InventoryAttachment = { name: string; url: string; route: string; source: string };
type InventoryItem = { sourceId: number; sourceUrl: string; title: string; attachments: InventoryAttachment[] };

const DEFAULT_INVENTORY = path.resolve(process.cwd(), '.local', 'program-attachment-inventory', 'inventory.json');
const DEFAULT_OUT = path.resolve(process.cwd(), '.local', 'program-attachment-enrichment', 'samples.json');

function argument(args: string[], name: string, fallback: string) {
  const index = args.indexOf(name);
  return index >= 0 ? path.resolve(args[index + 1]) : fallback;
}

function select(items: InventoryItem[], route: string, count: number) {
  return items.flatMap((item) => item.attachments
    .filter((attachment) => attachment.route === route)
    .map((attachment) => ({ item, attachment })))
    .slice(0, count);
}

async function processSample(
  candidate: ReturnType<typeof select>[number],
  knownProgramTitles: string[],
) {
  let downloaded: Awaited<ReturnType<typeof downloadAttachment>> | undefined;
  try {
    downloaded = await downloadAttachment(candidate.attachment.url);
    const detected = await detectAttachmentFileType({
      filePath: downloaded.tempFilePath,
      fileName: candidate.attachment.name,
      responseContentType: downloaded.responseContentType,
    });
    if (detected.detectedFileType === 'HWP') {
      const extraction = await extractHwpText(downloaded.tempFilePath);
      const match = matchDocumentSection({
        pages: [{ pageNumber: 1, text: extraction.cleanedText }],
        targetTitle: candidate.item.title,
        knownProgramTitles,
        singleProgramDocument: true,
      });
      return {
        sourceId: candidate.item.sourceId,
        title: candidate.item.title,
        sourceUrl: candidate.item.sourceUrl,
        attachment: candidate.attachment,
        checksumSha256: downloaded.checksumSha256,
        detectedType: detected.detectedFileType,
        extraction: { characterCount: extraction.cleanedText.length, tableCount: extraction.metadata.tableCount },
        match: { ...match, selectedText: match.selectedText.slice(0, 10_000) },
        structured: structureAttachmentText(match.selectedText),
        reviewStatus: match.status === 'WHOLE_DOCUMENT' ? 'AUTO_REVIEW_CANDIDATE' : 'MANUAL_REVIEW_REQUIRED',
      };
    }
    if (detected.detectedFileType === 'PDF') {
      const extraction = await extractPdfText(downloaded.tempFilePath);
      const match = matchDocumentSection({
        pages: extraction.pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
        targetTitle: candidate.item.title,
        knownProgramTitles,
      });
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
        structured: structureAttachmentText(match.selectedText),
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
  for (const candidate of candidates) results.push(await processSample(candidate, knownProgramTitles));
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
