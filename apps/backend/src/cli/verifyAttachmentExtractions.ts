import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Client } from 'pg';
import { runReadOnlyAttachmentVerification } from '../services/attachment/attachmentVerification';

export function parseVerificationArguments(args: string[]) {
  const values: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!['--environment', '--as-of'].includes(option) || !value) {
      throw new Error('--environment and --as-of require values.');
    }
    if (option in values) throw new Error(`Duplicate option: ${option}`);
    values[option] = value;
  }
  if (!['production', 'staging', 'development'].includes(values['--environment'])) {
    throw new Error('--environment production|staging|development is required.');
  }
  const asOf = new Date(values['--as-of']);
  if (!values['--as-of'] || Number.isNaN(asOf.getTime())) {
    throw new Error('--as-of requires an ISO-8601 timestamp for deterministic output.');
  }
  return { environment: values['--environment'], asOf };
}

function connectionConfig() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required.');
  const caPath = path.resolve(process.cwd(), 'global-bundle.pem');
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
  if (!fs.existsSync(caPath)) return { connectionString };
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  return { connectionString: url.toString(), ssl: { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized } };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseVerificationArguments(args);
  const client = new Client(connectionConfig());
  await client.connect();
  try {
    const report = await runReadOnlyAttachmentVerification(client, options.asOf);
    process.stdout.write(`${JSON.stringify({ environment: options.environment, ...report }, null, 2)}\n`);
  } finally {
    await client.end();
  }
}

export function safeVerificationError(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('--environment') || message.startsWith('--as-of') || message.startsWith('Duplicate option:')) {
    return message;
  }
  if (message === 'DATABASE_URL is required.') return message;
  if (message === 'PostgreSQL did not confirm a read-only transaction.') return message;
  return 'Attachment verification failed before a safe report could be produced.';
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({
      code: 'ATTACHMENT_VERIFICATION_FAILED',
      error: safeVerificationError(error),
    }));
    process.exitCode = 1;
  });
}
