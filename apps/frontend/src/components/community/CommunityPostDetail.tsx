'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type Post = { id: string; boardSlug: string; type: string; title: string; content: string; author: string; createdAt: string; updatedAt?: string; tags: string[]; isOwner: boolean };
type Comment = { id: string; content: string; author: string; createdAt: string; updatedAt?: string; isOwner: boolean };
type Activity = { likeCount: number; saveCount: number; liked: boolean; saved: boolean };

const dateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeStyle: 'short' });
const boardNames: Record<string, string> = { 'library-news': '도서관 행사 및 소식', ideas: '우리동네 아이디어' };

async function fetchPostDetails(postId: string) {
  const [postResponse, commentsResponse, activityResponse] = await Promise.all([
    fetch(`/api/posts/${encodeURIComponent(postId)}`, { cache: 'no-store' }),
    fetch(`/api/posts/${encodeURIComponent(postId)}/comments`, { cache: 'no-store' }),
    fetch(`/api/posts/${encodeURIComponent(postId)}/activity`, { cache: 'no-store' }),
  ]);
  const postData = await postResponse.json();
  const commentsData = await commentsResponse.json();
  const activityData = await activityResponse.json();
  if (!postResponse.ok) throw new Error(postData.error || '게시글을 불러오지 못했습니다.');
  if (!commentsResponse.ok) throw new Error(commentsData.error || '댓글을 불러오지 못했습니다.');
  return { post: postData.post as Post, comments: (commentsData.comments || []) as Comment[], activity: activityResponse.ok ? activityData.activity as Activity : null };
}

export default function CommunityPostDetail({ postId }: { postId: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activity, setActivity] = useState<Activity>({ likeCount: 0, saveCount: 0, liked: false, saved: false });
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [commentContent, setCommentContent] = useState('');

  useEffect(() => {
    fetchPostDetails(postId)
      .then((data) => {
        setPost(data.post);
        setComments(data.comments); if (data.activity) setActivity(data.activity);
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setIsLoading(false));
  }, [postId]);

  async function deletePost() {
    if (!window.confirm('게시글을 삭제할까요? 삭제한 글은 복구할 수 없습니다.')) return;
    const password = post?.isOwner ? undefined : window.prompt('작성할 때 사용한 게시글 비밀번호를 입력해 주세요.');
    if (!post?.isOwner && !password) return;
    const response = await fetch(`/api/posts/${postId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (response.ok) { window.location.href = `/community/${post?.boardSlug ?? 'ideas'}`; return; }
    setMessage((await response.json()).error || '게시글을 삭제하지 못했습니다.');
  }

  async function createComment(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/posts/${postId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: commentContent }) });
    const data = await response.json();
    if (!response.ok) return setMessage(response.status === 401 ? '로그인 후 댓글을 작성할 수 있습니다.' : data.error || '댓글을 작성하지 못했습니다.');
    setComments((current) => [...current, data.comment]); setCommentContent(''); setMessage('');
  }

  async function updateComment(commentId: string, currentContent: string) {
    const content = window.prompt('댓글을 수정해 주세요.', currentContent)?.trim();
    if (!content || content === currentContent) return;
    const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error || '댓글을 수정하지 못했습니다.');
    setComments((current) => current.map((comment) => comment.id === commentId ? data.comment : comment));
  }

  async function deleteComment(commentId: string) {
    if (!window.confirm('댓글을 삭제할까요?')) return;
    const response = await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
    if (!response.ok) return setMessage((await response.json()).error || '댓글을 삭제하지 못했습니다.');
    setComments((current) => current.filter((comment) => comment.id !== commentId));
  }

  async function toggleActivity(kind: 'like' | 'save') {
    const active = kind === 'like' ? activity.liked : activity.saved;
    const response = await fetch(`/api/posts/${postId}/${kind}`, { method: active ? 'DELETE' : 'PUT' });
    const data = await response.json();
    if (!response.ok) return setMessage(response.status === 401 ? '로그인 후 이용해 주세요.' : data.error || '요청을 처리하지 못했습니다.');
    setActivity((current) => ({ ...current, ...(kind === 'like' ? { liked: !active, likeCount: Math.max(0, current.likeCount + (active ? -1 : 1)) } : { saved: !active, saveCount: Math.max(0, current.saveCount + (active ? -1 : 1)) }) }));
    setMessage('');
  }

  if (isLoading) return <main className="communityDetailPage"><p className="communityDetailState">게시글을 불러오는 중입니다.</p></main>;
  if (!post) return <main className="communityDetailPage"><p className="communityDetailState">{message || '게시글을 찾을 수 없습니다.'}</p></main>;

  return <main className="communityDetailPage"><div className="uiContainer communityDetailShell">
    <nav className="communityBreadcrumb"><Link href="/">홈</Link><span>/</span><Link href={`/community/${post.boardSlug}`}>{boardNames[post.boardSlug] || '커뮤니티'}</Link><span>/</span><strong>게시글 상세</strong></nav>
    <article className="communityDetailCard">
      <header className="communityDetailHeader"><div className="communityDetailTags"><span className="uiTag">{boardNames[post.boardSlug] || post.boardSlug}</span>{post.tags.map((tag) => <span className="uiTag" key={tag}>{tag}</span>)}</div><h1>{post.title}</h1><p>{post.author} · {dateFormatter.format(new Date(post.createdAt))}</p></header><div className="communityDetailContent">{post.content}</div><div className="communityDetailToolbar"><button className={activity.liked ? 'isActive' : ''} type="button" onClick={() => toggleActivity('like')}>♥ 좋아요 {activity.likeCount}</button><button className={activity.saved ? 'isActive' : ''} type="button" onClick={() => toggleActivity('save')}>☆ 관심글 {activity.saveCount}</button><span className="communityOwnerActions"><Link className="communityDetailActionLink" href={`/community/posts/${encodeURIComponent(post.id)}/edit`}>수정</Link><button type="button" onClick={deletePost}>삭제</button></span></div>
    </article>
    {message ? <p className="communityDetailMessage" role="alert">{message}</p> : null}
    <section className="communityCommentSection"><div><p className="uiEyebrow">COMMENTS</p><h2>댓글 {comments.length}</h2></div><form onSubmit={createComment}><label htmlFor="detail-comment">댓글 작성</label><textarea id="detail-comment" value={commentContent} onChange={(event) => setCommentContent(event.target.value)} rows={4} maxLength={2000} placeholder="의견을 남겨 주세요" required /><button className="uiButton uiButtonPrimary" type="submit">댓글 등록</button></form><div className="communityCommentList">{comments.length ? comments.map((comment) => <article key={comment.id}><p>{comment.content}</p><footer><span>{comment.author} · {dateFormatter.format(new Date(comment.createdAt))}</span>{comment.isOwner ? <span><button type="button" onClick={() => updateComment(comment.id, comment.content)}>수정</button><button type="button" onClick={() => deleteComment(comment.id)}>삭제</button></span> : null}</footer></article>) : <p className="communityDetailState">첫 댓글을 남겨 보세요.</p>}</div></section>
  </div></main>;
}
