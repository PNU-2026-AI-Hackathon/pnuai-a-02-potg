import fs from 'fs';
import path from 'path';
import { getAttachmentOcrConfig } from '../config/attachmentOcr';
import { downloadAttachment } from '../services/attachment/attachmentDownloader';
import { safeAttachmentError } from '../services/attachment/attachmentErrors';
import { detectAttachmentFileType } from '../services/attachment/fileTypeDetector';
import { extractHwpText } from '../services/attachment/hwpTextExtractor';
import { inspectImageMetadata } from '../services/attachment/imageMetadata';
import { preprocessImage } from '../services/attachment/imagePreprocessor';
import { detectPdfRendererAvailability, renderPdfPage } from '../services/attachment/pdfPageRenderer';
import { extractPdfText } from '../services/attachment/pdfTextExtractor';

type InventoryAttachment = {
  name: string;
  url: string;
  extension: string | null;
  route: 'HWP_TEXT' | 'HWPX_TEXT' | 'PDF_CLASSIFY' | 'IMAGE_OCR' | 'UNKNOWN_REVIEW';
  source: 'attachment' | 'inline_image';
};

type InventoryItem = {
  sourceId: number;
  sourceUrl: string;
  title: string;
  attachments: InventoryAttachment[];
};

type ValidationStage = { stage: string; status: 'passed' | 'failed' | 'skipped'; details?: Record<string, unknown> };

const DEFAULT_INVENTORY = path.resolve(process.cwd(), '.local', 'program-attachment-inventory', 'inventory.json');
const DEFAULT_OUT = path.resolve(process.cwd(), '.local', 'program-attachment-validation', 'report.json');

function option(args: string[], name: string, fallback: string) {
  const index = args.indexOf(name);
  return index >= 0 ? path.resolve(args[index + 1]) : fallback;
}

function sampleCandidates(items: InventoryItem[], limit: number) {
  const seen = new Set<string>();
  const flattened = items.flatMap((item) => item.attachments.map((attachment) => ({
    sourceId: item.sourceId,
    sourceUrl: item.sourceUrl,
    title: item.title,
    attachment,
  }))).filter(({ attachment }) => {
    if (seen.has(attachment.url)) return false;
    seen.add(attachment.url);
    return true;
  });
  const take = (route: InventoryAttachment['route']) => flattened.filter(({ attachment }) => attachment.route === route).slice(0, limit);
  return [...take('HWP_TEXT'), ...take('HWPX_TEXT'), ...take('PDF_CLASSIFY'), ...take('IMAGE_OCR')];
}

function excerpt(value: string, maximum = 500) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maximum);
}

