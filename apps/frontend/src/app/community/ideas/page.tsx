import type { Metadata } from 'next';
import IdeaThreadBoard from '@/components/ideas/IdeaThreadBoard';

export const metadata: Metadata = {
  title: '함께 만드는 행사 | 모이라',
  description: '시민의 제안이 대화로 자라는 아이디어 게시판입니다.',
};

export default function IdeasPage() {
  return <IdeaThreadBoard />;
}
