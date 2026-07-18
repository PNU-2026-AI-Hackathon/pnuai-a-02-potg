const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const interests = [
  { id: 'reading', name: '독서/인문' },
  { id: 'culture', name: '문화/예술' },
  { id: 'digital', name: '디지털/AI' },
  { id: 'children', name: '아동/가족' },
  { id: 'youth', name: '청소년/진로' },
  { id: 'senior', name: '시니어/복지' },
  { id: 'community', name: '지역참여' },
  { id: 'volunteer', name: '봉사/나눔' },
];

function createPool() {
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

  return new Pool({ connectionString, ssl });
}

async function main() {
  const pool = createPool();
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    for (const interest of interests) {
      await prisma.interest.upsert({
        where: { id: interest.id },
        update: { name: interest.name },
        create: interest,
      });
    }

    console.log(`Seeded ${interests.length} interests.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Interest seed failed:', error);
  process.exit(1);
});
