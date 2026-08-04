import type { Metadata } from 'next';
import Link from 'next/link';
import FreePostWriteForm from '@/components/community/FreePostWriteForm';

export const metadata: Metadata = {
  title: '게시글 작성 | 자유 게시판 | 모이라',
  description: '자유 게시판에 새로운 글을 작성합니다.',
};

export default function FreePostWritePage() {
  return (
    <main className="communityPage communityWritePage">
      <section className="communityShell" aria-labelledby="free-write-title">
        <nav className="communityBreadcrumb" aria-label="현재 위치">
          <Link href="/">홈</Link>
          <span aria-hidden="true">/</span>
          <Link href="/community/free">자유 게시판</Link>
          <span aria-hidden="true">/</span>
          <span>게시글 작성</span>
        </nav>

        <header className="communityBoardHeader">
          <div>
            <p className="communityEyebrow">자유 게시판</p>
            <h1 id="free-write-title">게시글 작성</h1>
            <p>지역 주민과 나누고 싶은 이야기를 자유롭게 작성해 주세요.</p>
          </div>
        </header>

        <FreePostWriteForm />
      </section>
    </main>
  );
}
