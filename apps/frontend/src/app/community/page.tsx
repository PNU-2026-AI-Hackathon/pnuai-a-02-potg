import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: '지역 커뮤니티 | 모이라',
  description: '지역 커뮤니티 게시판 기본 진입 페이지입니다.',
};

export default function CommunityPage() {
  redirect('/community/library-news');
}
