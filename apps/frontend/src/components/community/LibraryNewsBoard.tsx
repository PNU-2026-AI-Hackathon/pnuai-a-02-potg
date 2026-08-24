'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { AuthUser } from '@/lib/auth-config';
import { postContentExcerpt, postContentText } from '@/lib/rich-post-content';
import type { CommunityBoard, CommunityPost } from '@/lib/community-boards';
import CommunitySectionBreadcrumb from '@/components/community/CommunitySectionBreadcrumb';

type FilterKey = 'all' | 'notice' | 'event-program';
type PostCategory = 'notice' | 'recruiting' | 'event' | 'program' | 'general';
type SortKey = 'latest' | 'popular';
type Activity = { likeCount: number; saveCount: number; liked: boolean; saved: boolean };

const pageSize = 5;
const emptyActivity: Activity = { likeCount: 0, saveCount: 0, liked: false, saved: false };
const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Seoul',
});

function categoryOf(post: CommunityPost): PostCategory {
  if (post.type === 'notice') return 'notice';
  const source = `${post.title} ${postContentText(post.content)} ${post.tags.join(' ')}`;
  if (/모집|참가자|신청/.test(source)) return 'recruiting';
  if (/행사|전시|축제/.test(source)) return 'event';
  if (/프로그램|교육|강좌|모임/.test(source)) return 'program';
  return 'general';
}

function categoryLabel(category: ReturnType<typeof categoryOf>) {
  return ({ notice: '공지', recruiting: '모집', event: '행사·프로그램', program: '행사·프로그램', general: '일반' })[category];
}

function Icon({ name }: { name: 'search' | 'pen' | 'heart' | 'bookmark' | 'more' | 'arrow' }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    pen: <><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20l-5 1 1-5z" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5a5.5 5.5 0 0 0 1.1-8.9Z" />,
    bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
    more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  };
  return <svg className="libraryNewsIcon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function LibraryIllustration() {
  return (
    <svg className="libraryNewsIllustration" viewBox="0 0 520 250" role="img" aria-label="책과 나무가 있는 도서관 일러스트">
      <path className="cloud" d="M45 72c8-25 45-24 52 1 20-8 37 5 38 23H27c0-15 7-23 18-24Z" />
      <path className="cloud" d="M398 48c9-28 49-25 57 3 22-8 39 6 40 25H377c0-17 8-26 21-28Z" />
      <circle className="sun" cx="339" cy="50" r="25" />
      <path className="ground" d="M5 221c79-38 147-12 211-25 104-21 205-5 299 25Z" />
      <g className="tree"><path d="M99 212v-68" /><circle cx="99" cy="124" r="39" /><circle cx="72" cy="148" r="25" /><circle cx="126" cy="151" r="28" /></g>
      <g className="tree small"><path d="M444 218v-48" /><circle cx="444" cy="159" r="27" /><circle cx="467" cy="178" r="20" /></g>
      <g className="building">
        <path d="m183 112 114-48 137 48v105H183Z" />
        <path className="roof" d="m166 116 132-59 151 59" />
        <path className="door" d="M283 146h51v71h-51z" />
        <path className="window" d="M209 142h43v39h-43zM363 142h43v39h-43z" />
        <path d="M176 217h271" />
      </g>
      <g className="books"><path d="M31 205h69v14H31z" /><path d="M38 190h62v15H38z" /><path d="M30 174h62v16H30z" /></g>
    </svg>
  );
}

function LibraryNewsHero({ board }: { board: CommunityBoard }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <section
        className="libraryNewsHero"
        aria-labelledby="library-news-title"
        data-expanded={isExpanded}
        onClick={() => setIsExpanded((current) => !current)}
      >
        <div className="libraryNewsHeroCopy">
          <p className="libraryNewsEyebrow">지역 커뮤니티</p>
          <div className="libraryNewsHeroHeading">
            <h1 id="library-news-title">{board.title}</h1>
            <button
              className="libraryNewsHeroToggle"
              type="button"
              aria-expanded={isExpanded}
              aria-controls="library-news-introduction"
              onClick={(event) => {
                event.stopPropagation();
                setIsExpanded((current) => !current);
              }}
            >
              <span className="srOnly">게시판 소개 {isExpanded ? '접기' : '펼치기'}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
          </div>
          <div className="libraryNewsHeroIntroduction" id="library-news-introduction">
            <p>{board.description}</p>
          </div>
        </div>
        <LibraryIllustration />
      </section>
    </>
  );
}

