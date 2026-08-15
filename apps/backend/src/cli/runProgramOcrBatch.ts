import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { downloadAttachment } from '../services/attachment/attachmentDownloader';
import { safeAttachmentError } from '../services/attachment/attachmentErrors';
import { detectAttachmentFileType } from '../services/attachment/fileTypeDetector';
import { processImageForOcr } from '../services/attachment/imageOcrProcessor';
import { createClovaOcrEngine } from '../services/attachment/clovaOcrClient';
import { getAttachmentOcrConfig } from '../config/attachmentOcr';
import { getAttachmentExtractionConfig } from '../config/attachmentExtraction';
import { getClovaOcrConfig } from '../config/clovaOcr';

const DEFAULT_QUEUE = path.resolve(process.cwd(), '.local', 'program-attachment-batch', 'ocr-queue.json');
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), '.local', 'program-attachment-ocr');

/**
 * 파일 한 건의 OCR 처리 결과.
 *
 * `OCR_LOW_CONFIDENCE`는 실패가 아니다. 글자는 읽었으나 평균 신뢰도가 기준에 못 미쳐
 * 자동 반영하지 않는다는 뜻이며, 추출문은 검수용으로 그대로 보존한다.
 */
export type OcrFileStatus =
  | 'OCR_COMPLETED'
  | 'OCR_LOW_CONFIDENCE'
  // 읽었으나 글자가 하나도 없는 이미지. 장식·로고일 가능성이 높다.
  // 폐기하지 않고 분류만 하며, 최종 판단은 사람이 한다.
  | 'OCR_NO_TEXT'
  | 'OCR_NOT_IMAGE'
  | 'OCR_FAILED'
  | 'OCR_BUDGET_EXCEEDED'
  | 'OCR_REUSED';

export type OcrTargetGroup = 'no-body' | 'with-body' | 'all';

/**
 * 이 배치에서만 추가로 허용하는 호스트.
 *
 * 금정구 게시글 일부가 본문 이미지를 카카오 블로그 CDN에서 불러온다.
 * 전역 기본값(`www.geumjeong.go.kr`)은 그대로 두고 이 배치에만 정확한 호스트 하나를 더한다.
 * 와일드카드가 아니라 호스트 완전 일치이며, 사설 IP 차단은 그대로 적용된다.
 */
export const OCR_EXTRA_ALLOWED_HOSTS = ['blog.kakaocdn.net'];

/**
 * 본문에 `data:image/...;base64,`로 박혀 있는 이미지를 파일로 만든다.
 *
 * 내려받을 주소가 아니라 이미 크롤링 결과 안에 들어 있는 데이터다.
 * 네트워크를 타지 않으므로 호스트 허용 여부와 무관하다.
 */
export function decodeDataUrl(value: string, directory: string) {
  const match = value.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) throw new Error('data URL 형식이 아닙니다.');
  const [, mimeType, base64Flag, payload] = match;
  const buffer = base64Flag
    ? Buffer.from(payload, 'base64')
    : Buffer.from(decodeURIComponent(payload), 'binary');
  if (!buffer.length) throw new Error('data URL에 내용이 없습니다.');
  fs.mkdirSync(directory, { recursive: true });
  const tempFilePath = path.join(directory, `inline-${crypto.randomUUID()}.bin`);
  fs.writeFileSync(tempFilePath, buffer, { mode: 0o600 });
  return {
    tempFilePath,
    byteSize: buffer.length,
    checksumSha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    responseContentType: (mimeType || null) as string | null,
    cleanup: async () => { await fs.promises.rm(tempFilePath, { force: true }); },
  };
}

export function isDataUrl(value: string) {
  return value.startsWith('data:');
}

type QueueRecord = {
  sourceId: number;
  title: string;
  sourceUrl: string;
  hasBodyText: boolean;
  bodyPublishable: boolean;
  targets: Array<{ name: string; url: string; source: string }>;
};

type QueueFile = { url: string; name: string; sourceIds: number[] };

/**
 * 정책상 OCR 결과는 신뢰도와 무관하게 전량 사람 검수를 거친다.
 * 이 값이 `false`가 되려면 첫 배치 정확도 확인 후 정책을 다시 정해야 한다.
 */
export const OCR_RESULTS_ALWAYS_REVIEWED = true;

function argumentOf(args: string[], name: string, fallback: string) {
  const index = args.indexOf(name);
  return index >= 0 ? path.resolve(args[index + 1]) : fallback;
}

