import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool, PoolClient } from 'pg';
import { HwpAttachmentRow } from './hwpAttachmentAnalysisService';

type QueryRow = {
  id: string;
  programCaseId: string;
  fileName: string;
  fileUrl: string;
  fileType: string | null;
  extractionStatus: string;
  extractorType: string | null;
  rawTextPresent: boolean;
  cleanedTextPresent: boolean;
};

function pool() {
  let connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required.');
  const caPath = path.resolve(process.cwd(), 'global-bundle.pem');
  const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
  const ssl = fs.existsSync(caPath) ? { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized } : undefined;
  if (ssl) {
    const url = new URL(connectionString);
    url.searchParams.delete('sslmode');
    connectionString = url.toString();
  }
  return new Pool({ connectionString, ssl, max: 1 });
}

async function selectRows(client: PoolClient, options: { attachmentId?: string; limit?: number }) {
  const parameters: unknown[] = [];
  const clauses = ['"isActive" = TRUE', 'UPPER(COALESCE("fileType", \'\')) IN (\'HWP\', \'HWPX\')'];
  if (options.attachmentId) {
    parameters.push(options.attachmentId);
    clauses.push(`"id" = $${parameters.length}`);
  }
  let limit = '';
  if (options.limit) {
    parameters.push(options.limit);
    limit = ` LIMIT $${parameters.length}`;
  }
  const query = `
    SELECT
      "id", "programCaseId", "fileName", "fileUrl", "fileType",
      "extractionStatus"::text AS "extractionStatus", "extractorType",
      ("rawText" IS NOT NULL) AS "rawTextPresent",
      ("cleanedText" IS NOT NULL) AS "cleanedTextPresent"
    FROM "ProgramCaseAttachment"
    WHERE ${clauses.join(' AND ')}
    ORDER BY "createdAt" ASC, "id" ASC${limit}
  `;
  return (await client.query<QueryRow>(query, parameters)).rows;
}

export async function readHwpAttachmentRows(options: { attachmentId?: string; limit?: number }): Promise<HwpAttachmentRow[]> {
  const database = pool();
  const client = await database.connect();
  try {
    await client.query('BEGIN TRANSACTION READ ONLY');
    const rows = await selectRows(client, options);
    await client.query('COMMIT');
    return rows;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await database.end();
  }
}
