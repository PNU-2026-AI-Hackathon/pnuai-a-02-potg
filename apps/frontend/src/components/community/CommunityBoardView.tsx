'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { CommunityBoard, CommunityPost } from '@/lib/community-boards';

type CommunityBoardViewProps = {
  board: CommunityBoard;
  posts: CommunityPost[];
};

type CommunityPostCardProps = {
  board: CommunityBoard;
  number: string;
  post: CommunityPost;
};

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

function getUniquePosts(posts: CommunityPost[]) {
  const uniquePosts = new Map<string, CommunityPost>();

  posts.forEach((post) => {
    uniquePosts.set(post.id, post);
  });

  return Array.from(uniquePosts.values());
}

export default function CommunityBoardView({
  board,
  posts,
}: CommunityBoardViewProps) {
  const [createdPosts, setCreatedPosts] = useState<CommunityPost[]>([]);
  const [loadMessage, setLoadMessage] = useState('');
  const visiblePosts = getUniquePosts([...posts, ...createdPosts]);
  const orderedPosts = getOrderedPosts(visiblePosts);
  const noticeCount = visiblePosts.filter((post) => post.type === 'notice').length;
  const normalCount = visiblePosts.length - noticeCount;

  useEffect(() => {
    if (board.slug !== 'free') return;

    fetch('/api/posts?boardSlug=free', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || '작성된 글을 불러오지 못했습니다.');
        setCreatedPosts(data.posts || []);
      })
      .catch(() => setLoadMessage('새로 작성된 글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'));
  }, [board.slug]);

  return (
    <main className="communityPage communityBoardPage">
      <section className="communityShell" aria-labelledby={`${board.slug}-title`}>
        <nav className="communityBreadcrumb" aria-label="현재 위치">
          <Link href="/">홈</Link>
          <span aria-hidden="true">/</span>
          <span>지역 커뮤니티</span>
          <span aria-hidden="true">/</span>
          <span>{board.shortTitle}</span>
        </nav>

        <header className="communityBoardHeader">
          <div>
            <p className="communityEyebrow">지역 커뮤니티</p>
            <h1 id={`${board.slug}-title`}>{board.title}</h1>
            <p>{board.description}</p>
          </div>
        </header>

        <section className="communityBoardNotice" aria-label="게시판 설명">
          <p>{board.purpose}</p>
        </section>

        <section className="communityPostSection" aria-labelledby={`${board.slug}-posts`}>
          <div className="communityBoardControls" aria-label="게시판 상태">
            <p>
              총 <strong>{visiblePosts.length}</strong>건
              <span aria-hidden="true"> / </span>
              공지 <strong>{noticeCount}</strong>건
              <span aria-hidden="true"> / </span>
              {board.typeLabels.normal} <strong>{normalCount}</strong>건
            </p>
            {board.slug === 'free' ? (
              <Link
                className="communityWriteButton"
                href="/community/free/write"
                target="_blank"
                rel="noopener noreferrer"
              >
                게시글 작성
              </Link>
            ) : null}
          </div>

          {loadMessage ? <p className="communityLoadMessage" role="status">{loadMessage}</p> : null}

          <div className="communityPostList">
            {orderedPosts.length > 0 ? (
              <table className="communityPostTable">
                <caption>{board.title} 게시글 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">번호</th>
                    <th scope="col">분류</th>
                    <th scope="col">제목</th>
                    <th scope="col">작성자</th>
                    <th scope="col">작성일</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedPosts.map((post, index) => (
                    <CommunityPostCard
                      board={board}
                      key={post.id}
                      number={post.type === 'notice' ? '공지' : String(orderedPosts.length - index)}
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

function CommunityPostCard({ board, number, post }: CommunityPostCardProps) {
  return (
    <tr className={`communityPostRow ${post.type === 'notice' ? 'isNotice' : ''}`}>
      <td className="communityPostNumber">
        <span>{number}</span>
      </td>
      <td>
        <span className="communityPostType">{board.typeLabels[post.type]}</span>
      </td>
      <td className="communityPostBody">
        <h3>{post.title}</h3>
        <p>{post.content}</p>
        <div className="communityPostMetaRow" aria-label="게시글 태그">
          {post.tags.map((tag) => (
            <span className="communityPostTag" key={`${post.id}-${tag}`}>
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
