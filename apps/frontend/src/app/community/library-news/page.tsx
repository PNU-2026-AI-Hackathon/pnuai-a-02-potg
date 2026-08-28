import type { Metadata } from 'next';
import LibraryNewsBoard from '@/components/community/LibraryNewsBoard';
import { getCurrentUser } from '@/lib/server-auth';
import {
  getCommunityBoard,
  getCommunityPosts,
} from '@/lib/community-boards';

const board = getCommunityBoard('library-news');

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: `${board.title} | 모이라`,
  description: board.description,
};

export default async function LibraryNewsBoardPage() {
  const [posts, user] = await Promise.all([getCommunityPosts(board.slug), getCurrentUser()]);

  return (
    <LibraryNewsBoard
      board={board}
      posts={posts}
      user={user}
    />
  );
}