function numberOption(args: string[], name: string, fallback: number | null) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name}은 1 이상의 정수여야 합니다.`);
  return value;
}

/** 큐 레코드에서 대상 파일을 고른다. 같은 파일을 여러 레코드가 참조하면 한 번만 처리한다. */
export function selectFiles(queue: { records: QueueRecord[]; uniqueFiles: QueueFile[] }, group: OcrTargetGroup) {
  if (group === 'all') return queue.uniqueFiles;
  const wanted = new Set(queue.records
    .filter((record) => (group === 'no-body' ? !record.hasBodyText : record.hasBodyText))
    .map((record) => record.sourceId));
  return queue.uniqueFiles.filter((file) => file.sourceIds.some((sourceId) => wanted.has(sourceId)));
}

/**
 * OCR 결과를 분류한다.
 *
 * 글자가 하나도 없으면 장식용 이미지로 본다. 사람이 미리 골라내지 않아도
 * 이 단계에서 갈린다. 다만 `OCR_NO_TEXT`는 폐기가 아니라 분류일 뿐이며,
 * 실제로는 글자가 있는데 못 읽었을 수도 있으므로 목록에 남겨 사람이 확인한다.
 */
export function classifyOcrResult(
  input: { averageConfidence?: number; isEmpty: boolean; fieldCount?: number },
  minimum: number,
): OcrFileStatus {
  if (input.isEmpty || input.fieldCount === 0) return 'OCR_NO_TEXT';
  if (input.averageConfidence === undefined) return 'OCR_LOW_CONFIDENCE';
  return input.averageConfidence >= minimum ? 'OCR_COMPLETED' : 'OCR_LOW_CONFIDENCE';
}

export async function main(args = process.argv.slice(2)) {
  const dryRun = args.includes('--dry-run');
  const queuePath = argumentOf(args, '--queue', DEFAULT_QUEUE);
  const outDir = argumentOf(args, '--out', DEFAULT_OUT_DIR);
  const limit = numberOption(args, '--limit', null);
  const groupIndex = args.indexOf('--group');
  const group = (groupIndex >= 0 ? args[groupIndex + 1] : 'all') as OcrTargetGroup;
  if (!['no-body', 'with-body', 'all'].includes(group)) {
    throw new Error(`알 수 없는 대상: ${group} (no-body | with-body | all)`);
  }

  const ocrConfig = getAttachmentOcrConfig();
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8')) as { records: QueueRecord[]; uniqueFiles: QueueFile[] };
  let files = selectFiles(queue, group);
  if (limit != null) files = files.slice(0, limit);

  // 드라이런은 API를 호출하지 않으므로 엔진을 만들지 않는다.
  // 실제 실행일 때만 자격증명을 확인한다.
  const engine = dryRun ? null : createClovaOcrEngine(getClovaOcrConfig());
  if (!dryRun) {
    console.error(`실제 OCR을 호출합니다. 호출 상한 ${ocrConfig.ocrMaxCalls}회, 최소 신뢰도 ${ocrConfig.ocrMinConfidence}`);
  }

  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'program-ocr-'));
  const byChecksum = new Map<string, { status: OcrFileStatus; url: string }>();
  const results: any[] = [];
  let apiCalls = 0;
  let budgetExceeded = false;

  try {
    for (const [index, file] of files.entries()) {
      if (index % 20 === 0 || index === files.length - 1) console.error(`  진행 ${index + 1}/${files.length}`);
      // 내려받은 파일과 본문에서 디코딩한 파일을 같은 방식으로 다룬다.
      let downloaded: {
        tempFilePath: string;
        byteSize: number;
        checksumSha256: string;
        responseContentType: string | null;
        cleanup: () => Promise<void>;
      } | undefined;
      const base = {
        url: isDataUrl(file.url) ? `data:(본문 내장 ${file.url.length}바이트)` : file.url,
        name: file.name,
        sourceIds: file.sourceIds,
      };
      try {
        downloaded = isDataUrl(file.url)
          ? decodeDataUrl(file.url, workRoot)
          : await downloadAttachment(file.url, {
            allowedHosts: [...getAttachmentExtractionConfig().allowedHosts, ...OCR_EXTRA_ALLOWED_HOSTS],
          });
        const detected = await detectAttachmentFileType({
          filePath: downloaded.tempFilePath,
          fileName: file.name,
          responseContentType: downloaded.responseContentType,
        });
        const checksum = downloaded.checksumSha256;
        const imageType = detected.detectedFileType === 'JPEG' || detected.detectedFileType === 'PNG'
          ? detected.detectedFileType
          : null;

        if (!imageType) {
          results.push({ ...base, checksum, detectedType: detected.detectedFileType, status: 'OCR_NOT_IMAGE' as OcrFileStatus });
          continue;
        }

        // 파일명이 달라도 내용이 같으면 이미 처리한 결과를 쓴다. 호출 비용을 줄이는 핵심이다.
        const seen = byChecksum.get(checksum);
        if (seen) {
          results.push({ ...base, checksum, detectedType: detected.detectedFileType, status: 'OCR_REUSED' as OcrFileStatus, reusedFrom: seen.url });
          continue;
        }

        if (dryRun) {
          byChecksum.set(checksum, { status: 'OCR_COMPLETED', url: file.url });
          results.push({
            ...base,
            checksum,
            detectedType: detected.detectedFileType,
            byteSize: downloaded.byteSize ?? null,
            status: 'OCR_COMPLETED' as OcrFileStatus,
            wouldCall: true,
          });
          continue;
        }

        if (apiCalls >= ocrConfig.ocrMaxCalls) {
          budgetExceeded = true;
          results.push({ ...base, checksum, status: 'OCR_BUDGET_EXCEEDED' as OcrFileStatus });
          continue;
        }

        const processed = await processImageForOcr({
          sourcePath: downloaded.tempFilePath,
          workDirectory: workRoot,
          expectedType: imageType,
          ocrEngine: engine!,
        }, ocrConfig);
        apiCalls += processed.apiCallCount;

        const status = classifyOcrResult(processed, ocrConfig.ocrMinConfidence);
        byChecksum.set(checksum, { status, url: file.url });
        results.push({
          ...base,
          checksum,
          detectedType: detected.detectedFileType,
          status,
          averageConfidence: processed.averageConfidence ?? null,
          fieldCount: processed.fieldCount ?? null,
          isEmpty: processed.isEmpty,
          apiCallCount: processed.apiCallCount,
          cleanedText: processed.cleanedText,
        });
      } catch (error) {
        const safe = safeAttachmentError(error);
        results.push({ ...base, status: 'OCR_FAILED' as OcrFileStatus, failure: { code: safe.code, message: safe.message } });
      } finally {
        await downloaded?.cleanup().catch(() => undefined);
      }
    }
  } finally {
    fs.rmSync(workRoot, { recursive: true, force: true });
  }

  const countBy = (key: OcrFileStatus) => results.filter((item) => item.status === key).length;
  const report = {
    schemaVersion: 'program-ocr-batch/v1',
    generatedAt: new Date().toISOString(),
    mode: dryRun ? 'DRY_RUN' : 'LIVE',
    policy: {
      engine: 'CLOVA_OCR_GENERAL',
      maxCalls: ocrConfig.ocrMaxCalls,
      minConfidence: ocrConfig.ocrMinConfidence,
      allResultsReviewed: OCR_RESULTS_ALWAYS_REVIEWED,
      group,
    },
    summary: {
      targetFiles: files.length,
      uniqueByChecksum: byChecksum.size,
      reusedByChecksum: countBy('OCR_REUSED'),
      notImage: countBy('OCR_NOT_IMAGE'),
      failed: countBy('OCR_FAILED'),
      completed: countBy('OCR_COMPLETED'),
      lowConfidence: countBy('OCR_LOW_CONFIDENCE'),
      noText: countBy('OCR_NO_TEXT'),
      budgetExceeded: countBy('OCR_BUDGET_EXCEEDED'),
      apiCalls,
      // 드라이런에서는 실제 호출 없이 "돌리면 몇 번 부를지"를 알려준다.
      estimatedCalls: dryRun ? byChecksum.size : apiCalls,
    },
    results: dryRun ? results.map(({ cleanedText, ...rest }) => rest) : results,
  };

  fs.mkdirSync(outDir, { recursive: true });
  const output = path.join(outDir, dryRun ? 'dry-run.json' : 'results.json');
  // 대상을 나눠 실행하는 것이 기본 운영 방식이므로 이전 회차 결과를 이어받는다.
  // 이어받지 않으면 2단계 실행이 1단계 결과를 지운다.
  if (!dryRun && fs.existsSync(output)) {
    const previous = JSON.parse(fs.readFileSync(output, 'utf8')).results ?? [];
    const merged = new Map<string, any>(previous.map((item: any) => [item.url, item]));
    for (const item of report.results) merged.set(item.url, item);
    report.results = [...merged.values()];
    const countAll = (key: OcrFileStatus) => report.results.filter((item: any) => item.status === key).length;
    report.summary = {
      ...report.summary,
      targetFiles: report.results.length,
      completed: countAll('OCR_COMPLETED'),
      lowConfidence: countAll('OCR_LOW_CONFIDENCE'),
      noText: countAll('OCR_NO_TEXT'),
      notImage: countAll('OCR_NOT_IMAGE'),
      failed: countAll('OCR_FAILED'),
      reusedByChecksum: countAll('OCR_REUSED'),
      budgetExceeded: countAll('OCR_BUDGET_EXCEEDED'),
      apiCallsThisRun: apiCalls,
    } as typeof report.summary & { apiCallsThisRun: number };
  }
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output, mode: report.mode, summary: report.summary }, null, 2));
  if (budgetExceeded) console.error('호출 상한에 도달해 남은 대상을 처리하지 않았습니다.');
  return report;
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
