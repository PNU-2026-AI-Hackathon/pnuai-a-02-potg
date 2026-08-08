'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type EditablePost = { id: string; boardSlug: string; title: string; content: string; isOwner: boolean };

async function fetchEditablePost(postId: string) {
  const response = await fetch(`/api/posts/${encodeURIComponent(postId)}`, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '게시글을 불러오지 못했습니다.');
  return data.post as EditablePost;
}

export default function CommunityPostEditForm({ postId }: { postId: string }) {
  const router = useRouter();
  const [post, setPost] = useState<EditablePost | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEditablePost(postId)
      .then((data) => { setPost(data); setTitle(data.title); setContent(data.content); })
      .catch((error) => setMessage(error.message));
  }, [postId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!post?.isOwner && !password) return setMessage('작성할 때 사용한 게시글 비밀번호를 입력해 주세요.');
    setIsSubmitting(true); setMessage('');
    const response = await fetch(`/api/posts/${encodeURIComponent(postId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), content: content.trim(), password: post?.isOwner ? undefined : password }),
    });
    const data = await response.json();
    if (!response.ok) { setMessage(response.status === 403 ? '게시글 비밀번호가 올바르지 않습니다.' : data.error || '게시글을 수정하지 못했습니다.'); setIsSubmitting(false); return; }
    router.push(`/community/posts/${encodeURIComponent(postId)}`); router.refresh();
  }

  return <main className="communityPage communityWritePage"><section className="uiContainer communityShell" aria-labelledby="post-edit-title"><nav className="communityBreadcrumb"><Link href="/">홈</Link><span>/</span><Link href={`/community/posts/${encodeURIComponent(postId)}`}>게시글 상세</Link><span>/</span><strong>게시글 수정</strong></nav><header className="communityBoardHeader"><div><p className="uiEyebrow communityEyebrow">COMMUNITY</p><h1 id="post-edit-title">게시글 수정</h1><p>작성한 내용을 확인하고 필요한 부분을 수정해 주세요.</p></div></header>{post ? <form className="communityWriteForm" onSubmit={submit}><label className="communityWriteField" htmlFor="edit-post-title"><span>제목</span><input id="edit-post-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required /></label><label className="communityWriteField" htmlFor="edit-post-content"><span>내용</span><textarea id="edit-post-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={5000} rows={14} required /><small>{content.length} / 5,000자</small></label>{!post.isOwner ? <label className="communityWriteField communityPasswordField" htmlFor="edit-post-password"><span>게시글 비밀번호</span><input id="edit-post-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={4} maxLength={64} placeholder="작성할 때 사용한 비밀번호" required /></label> : null}{message ? <p className="communityWriteError" role="alert">{message}</p> : null}<div className="communityWriteActions"><Link className="uiButton uiButtonSecondary" href={`/community/posts/${encodeURIComponent(postId)}`}>취소</Link><button className="uiButton uiButtonPrimary" type="submit" disabled={isSubmitting || !title.trim() || !content.trim()}>{isSubmitting ? '저장 중…' : '수정 완료'}</button></div></form> : <p className="communityDetailState">{message || '게시글을 불러오는 중입니다.'}</p>}</section></main>;
}
