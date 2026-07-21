import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const caPath = path.resolve(process.cwd(), process.env.DATABASE_SSL_CA_PATH || 'global-bundle.pem');
const ssl = fs.existsSync(caPath)
  ? {
      ca: fs.readFileSync(caPath, 'utf8'),
      rejectUnauthorized: true,
    }
  : false;

const pool = new Pool({
  connectionString,
  ssl,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
});
