import type { Metadata } from 'next';
import CommunityBoardView from '@/components/community/CommunityBoardView';
import {
  getCommunityBoard,
  getCommunityPosts,
} from '@/lib/community-boards';

const board = getCommunityBoard('proposals');

export const metadata: Metadata = {
  title: `${board.title} | 모이라`,
  description: board.description,
};

export default function ProposalsBoardPage() {
  return (
    <CommunityBoardView
      board={board}
      posts={getCommunityPosts(board.slug)}
    />
  );
}
