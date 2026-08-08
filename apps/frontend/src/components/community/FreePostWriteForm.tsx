'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function FreePostWriteForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          password,
          category: '자유글',
          boardSlug: 'free',
          author: '익명',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '게시글 등록에 실패했습니다.');

      router.push('/community/free');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '게시글 등록에 실패했습니다.');
      setIsSubmitting(false);
    }
  }

  const isDisabled =
    isSubmitting || !title.trim() || !content.trim() || password.length < 4 || password.length > 64;

  return (
    <form className="communityWriteForm" onSubmit={handleSubmit}>
      <label className="communityWriteField" htmlFor="free-post-title">
        <span>제목</span>
        <input
          id="free-post-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={100}
          placeholder="게시글 제목을 입력해 주세요"
          required
          autoFocus
        />
      </label>

      <label className="communityWriteField" htmlFor="free-post-content">
        <span>내용</span>
        <textarea
          id="free-post-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={5000}
          rows={14}
          placeholder="공유할 내용을 입력해 주세요"
          required
        />
        <small>{content.length} / 5,000자</small>
      </label>

      <label className="communityWriteField communityPasswordField" htmlFor="free-post-password">
        <span>게시글 비밀번호</span>
        <input
          id="free-post-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={4}
          maxLength={64}
          autoComplete="new-password"
          placeholder="4자 이상 입력해 주세요"
          required
        />
        <small>수정하거나 삭제할 때 필요합니다. 계정 연동 전까지만 임시로 사용됩니다.</small>
      </label>

      {message ? <p className="communityWriteError" role="alert">{message}</p> : null}

      <div className="communityWriteActions">
        <Link className="uiButton uiButtonSecondary" href="/community/free">취소</Link>
        <button className="uiButton uiButtonPrimary" type="submit" disabled={isDisabled}>
          {isSubmitting ? '등록 중…' : '게시글 등록'}
        </button>
      </div>
    </form>
  );
}
