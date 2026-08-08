import { getBackendUrl } from './backend-url';

export type CommunityBoardSlug = 'library-news' | 'free' | 'ideas';

export type CommunityPostType = 'notice' | 'normal';

export type CommunityBoard = {
  slug: CommunityBoardSlug;
  href: `/community/${CommunityBoardSlug}`;
  title: string;
  shortTitle: string;
  description: string;
  purpose: string;
  typeLabels: Record<CommunityPostType, string>;
  tags: string[];
};

export type CommunityPost = {
  id: string;
  boardSlug: CommunityBoardSlug;
  type: CommunityPostType;
  title: string;
  content: string;
  author: string;
  createdAt: string;
  tags: string[];
};

export const communityBoards: Record<CommunityBoardSlug, CommunityBoard> = {
  ideas: {
    slug: 'ideas',
    href: '/community/ideas',
    title: '함께 만드는 행사',
    shortTitle: '아이디어 게시판',
    description: '시민이 행사 아이디어를 제안하고 대화로 함께 발전시키는 게시판입니다.',
    purpose: '아이디어에 의견과 답글을 보태 실행 가능한 지역 행사로 구체화합니다.',
    typeLabels: {
      notice: '공지',
      normal: '아이디어',
    },
    tags: ['문화·예술', '책·배움', '환경', '생활'],
  },
  'library-news': {
    slug: 'library-news',
    href: '/community/library-news',
    title: '작은도서관 행사 및 소식 게시판',
    shortTitle: '도서관 소식',
    description: '작은도서관 운영 안내, 행사, 프로그램 소식을 공유하는 게시판입니다.',
    purpose: '휴관, 공사, 운영 시간 변경, 프로그램 모집 등 도서관 이용에 필요한 정보를 확인합니다.',
    typeLabels: {
      notice: '공지',
      normal: '일반 글',
    },
    tags: ['행사', '운영 안내', '프로그램'],
  },
  free: {
    slug: 'free',
    href: '/community/free',
    title: '자유 게시판',
    shortTitle: '자유 게시판',
    description: '지역 주민이 일상 이야기와 생활 정보를 자유롭게 나누는 게시판입니다.',
    purpose: '주민 간 소통, 정보 공유, 모이라 운영진 안내를 한곳에서 확인합니다.',
    typeLabels: {
      notice: '공지',
      normal: '일반 글',
    },
    tags: ['소통', '정보 공유', '동네 이야기'],
  },
};