function LibraryNewsControls({ counts, filter, onFilter, query, onQuery, sort, onSort, canWrite }: {
  counts: Record<FilterKey, number>;
  filter: FilterKey;
  onFilter: (filter: FilterKey) => void;
  query: string;
  onQuery: (query: string) => void;
  sort: SortKey;
  onSort: (sort: SortKey) => void;
  canWrite: boolean;
}) {
  const filters: Array<[FilterKey, string]> = [['all', '전체'], ['notice', '공지'], ['event-program', '행사·프로그램']];
  return (
    <section className="libraryNewsControls" aria-label="게시글 필터 및 검색">
      <div className="libraryNewsFilters" role="group" aria-label="카테고리 필터">
        {filters.map(([key, label]) => (
          <button className={filter === key ? 'isActive' : ''} key={key} type="button" onClick={() => onFilter(key)} aria-pressed={filter === key}>
            {label} <span>{counts[key]}</span>
          </button>
        ))}
      </div>
      <div className="libraryNewsTools">
        <label className="libraryNewsSearch">
          <span className="srOnly">게시글 검색</span><Icon name="search" />
          <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="제목, 내용으로 검색하세요" />
        </label>
        <label className="libraryNewsSort">
          <span className="srOnly">게시글 정렬</span>
          <select value={sort} onChange={(event) => onSort(event.target.value as SortKey)}>
            <option value="latest">최신순</option><option value="popular">인기순</option>
          </select>
        </label>
        {canWrite ? <Link className="libraryNewsWriteButton" href="/community/library-news/write"><Icon name="pen" />글쓰기</Link> : null}
      </div>
    </section>
  );
}

