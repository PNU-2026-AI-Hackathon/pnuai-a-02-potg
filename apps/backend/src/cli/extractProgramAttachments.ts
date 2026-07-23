import { prisma } from '../lib/prisma';
import { runAttachmentExtraction, RunAttachmentExtractionOptions } from '../services/attachment/attachmentExtractionService';
import { ImageOcrRunOptions, runImageOcr } from '../services/attachment/imageOcrDryRunService';

type ExtractionArguments = RunAttachmentExtractionOptions | ImageOcrRunOptions;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function valueAfter(args: string[], index: number, option: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
  return value;
}

export function parseExtractionArguments(args: string[]): ExtractionArguments {
  const values: Record<string, string | boolean> = {};
  const valueOptions = new Set(['--type', '--limit', '--attachment-id']);
  const flagOptions = new Set(['--retry-failed', '--dry-run', '--plan']);
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
  if (type !== 'PDF' && type !== 'IMAGE') throw new Error('Only --type PDF or IMAGE is supported.');
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