export const communityPosts: CommunityPost[] = [
  {
    id: 'library-news-1',
    boardSlug: 'library-news',
    type: 'notice',
    title: '7월 작은도서관 운영 시간 변경 안내',
    content:
      '여름 프로그램 운영으로 7월 한 달간 평일 운영 시간이 오후 8시까지 연장됩니다.',
    author: '모이라 운영팀',
    createdAt: '2026-07-08T09:00:00.000Z',
    tags: ['운영 안내', '7월'],
  },
  {
    id: 'library-news-2',
    boardSlug: 'library-news',
    type: 'notice',
    title: '장전책마을 작은도서관 내부 공사 안내',
    content:
      '자료실 조명 교체 공사로 7월 15일부터 17일까지 일부 공간 이용이 제한됩니다.',
    author: '장전책마을 작은도서관',
    createdAt: '2026-07-06T02:30:00.000Z',
    tags: ['공사', '이용 제한'],
  },
  {
    id: 'library-news-3',
    boardSlug: 'library-news',
    type: 'normal',
    title: '금샘마을 작은도서관 주말 독서 모임 참가자 모집',
    content:
      '초등 고학년과 보호자가 함께 읽고 이야기하는 주말 독서 모임을 운영합니다.',
    author: '금샘마을 작은도서관',
    createdAt: '2026-07-04T05:20:00.000Z',
    tags: ['독서 모임', '모집'],
  },
  {
    id: 'library-news-4',
    boardSlug: 'library-news',
    type: 'normal',
    title: '부곡꿈 작은도서관 그림책 원화 전시 소식',
    content:
      '지역 아동이 함께 감상할 수 있는 그림책 원화 전시가 2층 열린공간에서 진행됩니다.',
    author: '부곡꿈 작은도서관',
    createdAt: '2026-07-02T01:10:00.000Z',
    tags: ['전시', '그림책'],
  },
  {
    id: 'free-1',
    boardSlug: 'free',
    type: 'notice',
    title: '자유 게시판 이용 안내',
    content:
      '서로를 존중하는 표현을 사용해 주세요. 개인정보가 포함된 글은 관리자 확인 후 숨김 처리될 수 있습니다.',
    author: '관리자',
    createdAt: '2026-07-08T00:30:00.000Z',
    tags: ['공지', '이용 안내'],
  },
  {
    id: 'free-2',
    boardSlug: 'free',
    type: 'normal',
    title: '아이와 함께 가기 좋은 작은도서관을 추천해 주세요',
    content:
      '주말에 미취학 아동과 방문하기 좋은 공간이나 그림책 코너가 있는 곳을 찾고 있습니다.',
    author: '김모이라',
    createdAt: '2026-07-07T04:10:00.000Z',
    tags: ['질문', '추천'],
  },
  {
    id: 'free-3',
    boardSlug: 'free',
    type: 'normal',
    title: '서동누리 작은도서관 앞 플리마켓 후기',
    content:
      '동네 주민들이 직접 만든 물품과 책을 나누는 분위기가 좋아서 다음 행사도 기대됩니다.',
    author: '박동네',
    createdAt: '2026-07-05T11:45:00.000Z',
    tags: ['후기', '행사'],
  },
  {
    id: 'free-4',
    boardSlug: 'free',
    type: 'normal',
    title: '비 오는 날 읽기 좋은 책을 나눠 봐요',
    content:
      '장마철에 집이나 도서관에서 읽기 좋은 소설, 에세이, 그림책을 서로 추천해 주세요.',
    author: '이책방',
    createdAt: '2026-07-03T03:25:00.000Z',
    tags: ['책 추천', '일상'],
  },
];

export function getCommunityBoard(slug: CommunityBoardSlug) {
  return communityBoards[slug];
}

function getMockCommunityPosts(slug: CommunityBoardSlug) {
  return communityPosts
    .filter((post) => post.boardSlug === slug)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function isCommunityPost(value: unknown): value is CommunityPost {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const post = value as Record<string, unknown>;

  return (
    typeof post.id === 'string' &&
    (post.boardSlug === 'library-news' || post.boardSlug === 'free' || post.boardSlug === 'ideas') &&
    (post.type === 'notice' || post.type === 'normal') &&
    typeof post.title === 'string' &&
    typeof post.content === 'string' &&
    typeof post.author === 'string' &&
    typeof post.createdAt === 'string' &&
    Array.isArray(post.tags) &&
    post.tags.every((tag) => typeof tag === 'string')
  );
}

export async function getCommunityPosts(slug: CommunityBoardSlug) {
  try {
    const params = new URLSearchParams({ boardSlug: slug });
    const response = await fetch(getBackendUrl(`/api/posts?${params.toString()}`), {
      cache: 'no-store',
    });

    if (!response.ok) {
      return getMockCommunityPosts(slug);
    }

    const data: unknown = await response.json();

    if (!data || typeof data !== 'object' || !Array.isArray((data as Record<string, unknown>).posts)) {
      return getMockCommunityPosts(slug);
    }

    const posts = (data as { posts: unknown[] }).posts.filter(
      (post): post is CommunityPost => isCommunityPost(post) && post.boardSlug === slug,
    );

    return posts.length > 0 ? posts : getMockCommunityPosts(slug);
  } catch (error) {
    console.error('Community posts request failed:', error);
    return getMockCommunityPosts(slug);
  }
}
