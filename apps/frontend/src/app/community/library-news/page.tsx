import type { Metadata } from 'next';
import CommunityBoardView from '@/components/community/CommunityBoardView';
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
  const posts = await getCommunityPosts(board.slug);

  return (
    <CommunityBoardView
      board={board}
      posts={posts}
    />
  );
}
