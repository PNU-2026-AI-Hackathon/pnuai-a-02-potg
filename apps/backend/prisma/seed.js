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

const communityPosts = [
  {
    id: 'library-news-1',
    boardSlug: 'library-news',
    type: 'notice',
    title: '7월 작은도서관 운영 시간 변경 안내',
    content: '여름 프로그램 운영으로 7월 한 달간 평일 운영 시간이 오후 8시까지 연장됩니다.',
    author: '모이라 운영팀',
    tags: ['운영 안내', '7월'],
    createdAt: new Date('2026-07-08T09:00:00.000Z'),
  },
  {
    id: 'library-news-2',
    boardSlug: 'library-news',
    type: 'notice',
    title: '금정책마루 작은도서관 내부 공사 안내',
    content: '자료실 조명 교체 공사로 7월 15일부터 17일까지 일부 공간 이용이 제한됩니다.',
    author: '금정책마루 작은도서관',
    tags: ['공사', '이용 제한'],
    createdAt: new Date('2026-07-06T02:30:00.000Z'),
  },
  {
    id: 'library-news-3',
    boardSlug: 'library-news',
    type: 'normal',
    title: '금샘마을 작은도서관 주말 독서 모임 참여자 모집',
    content: '초등 고학년과 보호자가 함께 읽고 이야기하는 주말 독서 모임을 운영합니다.',
    author: '금샘마을 작은도서관',
    tags: ['독서 모임', '모집'],
    createdAt: new Date('2026-07-04T05:20:00.000Z'),
  },
  {
    id: 'library-news-4',
    boardSlug: 'library-news',
    type: 'normal',
    title: '부곡꿈 작은도서관 그림책 원화 전시 소식',
    content: '지역 아동이 함께 감상할 수 있는 그림책 원화 전시가 2층 열린공간에서 진행됩니다.',
    author: '부곡꿈 작은도서관',
    tags: ['전시', '그림책'],
    createdAt: new Date('2026-07-02T01:10:00.000Z'),
  },
  {
    id: 'free-1',
    boardSlug: 'free',
    type: 'notice',
    title: '자유 게시판 이용 안내',
    content: '서로를 존중하는 표현을 사용해 주세요. 개인정보가 포함된 글은 관리자 확인 후 숨김 처리될 수 있습니다.',
    author: '관리자',
    tags: ['공지', '이용 안내'],
    createdAt: new Date('2026-07-08T00:30:00.000Z'),
  },
  {
    id: 'free-2',
    boardSlug: 'free',
    type: 'normal',
    title: '아이와 함께 가기 좋은 작은도서관을 추천해 주세요',
    content: '주말에 미취학 아동과 방문하기 좋은 공간이나 그림책 코너가 있는 곳을 찾고 있습니다.',
    author: '김모이라',
    tags: ['질문', '추천'],
    createdAt: new Date('2026-07-07T04:10:00.000Z'),
  },
  {
    id: 'free-3',
    boardSlug: 'free',
    type: 'normal',
    title: '동네 작은도서관 플리마켓 후기',
    content: '동네 주민들이 직접 만든 물품과 책을 나누는 분위기가 좋았어요. 다음 행사도 기대됩니다.',
    author: '박동네',
    tags: ['후기', '행사'],
    createdAt: new Date('2026-07-05T11:45:00.000Z'),
  },
  {
    id: 'free-4',
    boardSlug: 'free',
    type: 'normal',
    title: '비 오는 날 읽기 좋은 책을 나눠 봐요',
    content: '장마철에 집이나 도서관에서 읽기 좋은 소설, 에세이, 그림책을 서로 추천해 주세요.',
    author: '이책방',
    tags: ['책 추천', '일상'],
    createdAt: new Date('2026-07-03T03:25:00.000Z'),
  },
  {
    id: 'proposals-1',
    boardSlug: 'proposals',
    type: 'notice',
    title: '지역제안 게시판 운영 안내',
    content: '지역 프로그램 아이디어, 생활 불편, 개선 요청을 자유롭게 남겨 주세요. 제안은 검토 후 지역 의제로 활용됩니다.',
    author: '모이라 운영팀',
    tags: ['공지', '운영 안내'],
    createdAt: new Date('2026-07-08T01:00:00.000Z'),
  },
  {
    id: 'proposals-2',
    boardSlug: 'proposals',
    type: 'normal',
    title: '시니어 대상 스마트폰 반복 교육이 필요합니다',
    content: '키오스크, 공동인증서, 모바일 앱 사용을 여러 번 연습할 수 있는 소규모 프로그램을 제안합니다.',
    author: '정금정',
    tags: ['디지털 교육', '시니어'],
    createdAt: new Date('2026-07-07T07:30:00.000Z'),
  },
  {
    id: 'proposals-3',
    boardSlug: 'proposals',
    type: 'normal',
    title: '방과 후 숙제 지원 프로그램을 운영하면 좋겠습니다',
    content: '맞벌이 가정 아이들이 도서관에서 안전하게 머무르며 숙제를 도울 수 있는 시간이 있으면 좋겠습니다.',
    author: '최학부모',
    tags: ['아동', '방과 후'],
    createdAt: new Date('2026-07-05T06:00:00.000Z'),
  },
  {
    id: 'proposals-4',
    boardSlug: 'proposals',
    type: 'normal',
    title: '도서관 주변 분리배출 캠페인을 제안합니다',
    content: '작은도서관을 거점으로 어린이와 주민이 함께 참여하는 자원순환 캠페인을 열면 좋겠습니다.',
    author: '순환지킴이',
    tags: ['환경', '캠페인'],
    createdAt: new Date('2026-07-02T08:40:00.000Z'),
  },
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

    for (const post of communityPosts) {
      await prisma.communityPost.upsert({
        where: { id: post.id },
        update: {
          boardSlug: post.boardSlug,
          type: post.type,
          title: post.title,
          content: post.content,
          author: post.author,
          tags: post.tags,
          createdAt: post.createdAt,
        },
        create: post,
      });
    }

    console.log(`Seeded ${interests.length} interests.`);
    console.log(`Seeded ${communityPosts.length} community posts.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
