import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import LibraryNewsWriteForm from '@/components/community/LibraryNewsWriteForm';
import { getCurrentUser } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: '도서관 소식 작성 | 모이라',
  description: '도서관 운영 안내, 행사와 프로그램 소식을 등록합니다.',
};

export default async function LibraryNewsWritePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/community/library-news/write');
  if (user.accountType !== 'LIBRARIAN' && user.accountType !== 'ADMIN') redirect('/community/library-news');

  return (
    <main className="libraryNewsWritePage">
      <div className="libraryNewsWriteShell">
        <nav className="libraryNewsWriteBreadcrumb" aria-label="현재 위치">
          <Link href="/">홈</Link><span aria-hidden="true">›</span>
          <Link href="/community/library-news">도서관 소식</Link><span aria-hidden="true">›</span><strong>글쓰기</strong>
        </nav>
        <header className="libraryNewsWriteHeader">
          <div><p>LIBRARY NEWS</p><h1 id="library-news-write-title">새 소식 등록</h1><span>도서관 운영 안내와 행사 소식을 주민들에게 전해보세요.</span></div>
        </header>
        <LibraryNewsWriteForm />
      </div>
    </main>
  );
}
