const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

dotenv.config();

const expectedInterests = [
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
  const email = `interest-verify-${Date.now()}@example.com`;

  try {
    const interests = await prisma.interest.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, name: true },
    });
    const interestMap = new Map(interests.map((interest) => [interest.id, interest.name]));
    const missingInterests = expectedInterests.filter(
      (interest) => interestMap.get(interest.id) !== interest.name,
    );

    if (missingInterests.length > 0) {
      throw new Error(
        `Missing or mismatched interests: ${missingInterests
          .map((interest) => interest.id)
          .join(', ')}`,
      );
    }

    const user = await prisma.user.create({
      data: {
        userId: `interest-verify-${Date.now()}`,
        name: 'Interest Verification User',
        email,
        password: 'verification-only',
        interests: {
          create: [
            { interestId: 'reading' },
            { interestId: 'community' },
          ],
        },
      },
      select: { id: true },
    });

    const savedUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        interests: {
          orderBy: { interestId: 'asc' },
          select: {
            interest: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });
    const savedInterestIds = savedUser.interests.map(({ interest }) => interest.id);

    if (savedInterestIds.join(',') !== 'community,reading') {
      throw new Error(`Unexpected saved interests: ${savedInterestIds.join(', ')}`);
    }

    await prisma.user.delete({ where: { id: user.id } });
    console.log('Interest database verification passed.');
  } finally {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Interest database verification failed:', error);
  process.exit(1);
});
