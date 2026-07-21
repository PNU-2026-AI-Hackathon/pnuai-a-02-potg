import { prisma } from '../lib/prisma';
import { runAttachmentExtraction, RunAttachmentExtractionOptions } from '../services/attachment/attachmentExtractionService';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 20;

function valueAfter(args: string[], index: number, option: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
  return value;
}

export function parseExtractionArguments(args: string[]): RunAttachmentExtractionOptions {
  const options: RunAttachmentExtractionOptions = {
    type: 'PDF',
    limit: DEFAULT_LIMIT,
    retryFailed: false,
    dryRun: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--type') {
      const value = valueAfter(args, index, argument).toUpperCase();
      if (value !== 'PDF') throw new Error('Only --type PDF is supported.');
      options.type = 'PDF';
      index += 1;
    } else if (argument === '--limit') {
      const value = Number(valueAfter(args, index, argument));
      if (!Number.isSafeInteger(value) || value < 1 || value > MAX_LIMIT) {
        throw new Error(`--limit must be an integer from 1 to ${MAX_LIMIT}.`);
      }
      options.limit = value;
      index += 1;
    } else if (argument === '--attachment-id') {
      options.attachmentId = valueAfter(args, index, argument);
      index += 1;
    } else if (argument === '--retry-failed') {
      options.retryFailed = true;
    } else if (argument === '--dry-run') {
      options.dryRun = true;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }
  return options;
}

export async function main(args = process.argv.slice(2)) {
  const options = parseExtractionArguments(args);
  const startedAt = Date.now();
  const result = await runAttachmentExtraction(options);
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