async function validateCandidate(candidate: ReturnType<typeof sampleCandidates>[number], rendererAvailable: boolean) {
  const stages: ValidationStage[] = [];
  let downloaded: Awaited<ReturnType<typeof downloadAttachment>> | undefined;
  try {
    downloaded = await downloadAttachment(candidate.attachment.url);
    stages.push({
      stage: 'download', status: 'passed', details: {
        byteSize: downloaded.byteSize,
        checksumSha256: downloaded.checksumSha256,
        responseContentType: downloaded.responseContentType,
      },
    });
    const detection = await detectAttachmentFileType({
      filePath: downloaded.tempFilePath,
      fileName: candidate.attachment.name,
      responseContentType: downloaded.responseContentType,
    });
    stages.push({ stage: 'file_detection', status: 'passed', details: detection });

    if (detection.detectedFileType === 'HWP') {
      const result = await extractHwpText(downloaded.tempFilePath);
      stages.push({
        stage: 'hwp_text', status: 'passed', details: {
          cleanedTextLength: result.cleanedText.length,
          excerpt: excerpt(result.cleanedText),
          ...result.metadata,
        },
      });
    } else if (detection.detectedFileType === 'HWPX') {
      stages.push({ stage: 'hwpx_text', status: 'skipped', details: { reason: '현재 HWP 추출기는 HWPX를 지원하지 않음' } });
    } else if (detection.detectedFileType === 'PDF') {
      const result = await extractPdfText(downloaded.tempFilePath);
      stages.push({
        stage: 'pdf_text', status: 'passed', details: {
          classification: result.classification,
          pageCount: result.pageCount,
          cleanedTextLength: result.cleanedText.length,
          ocrCandidatePages: result.ocrCandidatePages,
          excerpt: excerpt(result.cleanedText),
        },
      });
      if (rendererAvailable) {
        const pageNumber = result.ocrCandidatePages[0] ?? 1;
        const rendered = await renderPdfPage({
          pdfPath: downloaded.tempFilePath,
          pageNumber,
          pageCount: result.pageCount,
          workDirectory: path.dirname(downloaded.tempFilePath),
        });
        try {
          stages.push({ stage: 'pdf_render', status: 'passed', details: { pageNumber, byteSize: rendered.byteSize } });
        } finally {
          await rendered.cleanup();
        }
      } else {
        stages.push({ stage: 'pdf_render', status: 'skipped', details: { reason: 'pdftocairo를 사용할 수 없음' } });
      }
    } else if (detection.detectedFileType === 'JPEG' || detection.detectedFileType === 'PNG') {
      const config = getAttachmentOcrConfig();
      const metadata = await inspectImageMetadata(downloaded.tempFilePath, config);
      stages.push({ stage: 'image_metadata', status: 'passed', details: metadata });
      const prepared = await preprocessImage(downloaded.tempFilePath, path.dirname(downloaded.tempFilePath), config);
      try {
        stages.push({
          stage: 'image_preprocess', status: 'passed', details: {
            width: prepared.width, height: prepared.height, byteSize: prepared.byteSize,
          },
        });
        stages.push({ stage: 'image_ocr', status: 'skipped', details: { reason: '외부 OCR API 비용을 발생시키지 않는 검증 단계' } });
      } finally {
        await prepared.cleanup();
      }
    }
  } catch (error) {
    const safe = safeAttachmentError(error);
    stages.push({ stage: 'validation', status: 'failed', details: { code: safe.code, message: safe.message, retryable: safe.retryable } });
  } finally {
    await downloaded?.cleanup().catch(() => undefined);
  }
  return { ...candidate, stages, passed: !stages.some((stage) => stage.status === 'failed') };
}

export async function main(args = process.argv.slice(2)) {
  const inventoryPath = option(args, '--input', DEFAULT_INVENTORY);
  const outputPath = option(args, '--out', DEFAULT_OUT);
  const limitIndex = args.indexOf('--per-type');
  const perType = limitIndex >= 0 ? Number(args[limitIndex + 1]) : 2;
  if (!Number.isSafeInteger(perType) || perType < 1 || perType > 10) throw new Error('--per-type은 1~10 정수여야 합니다.');
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8')) as { items: InventoryItem[]; input?: string };
  const renderer = await detectPdfRendererAvailability();
  const candidates = sampleCandidates(inventory.items, perType);
  const results: Awaited<ReturnType<typeof validateCandidate>>[] = [];
  for (const candidate of candidates) results.push(await validateCandidate(candidate, renderer.available));
  const checksumGroups = new Map<string, typeof results>();
  for (const result of results) {
    const checksum = result.stages.find((stage) => stage.stage === 'download')?.details?.checksumSha256;
    if (typeof checksum !== 'string') continue;
    checksumGroups.set(checksum, [...(checksumGroups.get(checksum) ?? []), result]);
  }
  const sharedFiles = [...checksumGroups.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([checksumSha256, group]) => ({
      checksumSha256,
      count: group.length,
      programs: group.map((result) => ({ sourceId: result.sourceId, title: result.title, name: result.attachment.name })),
    }));
  const report = {
    schemaVersion: 'program-attachment-validation/v1',
    generatedAt: new Date().toISOString(),
    inventory: path.basename(inventoryPath),
    crawlInput: inventory.input ?? null,
    policy: { perType, paidOcrApiCalled: false },
    environment: { pdfRenderer: renderer },
    summary: {
      selected: results.length,
      passed: results.filter((result) => result.passed).length,
      failed: results.filter((result) => !result.passed).length,
      byRoute: Object.fromEntries([...new Set(results.map((result) => result.attachment.route))].map((route) => [
        route,
        { selected: results.filter((result) => result.attachment.route === route).length,
          passed: results.filter((result) => result.attachment.route === route && result.passed).length },
      ])),
      sharedFileGroups: sharedFiles.length,
    },
    sharedFiles,
    results,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: outputPath, summary: report.summary, environment: report.environment }, null, 2));
  if (report.summary.failed) process.exitCode = 1;
  return report;
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
