import { prisma } from '../lib/prisma';
import { runAttachmentExtraction, RunAttachmentExtractionOptions } from '../services/attachment/attachmentExtractionService';
import { ImageOcrRunOptions, runImageOcr } from '../services/attachment/imageOcrDryRunService';
import { PdfOcrRunOptions, runMixedPdfWrite, runPdfOcrDryRun, runPdfOcrPlan, runPdfOcrRenderDryRun } from '../services/attachment/pdfOcrPlanService';
import { runOcrRequiredPdf } from '../services/attachment/pdfOcrRequiredService';

type ExtractionArguments = RunAttachmentExtractionOptions | ImageOcrRunOptions | PdfOcrRunOptions;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function valueAfter(args: string[], index: number, option: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
  return value;
}

export function parseExtractionArguments(args: string[]): ExtractionArguments {
  const values: Record<string, string | boolean> = {};
  const valueOptions = new Set(['--type', '--limit', '--attachment-id']);
  const flagOptions = new Set(['--retry-failed', '--dry-run', '--plan', '--mixed-only', '--ocr-required-only', '--render-dry-run', '--ocr-dry-run', '--write']);
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!valueOptions.has(argument) && !flagOptions.has(argument)) throw new Error(`Unknown option: ${argument}`);
    if (argument in values) throw new Error(`Duplicate option: ${argument}`);
    if (valueOptions.has(argument)) {
      values[argument] = valueAfter(args, index, argument);
      index += 1;
    } else {
      values[argument] = true;
    }
  }
  if (!values['--type']) throw new Error('--type is required.');
  const type = String(values['--type']).toUpperCase();
  if (type !== 'PDF' && type !== 'IMAGE' && type !== 'PDF_OCR') {
    throw new Error('Only --type PDF, IMAGE, or PDF_OCR is supported.');
  }
  if (type === 'PDF_OCR') {
    const mixedOnly = values['--mixed-only'] === true;
    const ocrRequiredOnly = values['--ocr-required-only'] === true;
    if (mixedOnly === ocrRequiredOnly) throw new Error('Exactly one PDF_OCR target mode is required.');
    if (values['--retry-failed']) throw new Error('--retry-failed is not supported for PDF_OCR.');
    if (values['--dry-run']) throw new Error('--dry-run is not implemented for PDF_OCR.');
    const plan = values['--plan'] === true;
    const renderDryRun = values['--render-dry-run'] === true;
    const ocrDryRun = values['--ocr-dry-run'] === true;
    const write = values['--write'] === true;
    if ([plan, renderDryRun, ocrDryRun, write].filter(Boolean).length > 1) {
      throw new Error('PDF_OCR execution modes cannot be combined.');
    }
    if (!plan && !renderDryRun && !ocrDryRun && !write) {
      throw new Error('An explicit PDF_OCR execution mode is required.');
    }
    if (ocrRequiredOnly && (renderDryRun || ocrDryRun)) throw new Error('OCR_REQUIRED supports only --plan or --write.');
    const limit = values['--limit'] === undefined ? 1 : Number(values['--limit']);
    const maximum = ocrRequiredOnly ? 5 : 1;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum) throw new Error(`--limit must be from 1 to ${maximum} for PDF_OCR.`);
    const attachmentId = values['--attachment-id'] ? String(values['--attachment-id']) : undefined;
    if (attachmentId && !UUID.test(attachmentId)) throw new Error('--attachment-id must be a UUID.');
    return {
      type: 'PDF_OCR', mixedOnly, ocrRequiredOnly, limit, ...(attachmentId ? { attachmentId } : {}),
      plan, renderDryRun, ...(ocrDryRun ? { ocrDryRun: true } : {}), ...(write ? { write: true } : {}),
    } as PdfOcrRunOptions;
  }
  if (values['--mixed-only'] || values['--ocr-required-only'] || values['--render-dry-run'] || values['--ocr-dry-run'] || values['--write']) {
    throw new Error('PDF OCR selection options require --type PDF_OCR.');
  }
  const maximum = type === 'IMAGE' ? 5 : 20;
  const defaultLimit = type === 'IMAGE' ? 1 : 5;
  const limit = values['--limit'] === undefined ? defaultLimit : Number(values['--limit']);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > maximum) {
    throw new Error(`--limit must be an integer from 1 to ${maximum}.`);
  }
  const attachmentId = values['--attachment-id'] ? String(values['--attachment-id']) : undefined;
  if (attachmentId && !UUID.test(attachmentId)) throw new Error('--attachment-id must be a UUID.');
  const retryFailed = values['--retry-failed'] === true;
  const dryRun = values['--dry-run'] === true;
  const plan = values['--plan'] === true;
  if (plan && dryRun) throw new Error('--plan and --dry-run cannot be used together.');
  if (type === 'PDF') {
    if (plan) throw new Error('--plan is only supported for IMAGE.');
    return {
      type: 'PDF',
      limit,
      ...(attachmentId ? { attachmentId } : {}),
      retryFailed,
      dryRun,
    };
  }
  return {
    type: 'IMAGE',
    limit,
    ...(attachmentId ? { attachmentId } : {}),
    retryFailed,
    plan,
    dryRun,
  };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseExtractionArguments(args);
  const startedAt = Date.now();
  const result = options.type === 'IMAGE'
    ? await runImageOcr(options)
    : options.type === 'PDF_OCR'
      ? 'ocrRequiredOnly' in options && options.ocrRequiredOnly
        ? await runOcrRequiredPdf(options as never)
        : options.renderDryRun
        ? await runPdfOcrRenderDryRun(options)
        : 'ocrDryRun' in options && options.ocrDryRun
          ? await runPdfOcrDryRun(options)
          : 'write' in options && options.write
            ? await runMixedPdfWrite(options)
          : await runPdfOcrPlan(options)
      : await runAttachmentExtraction(options);
  console.log(JSON.stringify({ ...result, durationMs: Date.now() - startedAt }, null, 2));
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(JSON.stringify({
        code: 'ATTACHMENT_EXTRACTION_COMMAND_FAILED',
        error: error instanceof Error ? error.message : 'Attachment extraction command failed.',
      }));
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
