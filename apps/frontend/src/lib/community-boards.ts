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
  likeCount: number;
  commentCount: number;
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
    title: '도서관 행사 및 소식 게시판',
    shortTitle: '도서관 소식',
    description: '도서관 운영 안내, 행사, 프로그램 소식을 공유하는 게시판입니다.',
    purpose: '휴관, 공사, 운영 시간 변경, 프로그램 모집 등 도서관 이용에 필요한 정보를 확인합니다.',
    typeLabels: {
      notice: '공지',
      normal: '일반 글',
    },
    tags: ['행사', '운영 안내', '프로그램'],
  },
};

export function getCommunityBoard(slug: CommunityBoardSlug) {
  return communityBoards[slug];
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
    post.tags.every((tag) => typeof tag === 'string') &&
    typeof post.likeCount === 'number' &&
    typeof post.commentCount === 'number'
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
      return [];
    }

    const data: unknown = await response.json();

    if (!data || typeof data !== 'object' || !Array.isArray((data as Record<string, unknown>).posts)) {
      return [];
    }

    const posts = (data as { posts: unknown[] }).posts.filter(
      (post): post is CommunityPost => isCommunityPost(post) && post.boardSlug === slug,
    );

    return posts;
  } catch (error) {
    console.error('Community posts request failed:', error);
    return [];
  }
}

export async function getPopularIdeaPosts(limit = 3) {
  try {
    const params = new URLSearchParams({
      boardSlug: 'ideas',
      sort: 'likes',
      limit: String(limit),
    });
    const response = await fetch(getBackendUrl(`/api/posts?${params.toString()}`), {
      cache: 'no-store',
    });

    if (!response.ok) return [];

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !Array.isArray((data as Record<string, unknown>).posts)) {
      return [];
    }

    return (data as { posts: unknown[] }).posts.filter(
      (post): post is CommunityPost => isCommunityPost(post) && post.boardSlug === 'ideas',
    );
  } catch (error) {
    console.error('Popular idea request failed:', error);
    return [];
  }
}
