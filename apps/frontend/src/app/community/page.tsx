import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getCommunityBoardList,
  getCommunityPosts,
} from '@/lib/community-boards';

export const metadata: Metadata = {
  title: '지역 커뮤니티 | 모이라',
  description: '작은도서관 소식, 자유 게시판, 지역 제안 게시판을 선택하는 지역 커뮤니티 페이지입니다.',
};

export default function CommunityPage() {
  const boards = getCommunityBoardList();

  return (
    <main className="communityPage communityHomePage">
      <section className="communityShell" aria-labelledby="community-title">
        <nav className="communityBreadcrumb" aria-label="현재 위치">
          <Link href="/">홈</Link>
          <span aria-hidden="true">/</span>
          <span>지역 커뮤니티</span>
        </nav>

        <header className="communityBoardHeader">
          <div>
            <p className="communityEyebrow">지역 커뮤니티</p>
            <h1 id="community-title">지역 커뮤니티 게시판</h1>
            <p>
              작은도서관 행사와 소식, 주민 자유 소통, 지역 제안을 목적별 게시판에서
              확인합니다.
            </p>
          </div>
        </header>

        <section className="communityBoardGrid" aria-label="지역 커뮤니티 게시판 목록">
          {boards.map((board) => {
            const posts = getCommunityPosts(board.slug);
            const noticeCount = posts.filter((post) => post.type === 'notice').length;
            const normalCount = posts.length - noticeCount;

            return (
              <article className="communityBoardCard" key={board.slug}>
                <div>
                  <p className="communityBoardCardLabel">{board.shortTitle}</p>
                  <h2>{board.title}</h2>
                  <p>{board.description}</p>
                </div>

                <div className="communityPostMetaRow" aria-label={`${board.shortTitle} 태그`}>
                  {board.tags.map((tag) => (
                    <span className="communityPostTag" key={`${board.slug}-${tag}`}>
                      {tag}
                    </span>
                  ))}
                </div>

                <dl className="communityBoardCardStats">
                  <div>
                    <dt>공지</dt>
                    <dd>{noticeCount}건</dd>
                  </div>
                  <div>
                    <dt>{board.typeLabels.normal}</dt>
                    <dd>{normalCount}건</dd>
                  </div>
                </dl>

                <Link className="communityPrimaryLink" href={board.href}>
                  게시판 보기
                </Link>
              </article>
            );
          })}
        </section>
      </section>
    </main>
  );
}
