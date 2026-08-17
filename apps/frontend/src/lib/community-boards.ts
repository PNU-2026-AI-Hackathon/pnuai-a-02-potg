import { getBackendUrl } from './backend-url';

export type CommunityBoardSlug = 'library-news' | 'ideas';

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
    title: '우리동네 아이디어',
    shortTitle: '우리동네 아이디어',
    description: '시민이 지역 아이디어를 제안하고 함께 발전시키는 게시판입니다.',
    purpose: '아이디어에 의견과 답글을 보태 실행 가능한 지역 프로그램과 행사로 구체화합니다.',
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
    (post.boardSlug === 'library-news' || post.boardSlug === 'ideas') &&
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
