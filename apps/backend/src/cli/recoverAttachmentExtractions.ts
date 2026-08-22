import { prisma } from '../lib/prisma';
import { RecoveryOptions, runAttachmentRecovery } from '../services/attachment/attachmentRecoveryService';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseRecoveryArguments(args: string[]): RecoveryOptions {
  const values: Record<string, string | boolean> = {};
  const valued = new Set(['--type', '--stale-after-minutes', '--limit', '--attachment-id']);
  const flags = new Set(['--mixed-only', '--plan', '--apply']);
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (!valued.has(option) && !flags.has(option)) throw new Error(`Unknown option: ${option}`);
    if (option in values) throw new Error(`Duplicate option: ${option}`);
    if (valued.has(option)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
      values[option] = value;
    } else values[option] = true;
  }
  if (String(values['--type'] ?? '').toUpperCase() !== 'PDF_OCR' || values['--mixed-only'] !== true) {
    throw new Error('Recovery currently supports only --type PDF_OCR --mixed-only.');
  }
  const plan = values['--plan'] === true;
  const apply = values['--apply'] === true;
  if (plan === apply) throw new Error('Exactly one of --plan or --apply is required.');
  const staleAfterMinutes = values['--stale-after-minutes'] === undefined ? 60 : Number(values['--stale-after-minutes']);
  const limit = values['--limit'] === undefined ? 20 : Number(values['--limit']);
  if (!Number.isSafeInteger(staleAfterMinutes) || staleAfterMinutes < 15 || staleAfterMinutes > 1440) {
    throw new Error('--stale-after-minutes must be an integer between 15 and 1440.');
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('--limit must be an integer between 1 and 100.');
  const attachmentId = values['--attachment-id'] ? String(values['--attachment-id']) : undefined;
  if (attachmentId && !UUID.test(attachmentId)) throw new Error('--attachment-id must be a UUID.');
  return {
    type: 'PDF_OCR', mixedOnly: true, staleAfterMinutes, limit,
    ...(attachmentId ? { attachmentId } : {}), mode: plan ? 'plan' : 'apply',
  };
}

async function main() {
  console.log(JSON.stringify(await runAttachmentRecovery(parseRecoveryArguments(process.argv.slice(2))), null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ code: 'ATTACHMENT_RECOVERY_FAILED', error: error instanceof Error ? error.message : 'Recovery failed.' }));
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
}
