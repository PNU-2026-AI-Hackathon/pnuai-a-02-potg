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
  /**
   * 의제 글. 스튜디오 의제 선택창이 이 게시판을 읽으므로, 백엔드가 멈췄을 때
   * 선택창이 텅 비지 않도록 목 데이터에도 의제가 있어야 한다.
   */
  {
    id: 'ideas-1',
    boardSlug: 'ideas',
    type: 'normal',
    title: '시니어 대상 스마트폰 반복 교육이 필요합니다',
    content:
      '키오스크, 공공앱, 모바일 은행 사용을 여러 번 연습할 수 있는 소규모 프로그램을 제안합니다.',
    author: '박이웃',
    createdAt: '2026-07-09T02:00:00.000Z',
    tags: ['생활', '시니어'],
  },
  {
    id: 'ideas-2',
    boardSlug: 'ideas',
    type: 'normal',
    title: '방과후 숙제 도움 프로그램을 운영하면 좋겠습니다',
    content:
      '맞벌이 가정 아이들이 도서관에서 안전하게 머물며 숙제를 도울 수 있는 시간이 있으면 좋겠습니다.',
    author: '김돌봄',
    createdAt: '2026-07-08T06:40:00.000Z',
    tags: ['책·배움', '아동'],
  },
  {
    id: 'ideas-3',
    boardSlug: 'ideas',
    type: 'normal',
    title: '도서관 주변 분리배출 캠페인을 제안합니다',
    content:
      '작은도서관을 거점으로 어린이와 주민이 함께 참여하는 자원순환 캠페인을 열면 좋겠습니다.',
    author: '이초록',
    createdAt: '2026-07-06T08:15:00.000Z',
    tags: ['환경', '캠페인'],
  },
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

/**
 * 글 하나만 가져온다. 스튜디오가 `?agenda=<글id>`로 넘어왔을 때 그 글을 되찾는 데 쓴다.
 * 게시판에서 고른 글이 목록 상위에 없을 수도 있어, 목록과 별개로 읽을 길이 필요하다.
 */
export async function getCommunityPost(postId: string) {
  try {
    const response = await fetch(getBackendUrl(`/api/posts/${encodeURIComponent(postId)}`), {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    const post = (data as { post?: unknown } | null)?.post;

    return isCommunityPost(post) ? post : null;
  } catch (error) {
    console.error('Community post request failed:', error);
    return null;
  }
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
