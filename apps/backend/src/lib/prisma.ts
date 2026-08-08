import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

let connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const caPath = path.resolve(process.cwd(), 'global-bundle.pem');
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
const ssl = fs.existsSync(caPath)
  ? { ca: fs.readFileSync(caPath, 'utf8'), rejectUnauthorized }
  : undefined;

if (ssl) {
  const url = new URL(connectionString);
  url.searchParams.delete('sslmode');
  connectionString = url.toString();
}

const pool = new Pool({
  connectionString,
  ssl,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});
