import type { Metadata } from 'next';
import CommunityBoardView from '@/components/community/CommunityBoardView';
import {
  getCommunityBoard,
  getCommunityBoardList,
  getCommunityPosts,
} from '@/lib/community-boards';

const board = getCommunityBoard('free');

export const metadata: Metadata = {
  title: `${board.title} | 모이라`,
  description: board.description,
};

export default function FreeBoardPage() {
  return (
    <CommunityBoardView
      board={board}
      boardLinks={getCommunityBoardList()}
      posts={getCommunityPosts(board.slug)}
    />
  );
}
