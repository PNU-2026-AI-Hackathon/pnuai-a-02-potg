import type { Metadata } from 'next';
import { Suspense } from 'react';
import IdeaThreadBoard from '@/components/ideas/IdeaThreadBoard';

export const metadata: Metadata = {
  title: '우리동네 아이디어 | 모이라',
  description: '시민의 제안이 대화로 자라는 아이디어 게시판입니다.',
};

export default function IdeasPage() {
  // 게시판이 `?pick=studio`를 읽어 고르는 화면으로 열린다. 주소를 읽으려면 이 경계가 필요하다.
  return (
    <Suspense fallback={<p className="threadLoadState" role="status">아이디어를 불러오는 중입니다…</p>}>
      <IdeaThreadBoard />
    </Suspense>
  );
}
