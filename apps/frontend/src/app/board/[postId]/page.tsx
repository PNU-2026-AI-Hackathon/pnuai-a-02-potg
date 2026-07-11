"use client";

import type { FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type BoardPost = {
  id: string;
  title: string;
  content: string;
  category: string;
  author: string;
  createdAt: string;
  updatedAt?: string;
};

type BoardComment = {
  id: string;
  postId: string;
  content: string;
  author: string;
  createdAt: string;
};

type BoardFormState = {
  title: string;
  content: string;
  category: string;
};

const copy = {
  all: '\uC804\uCCB4',
  notice: '\uACF5\uC9C0',
  news: '\uC18C\uC2DD',
  suggestion: '\uC81C\uC548',
  back: '\uBAA9\uB85D\uC73C\uB85C',
  category: '\uCE74\uD14C\uACE0\uB9AC',
  title: '\uC81C\uBAA9',
  content: '\uB0B4\uC6A9',
  edit: '\uC218\uC815',
  cancel: '\uCDE8\uC18C',
  save: '\uC800\uC7A5',
  saving: '\uC800\uC7A5 \uC911...',
  delete: '\uC0AD\uC81C',
  deleting: '\uC0AD\uC81C \uC911...',
  comments: '\uB313\uAE00',
  commentLabel: '\uB313\uAE00 \uC791\uC131',
  commentPlaceholder: '\uB313\uAE00\uC744 \uC785\uB825\uD558\uC138\uC694',
  commentSubmit: '\uB313\uAE00 \uB4F1\uB85D',
  commentSubmitting: '\uB4F1\uB85D \uC911...',
  loading: '\uAC8C\uC2DC\uAE00\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.',
  emptyComments: '\uC544\uC9C1 \uB313\uAE00\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.',
  loadError: '\uAC8C\uC2DC\uAE00\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.',
  updateError: '\uAC8C\uC2DC\uAE00 \uC218\uC815\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.',
  deleteError: '\uAC8C\uC2DC\uAE00 \uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.',
  commentError: '\uB313\uAE00 \uC791\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.',
  confirmDelete: '\uAC8C\uC2DC\uAE00\uC744 \uC0AD\uC81C\uD560\uAE4C\uC694?',
};

const categories = [copy.notice, copy.news, copy.suggestion];

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function createFormState(post: BoardPost): BoardFormState {
  return {
    title: post.title,
    content: post.content,
    category: post.category,
  };
}

export default function BoardDetailPage() {
  const params = useParams<{ postId: string }>();
  const router = useRouter();
  const postId = params.postId;

  const [post, setPost] = useState<BoardPost | null>(null);
  const [comments, setComments] = useState<BoardComment[]>([]);
  const [editForm, setEditForm] = useState<BoardFormState | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [pageMessage, setPageMessage] = useState('');
  const [commentMessage, setCommentMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      setIsLoading(true);
      setPageMessage('');

      try {
        const [postResponse, commentsResponse] = await Promise.all([
          fetch(`/api/posts/${postId}`, { cache: 'no-store' }),
          fetch(`/api/posts/${postId}/comments`, { cache: 'no-store' }),
        ]);
        const postData = await postResponse.json();
        const commentsData = await commentsResponse.json();

        if (!postResponse.ok) {
          throw new Error(postData?.error || copy.loadError);
        }

        if (!commentsResponse.ok) {
          throw new Error(commentsData?.error || copy.loadError);
        }

        if (isMounted) {
          setPost(postData.post);
          setEditForm(createFormState(postData.post));
          setComments(commentsData.comments || []);
        }
      } catch (error) {
        if (isMounted) {
          setPageMessage(error instanceof Error ? error.message : copy.loadError);
          setPost(null);
          setComments([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      isMounted = false;
    };
  }, [postId]);

  const isSaveDisabled =
    isSaving ||
    !editForm?.title.trim() ||
    !editForm.content.trim() ||
    !editForm.category.trim();
  const isCommentDisabled = isCommenting || !commentContent.trim();

  function startEdit() {
    if (!post) {
      return;
    }

    setEditForm(createFormState(post));
    setIsEditing(true);
    setPageMessage('');
  }

  function cancelEdit() {
    if (post) {
      setEditForm(createFormState(post));
    }

    setIsEditing(false);
    setPageMessage('');
  }

  async function handleUpdatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    setIsSaving(true);
    setPageMessage('');

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editForm),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || copy.updateError);
      }

      setPost(data.post);
      setEditForm(createFormState(data.post));
      setIsEditing(false);
    } catch (error) {
      setPageMessage(error instanceof Error ? error.message : copy.updateError);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeletePost() {
    if (!window.confirm(copy.confirmDelete)) {
      return;
    }

    setIsDeleting(true);
    setPageMessage('');

    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || copy.deleteError);
      }

      router.push('/board');
      router.refresh();
    } catch (error) {
      setPageMessage(error instanceof Error ? error.message : copy.deleteError);
      setIsDeleting(false);
    }
  }

  async function handleCreateComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCommenting(true);
    setCommentMessage('');

    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: commentContent }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || copy.commentError);
      }

      setComments((currentComments) => [...currentComments, data.comment]);
      setCommentContent('');
    } catch (error) {
      setCommentMessage(error instanceof Error ? error.message : copy.commentError);
    } finally {
      setIsCommenting(false);
    }
  }

  return (
    <main className="boardPage">
      <section className="boardShell" aria-labelledby="board-detail-title">
        <div className="boardDetailShell">
          <div className="boardDetailTop">
            <Link className="boardBackLink" href="/board">
              {copy.back}
            </Link>
          </div>

          {isLoading ? <p className="boardState">{copy.loading}</p> : null}

          {!isLoading && pageMessage ? (
            <p className="boardState error" role="alert">
              {pageMessage}
            </p>
          ) : null}

          {!isLoading && post ? (
            <>
              <article className="boardDetailArticle">
                {isEditing && editForm ? (
                  <form className="boardEditForm" onSubmit={handleUpdatePost}>
                    <label className="boardField" htmlFor="board-edit-title">
                      <span>{copy.title}</span>
                      <input
                        id="board-edit-title"
                        value={editForm.title}
                        onChange={(event) =>
                          setEditForm({ ...editForm, title: event.target.value })
                        }
                        maxLength={80}
                      />
                    </label>

                    <label className="boardField" htmlFor="board-edit-category">
                      <span>{copy.category}</span>
                      <select
                        id="board-edit-category"
                        value={editForm.category}
                        onChange={(event) =>
                          setEditForm({ ...editForm, category: event.target.value })
                        }
                      >
                        {categories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="boardField boardFieldWide" htmlFor="board-edit-content">
                      <span>{copy.content}</span>
                      <textarea
                        id="board-edit-content"
                        value={editForm.content}
                        onChange={(event) =>
                          setEditForm({ ...editForm, content: event.target.value })
                        }
                        rows={8}
                      />
                    </label>

                    <div className="boardDetailActions boardFieldWide">
                      <button type="submit" disabled={isSaveDisabled}>
                        {isSaving ? copy.saving : copy.save}
                      </button>
                      <button type="button" onClick={cancelEdit} disabled={isSaving}>
                        {copy.cancel}
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <header className="boardDetailHeader">
                      <span className="boardCategory">{post.category}</span>
                      <h1 id="board-detail-title">{post.title}</h1>
                      <p>
                        {post.author} · {formatDateTime(post.createdAt)}
                        {post.updatedAt ? ` · ${formatDateTime(post.updatedAt)} 수정` : ''}
                      </p>
                    </header>

                    <p className="boardDetailContent">{post.content}</p>

                    <div className="boardDetailActions">
                      <button type="button" onClick={startEdit}>
                        {copy.edit}
                      </button>
                      <button type="button" onClick={handleDeletePost} disabled={isDeleting}>
                        {isDeleting ? copy.deleting : copy.delete}
                      </button>
                    </div>
                  </>
                )}
              </article>

              <section className="boardComments" aria-labelledby="board-comments-title">
                <h2 id="board-comments-title">
                  {copy.comments} {comments.length}
                </h2>

                <form className="boardCommentForm" onSubmit={handleCreateComment}>
                  <label htmlFor="board-comment">{copy.commentLabel}</label>
                  <textarea
                    id="board-comment"
                    value={commentContent}
                    onChange={(event) => setCommentContent(event.target.value)}
                    placeholder={copy.commentPlaceholder}
                    rows={4}
                  />

                  {commentMessage ? (
                    <p className="boardMessage error" role="alert">
                      {commentMessage}
                    </p>
                  ) : null}

                  <div className="boardFormActions">
                    <button type="submit" disabled={isCommentDisabled}>
                      {isCommenting ? copy.commentSubmitting : copy.commentSubmit}
                    </button>
                  </div>
                </form>

                <div className="boardCommentList">
                  {comments.length === 0 ? (
                    <p className="boardState">{copy.emptyComments}</p>
                  ) : (
                    comments.map((comment) => (
                      <article className="boardComment" key={comment.id}>
                        <p>{comment.content}</p>
                        <span>
                          {comment.author} · {formatDateTime(comment.createdAt)}
                        </span>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
