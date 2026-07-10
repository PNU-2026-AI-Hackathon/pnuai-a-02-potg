import Link from 'next/link';
import type {
  CommunityBoard,
  CommunityPost,
  CommunityPostType,
} from '@/lib/community-boards';

type CommunityBoardViewProps = {
  board: CommunityBoard;
  posts: CommunityPost[];
  boardLinks?: CommunityBoard[];
};

type CommunityPostSectionProps = {
  board: CommunityBoard;
  posts: CommunityPost[];
  type: CommunityPostType;
};

type CommunityPostCardProps = {
  board: CommunityBoard;
  post: CommunityPost;
};

const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
});

const emptyText: Record<CommunityPostType, string> = {
  notice: '등록된 공지가 없습니다.',
  normal: '등록된 일반 글이 없습니다.',
};

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function getPostsByType(posts: CommunityPost[], type: CommunityPostType) {
  return posts.filter((post) => post.type === type);
}

export default function CommunityBoardView({
  board,
  posts,
  boardLinks = [],
}: CommunityBoardViewProps) {
  const noticePosts = getPostsByType(posts, 'notice');
  const normalPosts = getPostsByType(posts, 'normal');

  return (
    <main className="communityPage communityBoardPage">
      <section className="communityShell" aria-labelledby={`${board.slug}-title`}>
        <nav className="communityBreadcrumb" aria-label="현재 위치">
          <Link href="/">홈</Link>
          <span aria-hidden="true">/</span>
          <Link href="/community">지역 커뮤니티</Link>
        </nav>

        <header className="communityBoardHeader">
          <div>
            <p className="communityEyebrow">지역 커뮤니티</p>
            <h1 id={`${board.slug}-title`}>{board.title}</h1>
            <p>{board.description}</p>
          </div>
          <Link className="communityPrimaryLink" href="/community">
            게시판 선택
          </Link>
        </header>

        <section className="communityBoardSummary" aria-label="게시판 요약">
          <div>
            <p className="communitySummaryLabel">운영 목적</p>
            <p>{board.purpose}</p>
          </div>
          <dl>
            <div>
              <dt>공지</dt>
              <dd>{noticePosts.length}건</dd>
            </div>
            <div>
              <dt>{board.typeLabels.normal}</dt>
              <dd>{normalPosts.length}건</dd>
            </div>
          </dl>
        </section>

        {boardLinks.length > 0 ? (
          <nav className="communityBoardTabs" aria-label="지역 커뮤니티 게시판">
            {boardLinks.map((item) => (
              <Link
                className={item.slug === board.slug ? 'active' : undefined}
                href={item.href}
                key={item.slug}
              >
                {item.shortTitle}
              </Link>
            ))}
          </nav>
        ) : null}

        <CommunityPostSection board={board} posts={noticePosts} type="notice" />
        <CommunityPostSection board={board} posts={normalPosts} type="normal" />
      </section>
    </main>
  );
}

function CommunityPostSection({ board, posts, type }: CommunityPostSectionProps) {
  const sectionId = `${board.slug}-${type}-posts`;

  return (
    <section
      className={`communityPostSection communityPostSection-${type}`}
      aria-labelledby={sectionId}
    >
      <div className="communitySectionHeader">
        <h2 id={sectionId}>{board.typeLabels[type]}</h2>
        <span>{posts.length}건</span>
      </div>

      <div className="communityPostList">
        {posts.length > 0 ? (
          posts.map((post) => <CommunityPostCard board={board} key={post.id} post={post} />)
        ) : (
          <p className="communityEmptyState">{emptyText[type]}</p>
        )}
      </div>
    </section>
  );
}

function CommunityPostCard({ board, post }: CommunityPostCardProps) {
  return (
    <article className={`communityPostCard ${post.type === 'notice' ? 'isNotice' : ''}`}>
      <div className="communityPostMetaRow">
        <span className="communityPostType">{board.typeLabels[post.type]}</span>
        {post.tags.map((tag) => (
          <span className="communityPostTag" key={`${post.id}-${tag}`}>
            {tag}
          </span>
        ))}
      </div>

      <div className="communityPostBody">
        <h3>{post.title}</h3>
        <p>{post.content}</p>
      </div>

      <footer className="communityPostFooter">
        <span>{post.author}</span>
        <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
      </footer>
    </article>
  );
}
