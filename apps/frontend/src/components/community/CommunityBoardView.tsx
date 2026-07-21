import Link from 'next/link';
import type { CommunityBoard, CommunityPost } from '@/lib/community-boards';

type CommunityBoardViewProps = {
  board: CommunityBoard;
  posts: CommunityPost[];
};

type CommunityPostCardProps = {
  board: CommunityBoard;
  post: CommunityPost;
};

const boardTabs = [
  { href: '/community/library-news', label: '도서관 소식', slug: 'library-news' },
  { href: '/community/proposals', label: '우리동네 의제', slug: 'proposals' },
  { href: '/community/free', label: '동네 광장', slug: 'free' },
] as const;

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function getOrderedPosts(posts: CommunityPost[]) {
  return [...posts].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'notice' ? -1 : 1;
    }

    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  });
}

export default function CommunityBoardView({
  board,
  posts,
}: CommunityBoardViewProps) {
  const orderedPosts = getOrderedPosts(posts);
  const noticeCount = posts.filter((post) => post.type === 'notice').length;
  const normalCount = posts.length - noticeCount;

  return (
    <main className="communityPage communityBoardPage">
      <section className="uiContainer communityShell" aria-labelledby={`${board.slug}-title`}>
        <nav className="communityBreadcrumb" aria-label="현재 위치">
          <Link href="/">홈</Link>
          <span aria-hidden="true">/</span>
          <span>지역 커뮤니티</span>
          <span aria-hidden="true">/</span>
          <span>{board.shortTitle}</span>
        </nav>

        <nav className="communityBoardTabs" aria-label="커뮤니티 게시판">
          {boardTabs.map((tab) => (
            <Link
              className={tab.slug === board.slug ? 'active' : undefined}
              href={tab.href}
              key={tab.slug}
              aria-current={tab.slug === board.slug ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <header className="communityBoardHeader">
          <div>
            <p className="uiEyebrow communityEyebrow">우리동네 이야기</p>
            <h1 id={`${board.slug}-title`}>{board.title}</h1>
            <p>{board.description}</p>
          </div>
        </header>

        <section className="communityBoardNotice" aria-label="게시판 설명">
          <span className="communityNoticeIcon" aria-hidden="true">✦</span>
          <p>{board.purpose}</p>
        </section>

        <section className="communityPostSection" aria-labelledby={`${board.slug}-posts`}>
          <div className="communityBoardControls" aria-label="게시판 상태">
            <p>
              총 <strong>{posts.length}</strong>건
              <span aria-hidden="true"> / </span>
              공지 <strong>{noticeCount}</strong>건
              <span aria-hidden="true"> / </span>
              {board.typeLabels.normal} <strong>{normalCount}</strong>건
            </p>
            {board.slug === 'free' ? (
              <Link
                className="uiButton uiButtonPrimary communityWriteButton"
                href="/community/free/write"
                target="_blank"
                rel="noopener noreferrer"
              >
                게시글 작성 <span aria-hidden="true">→</span>
              </Link>
            ) : null}
          </div>

          <div className="communityPostList">
            {orderedPosts.length > 0 ? (
              <table className="communityPostTable">
                <caption>{board.title} 게시글 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">제목</th>
                    <th scope="col">작성자</th>
                    <th scope="col">작성일</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedPosts.map((post) => (
                    <CommunityPostCard
                      board={board}
                      key={post.id}
                      post={post}
                    />
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="communityEmptyState">등록된 게시글이 없습니다.</p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function CommunityPostCard({ board, post }: CommunityPostCardProps) {
  return (
    <tr className={`communityPostRow ${post.type === 'notice' ? 'isNotice' : ''}`}>
      <td className="communityPostBody">
        <div className="communityPostTitleLine">
          {post.type === 'notice' ? (
            <span className="uiTag uiTagAccent communityPostType">
              {board.typeLabels.notice}
            </span>
          ) : (
            <span className="communityPostTitleIcon" aria-hidden="true">
              <svg viewBox="0 0 20 20">
                <path d="M6.5 3.5h5l3 3v10h-8a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z" />
                <path d="M11.5 3.5v3h3M7.5 10h4M7.5 13h4" />
              </svg>
            </span>
          )}
          <h3>{post.title}</h3>
        </div>
        <p>{post.content}</p>
        <div className="communityPostMetaRow" aria-label="게시글 태그">
          {post.tags.map((tag) => (
            <span className="uiTag communityPostTag" key={`${post.id}-${tag}`}>
              {tag}
            </span>
          ))}
        </div>
        <div className="communityPostMobileMeta">
          <span>{post.author}</span>
          <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
        </div>
      </td>
      <td className="communityPostAuthor">{post.author}</td>
      <td className="communityPostDate">
        <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
      </td>
    </tr>
  );
}
