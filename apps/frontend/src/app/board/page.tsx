"use client";

import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';

type BoardPost = {
  id: string;
  title: string;
  content: string;
  category: string;
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
  boardTitle: '\uAC8C\uC2DC\uD310',
  description:
    '\uBAA8\uC774\uB77C\uC758 \uACF5\uC9C0, \uC9C0\uC5ED \uC18C\uC2DD, \uC8FC\uBBFC \uC81C\uC548\uC744 \uD55C\uACF3\uC5D0\uC11C \uD655\uC778\uD558\uACE0 \uC0C8 \uAC8C\uC2DC\uAE00\uC744 \uC791\uC131\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.',
  close: '\uB2EB\uAE30',
  write: '\uAE00\uC4F0\uAE30',
  title: '\uC81C\uBAA9',
  category: '\uCE74\uD14C\uACE0\uB9AC',
  content: '\uB0B4\uC6A9',
  titlePlaceholder: '\uAC8C\uC2DC\uAE00 \uC81C\uBAA9\uC744 \uC785\uB825\uD558\uC138\uC694',
  contentPlaceholder: '\uACF5\uC720\uD560 \uB0B4\uC6A9\uC744 \uC785\uB825\uD558\uC138\uC694',
  create: '\uAC8C\uC2DC\uAE00 \uB4F1\uB85D',
  creating: '\uC791\uC131 \uC911...',
  search: '\uAC80\uC0C9',
  searchPlaceholder:
    '\uC81C\uBAA9, \uB0B4\uC6A9, \uC791\uC131\uC790 \uAC80\uC0C9',
  listCategory: '\uBD84\uB958',
  listMeta: '\uC791\uC131 \uC815\uBCF4',
  loading: '\uAC8C\uC2DC\uAE00\uC744 \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.',
  empty: '\uC870\uAC74\uC5D0 \uB9DE\uB294 \uAC8C\uC2DC\uAE00\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.',
  loadError: '\uAC8C\uC2DC\uAE00 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.',
  createError: '\uAC8C\uC2DC\uAE00 \uC791\uC131\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.',
};

const categories = [copy.all, copy.notice, copy.news, copy.suggestion];
const writableCategories = categories.filter((category) => category !== copy.all);

const initialFormState: BoardFormState = {
  title: '',
  content: '',
  category: copy.suggestion,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export default function BoardPage() {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(copy.all);
  const [form, setForm] = useState<BoardFormState>(initialFormState);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formMessage, setFormMessage] = useState('');

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (submittedSearch.trim()) {
      params.set('search', submittedSearch.trim());
    }

    if (selectedCategory !== copy.all) {
      params.set('category', selectedCategory);
    }

    return params.toString();
  }, [selectedCategory, submittedSearch]);

  useEffect(() => {
    let isMounted = true;

    async function loadPosts() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await fetch(`/api/posts${queryString ? `?${queryString}` : ''}`, {
          cache: 'no-store',
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || copy.loadError);
        }

        if (isMounted) {
          setPosts(data.posts || []);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : copy.loadError);
          setPosts([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPosts();

    return () => {
      isMounted = false;
    };
  }, [queryString]);

  const isSubmitDisabled =
    isSubmitting || !form.title.trim() || !form.content.trim() || !form.category.trim();

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittedSearch(searchInput);
  }

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || copy.createError);
      }

      setPosts((currentPosts) => [data.post, ...currentPosts]);
      setForm(initialFormState);
      setIsWriteOpen(false);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : copy.createError);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="boardPage">
      <section className="boardShell" aria-labelledby="board-title">
        <div className="boardHeader">
          <div>
            <p className="boardEyebrow">Moira Board</p>
            <h1 id="board-title">{copy.boardTitle}</h1>
            <p>{copy.description}</p>
          </div>
          <button
            className="boardWriteButton"
            type="button"
            onClick={() => setIsWriteOpen((current) => !current)}
            aria-expanded={isWriteOpen}
          >
            {isWriteOpen ? copy.close : copy.write}
          </button>
        </div>

        {isWriteOpen ? (
          <form className="boardWriteForm" onSubmit={handleCreatePost}>
            <label className="boardField" htmlFor="board-post-title">
              <span>{copy.title}</span>
              <input
                id="board-post-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                placeholder={copy.titlePlaceholder}
                maxLength={80}
              />
            </label>

            <label className="boardField" htmlFor="board-post-category">
              <span>{copy.category}</span>
              <select
                id="board-post-category"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              >
                {writableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label className="boardField boardFieldWide" htmlFor="board-post-content">
              <span>{copy.content}</span>
              <textarea
                id="board-post-content"
                value={form.content}
                onChange={(event) => setForm({ ...form, content: event.target.value })}
                placeholder={copy.contentPlaceholder}
                rows={5}
              />
            </label>

            {formMessage ? (
              <p className="boardMessage error" role="alert" aria-live="polite">
                {formMessage}
              </p>
            ) : null}

            <div className="boardFormActions">
              <button type="submit" disabled={isSubmitDisabled}>
                {isSubmitting ? copy.creating : copy.create}
              </button>
            </div>
          </form>
        ) : null}

        <section className="boardToolbar" aria-label="board search and filters">
          <form className="boardSearch" onSubmit={handleSearchSubmit}>
            <label htmlFor="board-search">{copy.search}</label>
            <div className="boardSearchRow">
              <input
                id="board-search"
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={copy.searchPlaceholder}
              />
              <button type="submit">{copy.search}</button>
            </div>
          </form>

          <div className="boardFilters" aria-label="board category filters">
            {categories.map((category) => (
              <button
                className={category === selectedCategory ? 'active' : undefined}
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <section className="boardList" aria-label="board post list">
          <div className="boardListHeader">
            <span>{copy.listCategory}</span>
            <span>{copy.title}</span>
            <span>{copy.listMeta}</span>
          </div>

          {isLoading ? <p className="boardState">{copy.loading}</p> : null}

          {!isLoading && errorMessage ? (
            <p className="boardState error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {!isLoading && !errorMessage && posts.length === 0 ? (
            <p className="boardState">{copy.empty}</p>
          ) : null}

          {!isLoading && !errorMessage
            ? posts.map((post) => (
                <article className="boardRow" key={post.id}>
                  <span className="boardCategory">{post.category}</span>
                  <div className="boardPostText">
                    <h2>{post.title}</h2>
                    <p>{post.content}</p>
                  </div>
                  <span className="boardMeta">
                    {post.author}
                    <br />
                    {formatDate(post.createdAt)}
                  </span>
                </article>
              ))
            : null}
        </section>
      </section>
    </main>
  );
}