function PostActivityActions({ postId, activity, onChange }: { postId: string; activity: Activity; onChange: (activity: Activity) => void }) {
  const [message, setMessage] = useState('');
  async function toggle(kind: 'like' | 'save') {
    const active = kind === 'like' ? activity.liked : activity.saved;
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/${kind}`, { method: active ? 'DELETE' : 'PUT' });
      const contentType = response.headers.get('content-type') ?? '';
      const data = contentType.includes('application/json') ? await response.json() : null;
      if (!response.ok || !data) {
        setMessage(response.status === 401 ? '로그인 후 이용해 주세요.' : data?.error || '처리하지 못했습니다.');
        return;
      }
      setMessage('');
      onChange({
        ...activity,
        ...(kind === 'like'
          ? { liked: !active, likeCount: Math.max(0, activity.likeCount + (active ? -1 : 1)) }
          : { saved: !active, saveCount: Math.max(0, activity.saveCount + (active ? -1 : 1)) }),
      });
    } catch {
      setMessage('처리하지 못했습니다.');
    }
  }
  return (
    <div className="libraryNewsActivity">
      <button className={activity.liked ? 'isActive' : ''} type="button" onClick={() => toggle('like')} aria-label={`좋아요 ${activity.likeCount}개`} aria-pressed={activity.liked}><Icon name="heart" /><span className="libraryNewsActivityLabel">좋아요</span><strong>{activity.likeCount}</strong></button>
      <button className={activity.saved ? 'isActive' : ''} type="button" onClick={() => toggle('save')} aria-label={`관심글 ${activity.saveCount}개`} aria-pressed={activity.saved}><Icon name="bookmark" /><span className="libraryNewsActivityLabel">관심</span><strong>{activity.saveCount}</strong></button>
      {message ? <span role="status">{message}</span> : null}
    </div>
  );
}

function LibraryNewsPostCard({ post, activity, onActivityChange }: { post: CommunityPost; activity: Activity; onActivityChange: (activity: Activity) => void }) {
  const category = categoryOf(post);
  return (
    <article className={`libraryNewsPostCard is-${category} ${post.type === 'notice' ? 'isNotice' : ''}`}>
      <div className="libraryNewsPostContent">
        <div className="libraryNewsPostHeading">
          <span className={`libraryNewsBadge is-${category}`}>{categoryLabel(category)}</span>
          <h2><Link href={`/community/posts/${encodeURIComponent(post.id)}`}>{post.title}</Link></h2>
        </div>
        <p>{postContentExcerpt(post.content)}</p>
        <div className="libraryNewsTags" aria-label="게시글 태그">
          {post.tags.map((tag) => <span key={`${post.id}-${tag}`}>#{tag}</span>)}
        </div>
      </div>
      <div className="libraryNewsPostMeta">
        <div><span className="libraryNewsAvatar" aria-hidden="true">{post.author.slice(0, 1)}</span><strong>{post.author}</strong></div>
        <time dateTime={post.createdAt}>{dateFormatter.format(new Date(post.createdAt))}</time>
        <PostActivityActions postId={post.id} activity={activity} onChange={onActivityChange} />
        <Link className="libraryNewsMore" href={`/community/posts/${encodeURIComponent(post.id)}`} aria-label={`${post.title} 상세 보기`}><Icon name="more" /></Link>
      </div>
    </article>
  );
}

function LibraryNewsPagination({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (page: number) => void }) {
  return (
    <nav className="libraryNewsPagination" aria-label="게시글 페이지">
      <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1} aria-label="이전 페이지"><Icon name="arrow" /></button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => <button className={page === item ? 'isActive' : ''} type="button" key={item} onClick={() => onPage(item)} aria-current={page === item ? 'page' : undefined}>{item}</button>)}
      <button type="button" onClick={() => onPage(Math.min(pageCount, page + 1))} disabled={page === pageCount} aria-label="다음 페이지"><Icon name="arrow" /></button>
    </nav>
  );
}

export default function LibraryNewsBoard({ board, posts, user }: { board: CommunityBoard; posts: CommunityPost[]; user: AuthUser | null }) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('latest');
  const [page, setPage] = useState(1);
  const [activities, setActivities] = useState<Record<string, Activity>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(posts.map(async (post) => {
      try {
        const response = await fetch(`/api/posts/${encodeURIComponent(post.id)}/activity`, { cache: 'no-store' });
        const contentType = response.headers.get('content-type') ?? '';
        if (!response.ok || !contentType.includes('application/json')) return [post.id, emptyActivity] as const;
        const data = await response.json();
        return [post.id, data.activity as Activity] as const;
      } catch { return [post.id, emptyActivity] as const; }
    })).then((entries) => { if (!cancelled) setActivities(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [posts]);

  const counts = useMemo(() => posts.reduce<Record<FilterKey, number>>((result, post) => {
    result.all += 1;
    const category = categoryOf(post);
    if (category === 'event' || category === 'program' || category === 'recruiting') result['event-program'] += 1;
    else if (category === 'notice') result.notice += 1;
    return result;
  }, { all: 0, notice: 0, 'event-program': 0 }), [posts]);

  const filteredPosts = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('ko-KR');
    return [...posts]
      .filter((post) => {
        if (filter === 'all') return true;
        const category = categoryOf(post);
        if (filter === 'event-program') return category === 'event' || category === 'program' || category === 'recruiting';
        return category === filter;
      })
      .filter((post) => !keyword || `${post.title} ${postContentText(post.content)} ${post.tags.join(' ')}`.toLocaleLowerCase('ko-KR').includes(keyword))
      .sort((left, right) => {
        if (left.type !== right.type) return left.type === 'notice' ? -1 : 1;
        if (sort === 'popular') return ((activities[right.id]?.likeCount ?? 0) + (activities[right.id]?.saveCount ?? 0)) - ((activities[left.id]?.likeCount ?? 0) + (activities[left.id]?.saveCount ?? 0));
        return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      });
  }, [activities, filter, posts, query, sort]);

  const pageCount = Math.max(1, Math.ceil(filteredPosts.length / pageSize));
  const visiblePosts = filteredPosts.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);
  const canWrite = user?.accountType === 'LIBRARIAN' || user?.accountType === 'ADMIN';
  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setPage(1); };

  return (
    <main className="libraryNewsPage">
      <div className="libraryNewsContainer">
        <CommunitySectionBreadcrumb current="도서관 행사 및 소식" />
        <LibraryNewsHero board={board} />
        <LibraryNewsControls counts={counts} filter={filter} onFilter={resetPage(setFilter)} query={query} onQuery={resetPage(setQuery)} sort={sort} onSort={resetPage(setSort)} canWrite={canWrite} />
        <section className="libraryNewsResults" aria-live="polite" aria-label="도서관 소식 게시글 목록">
          <div className="libraryNewsResultMeta"><strong>게시글 {filteredPosts.length}건</strong><span>도서관의 새로운 소식을 확인해 보세요.</span></div>
          {visiblePosts.length ? visiblePosts.map((post) => <LibraryNewsPostCard key={post.id} post={post} activity={activities[post.id] ?? emptyActivity} onActivityChange={(activity) => setActivities((current) => ({ ...current, [post.id]: activity }))} />) : <div className="libraryNewsEmpty"><Icon name="search" /><strong>검색 결과가 없습니다.</strong><p>다른 검색어나 카테고리를 선택해 보세요.</p></div>}
        </section>
        <LibraryNewsPagination page={Math.min(page, pageCount)} pageCount={pageCount} onPage={setPage} />
        <label className="libraryNewsBottomSearch">
          <span className="srOnly">게시글 검색</span><Icon name="search" />
          <input value={query} onChange={(event) => resetPage(setQuery)(event.target.value)} placeholder="제목, 내용으로 검색하세요" />
        </label>
      </div>
    </main>
  );
}
