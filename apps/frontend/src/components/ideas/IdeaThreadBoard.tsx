'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * tags 를 옵셔널로 둔 것은 백엔드가 늘 준다고 믿을 수 없기 때문이다. 예전 판의 백엔드가
 * 붙어 있으면 이 자리에 아무것도 오지 않았고, 그때 `tags[0]` 하나가 터지면서 글 목록이
 * 통째로 비었다. 값 하나가 비는 것과 게시판이 열리지 않는 것은 무게가 다르다.
 */
type ApiPost = { id: string; boardSlug: string; title: string; content: string; author: string; createdAt: string; tags?: string[] };
type ApiComment = { id: string; postId: string; parentId: string | null; content: string; author: string; createdAt: string };
type Topic = { id: string; title: string; body: string; author: string; role: string; category: string; votes: number; createdAt: string };
type Reply = { id: string; author: string; role: string; createdAt: string; body: string; votes: number; depth: number; parentId: string | null; parentAuthor?: string };

const topicCategories = ['문화·예술', '책·배움', '환경', '생활'];

function formatRelativeTime(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(value));
}

function mapPost(post: ApiPost): Topic {
  const category = Array.isArray(post.tags) ? post.tags[0] : undefined;
  return { id: post.id, title: post.title, body: post.content, author: post.author, role: '동네 주민', category: category || '생활', votes: 0, createdAt: post.createdAt };
}

function mapComments(comments: ApiComment[]) {
  const authors = new Map(comments.map((comment) => [comment.id, comment.author]));
  return comments.map((comment): Reply => ({
    id: comment.id,
    author: comment.author,
    role: '동네 주민',
    createdAt: comment.createdAt,
    body: comment.content,
    votes: 0,
    depth: comment.parentId ? 1 : 0,
    parentId: comment.parentId,
    parentAuthor: comment.parentId ? authors.get(comment.parentId) : undefined,
  }));
}

function orderReplies(replies: Reply[], sort: '좋아요 순' | '최신순', likedReplyIds: string[]) {
  const replyIds = new Set(replies.map((reply) => reply.id));
  const childrenByParent = new Map<string, Reply[]>();

  replies.forEach((reply) => {
    if (!reply.parentId || !replyIds.has(reply.parentId)) return;
    const children = childrenByParent.get(reply.parentId) ?? [];
    children.push(reply);
    childrenByParent.set(reply.parentId, children);
  });

  const roots = replies
    .filter((reply) => !reply.parentId || !replyIds.has(reply.parentId))
    .sort((left, right) => sort === '좋아요 순'
      ? (right.votes + Number(likedReplyIds.includes(right.id))) - (left.votes + Number(likedReplyIds.includes(left.id)))
      : Date.parse(right.createdAt) - Date.parse(left.createdAt));

  const ordered: Reply[] = [];
  const appendWithChildren = (reply: Reply) => {
    ordered.push(reply);
    (childrenByParent.get(reply.id) ?? []).forEach(appendWithChildren);
  };

  roots.forEach(appendWithChildren);
  return ordered;
}

export default function IdeaThreadBoard() {
  /**
   * 기획서에 쓸 의제를 고르러 온 상태인지.
   *
   * 평소에는 이 버튼을 띄우지 않는다. 사서라도 그냥 읽으러 왔을 때는 글마다 「선택하기」가
   * 붙어 있으면 방해가 된다. 기준은 누구냐가 아니라 지금 고르러 왔느냐다.
   *
   * 계정 종류를 보지 않는 이유는, 눌러 봐야 스튜디오로 갈 뿐이고 그쪽이 이미 로그인을
   * 요구하기 때문이다. 주민이 주소를 직접 쳐도 잃는 것이 없다.
   */
  const searchParams = useSearchParams();
  const router = useRouter();
  const isPicking = searchParams.get('pick') === 'studio';
  const pickTopic = (id: string) => router.push(`/studio?agenda=${encodeURIComponent(id)}`);

  const [topics, setTopics] = useState<Topic[]>([]);
  const [repliesByTopic, setRepliesByTopic] = useState<Record<string, Reply[]>>({});
  const [sort, setSort] = useState<'인기순' | '최신순'>('최신순');
  const [replySort, setReplySort] = useState<'좋아요 순' | '최신순'>('최신순');
  const [category, setCategory] = useState('전체 주제');
  const [selected, setSelected] = useState<string | null>(null);
  const [isDetailClosing, setIsDetailClosing] = useState(false);
  const [likedTopics, setLikedTopics] = useState<string[]>([]);
  const [scrappedTopics, setScrappedTopics] = useState<string[]>([]);
  const [likedReplies, setLikedReplies] = useState<string[]>([]);
  const [reply, setReply] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ id: string; author: string } | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', category: topicCategories[0] });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const closeTimer = useRef<number | null>(null);

  const loadIdeas = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/posts?boardSlug=ideas', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '아이디어를 불러오지 못했습니다.');
      const loadedTopics = ((data.posts || []) as ApiPost[]).map(mapPost);
      const commentEntries = await Promise.all(loadedTopics.map(async (topic) => {
        const commentsResponse = await fetch(`/api/posts/${encodeURIComponent(topic.id)}/comments`, { cache: 'no-store' });
        if (!commentsResponse.ok) return [topic.id, []] as const;
        const commentsData = await commentsResponse.json();
        return [topic.id, mapComments((commentsData.comments || []) as ApiComment[])] as const;
      }));
      setTopics(loadedTopics);
      setRepliesByTopic(Object.fromEntries(commentEntries));
      setSelected((current) => current && loadedTopics.some((topic) => topic.id === current) ? current : loadedTopics[0]?.id ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '아이디어를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadIdeas(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadIdeas]);

  const categories = ['전체 주제', ...Array.from(new Set([...topicCategories, ...topics.map((topic) => topic.category)]))];
  const ordered = useMemo(() => topics
    .filter((topic) => category === '전체 주제' || topic.category === category)
    .sort((left, right) => sort === '인기순'
      ? (right.votes + Number(likedTopics.includes(right.id))) - (left.votes + Number(likedTopics.includes(left.id)))
      : Date.parse(right.createdAt) - Date.parse(left.createdAt)), [topics, category, sort, likedTopics]);
  const active = selected === null ? null : topics.find((topic) => topic.id === selected) ?? null;
  const activeReplies = active ? repliesByTopic[active.id] ?? [] : [];
  const orderedReplies = orderReplies(activeReplies, replySort, likedReplies);
  const totalReplies = Object.values(repliesByTopic).reduce((sum, items) => sum + items.length, 0);

  const toggleTopicLike = (id: string) => setLikedTopics((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const toggleTopicScrap = (id: string) => setScrappedTopics((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const selectTopic = (id: string) => { if (closeTimer.current !== null) window.clearTimeout(closeTimer.current); setIsDetailClosing(false); setSelected(id); setActionError(''); };
  const closeDetail = () => { setIsDetailClosing(true); closeTimer.current = window.setTimeout(() => { setSelected(null); setIsDetailClosing(false); closeTimer.current = null; }, 320); };

  const submitReply = async () => {
    if (!active || !reply.trim() || isSubmitting) return;
    setIsSubmitting(true); setActionError('');
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(active.id)}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply.trim(), author: '모이라 사용자', parentId: replyingTo?.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '댓글을 등록하지 못했습니다.');
      const created = mapComments([data.comment as ApiComment])[0];
      if (!created) throw new Error('댓글 응답 형식이 올바르지 않습니다.');
      if (replyingTo) created.parentAuthor = replyingTo.author;
      setRepliesByTopic((current) => ({ ...current, [active.id]: [...(current[active.id] ?? []), created] }));
      setReply(''); setReplyingTo(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '댓글을 등록하지 못했습니다.');
    } finally { setIsSubmitting(false); }
  };

  const submitTopic = async () => {
    if (!draft.title.trim() || !draft.body.trim() || isSubmitting) return;
    setIsSubmitting(true); setActionError('');
    try {
      const response = await fetch('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardSlug: 'ideas', type: 'normal', title: draft.title.trim(), content: draft.body.trim(), author: '모이라 사용자', tags: [draft.category] }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || '아이디어를 등록하지 못했습니다.');
      const created = mapPost(data.post as ApiPost);
      setTopics((items) => [created, ...items]); setRepliesByTopic((current) => ({ ...current, [created.id]: [] }));
      setSelected(created.id); setCategory('전체 주제'); setDraft({ title: '', body: '', category: topicCategories[0] }); setIsCreateOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '아이디어를 등록하지 못했습니다.');
    } finally { setIsSubmitting(false); }
  };

  return <main className="ideaThreadPage">
    <section className="ideaHero"><div><p className="ideaEyebrow">MOIRA IDEA LAB · THREAD</p><h1>같이 말할수록<br />아이디어는 선명해져요.</h1><p>동네에 필요한 행사를 제안하고, 댓글로 가능성을 더해 함께 완성해 보세요.</p></div></section>
    <section className="threadStats" aria-label="아이디어 게시판 현황"><span><strong>{topics.length}</strong> 열린 아이디어</span><span><strong>{totalReplies}</strong> 시민의 의견</span><span><strong>{Math.max(0, categories.length - 1)}</strong> 아이디어 주제</span></section>
    {/* 고르러 온 상태임을 알려 준다. 버튼만 늘어나 있으면 왜 생겼는지 알 수 없다. */}
    {isPicking && <div className="ideaPickBanner" role="status"><p><strong>기획서에 참고할 의제를 고르는 중입니다.</strong> 마음에 드는 글에서 「이 의제 선택하기」를 누르면 MOIRA STUDIO로 돌아갑니다.</p><button onClick={() => router.push('/studio')} type="button">고르지 않고 돌아가기</button></div>}
    {loadError && <div className="threadLoadState" role="alert"><p>{loadError}</p><button onClick={() => void loadIdeas()} type="button">다시 시도</button></div>}
    {isLoading ? <p className="threadLoadState" role="status">아이디어를 불러오는 중입니다…</p> : <div className={`threadWorkspace ${active ? '' : 'isDetailClosed'} ${isDetailClosing ? 'isClosing' : ''}`}>
      <section className="threadFeed" aria-label="아이디어 목록">
        <div className="threadToolbar"><div className="threadTabs" role="tablist" aria-label="정렬 방식">{(['인기순', '최신순'] as const).map((item) => <button aria-selected={sort === item} className={sort === item ? 'isActive' : ''} key={item} onClick={() => setSort(item)} role="tab" type="button">{item}</button>)}</div><select aria-label="주제 필터" className="threadFilter" onChange={(event) => setCategory(event.target.value)} value={category}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="threadCards">{ordered.map((topic) => <article className={`threadCard ${selected === topic.id ? 'isSelected' : ''}`} key={topic.id} onClick={() => selectTopic(topic.id)}><button aria-label={`${topic.title} 좋아요`} aria-pressed={likedTopics.includes(topic.id)} className={`voteBox ${likedTopics.includes(topic.id) ? 'isLiked' : ''}`} onClick={(event) => { event.stopPropagation(); toggleTopicLike(topic.id); }} type="button"><span>♥</span><strong>{topic.votes + Number(likedTopics.includes(topic.id))}</strong></button><div className="threadCardBody"><div className="threadCardFlags"><span>{topic.category}</span><button aria-label={`${topic.title} 스크랩`} aria-pressed={scrappedTopics.includes(topic.id)} className={`threadCardScrap ${scrappedTopics.includes(topic.id) ? 'isScrapped' : ''}`} onClick={(event) => { event.stopPropagation(); toggleTopicScrap(topic.id); }} type="button">{scrappedTopics.includes(topic.id) ? '★ 스크랩됨' : '☆ 스크랩'}</button>{isPicking && <button className="ideaPickButton" onClick={(event) => { event.stopPropagation(); pickTopic(topic.id); }} type="button">이 의제 선택하기</button>}</div><h2>{topic.title}</h2><p>{topic.body}</p><footer><span className="ideaAvatar">{topic.author[0]}</span><span><strong>{topic.author}</strong> · {topic.role}</span><span>💬 {(repliesByTopic[topic.id] ?? []).length}</span><time dateTime={topic.createdAt}>{formatRelativeTime(topic.createdAt)}</time></footer></div></article>)}</div>
        {ordered.length === 0 && <p className="threadEmpty">아직 등록된 아이디어가 없습니다. 첫 아이디어를 제안해 주세요.</p>}
      </section>
      {active && <aside className={`threadDetail ${isDetailClosing ? 'isClosing' : 'isOpening'}`} aria-label="선택한 아이디어 토론"><div className="threadDetailHeader"><span>{active.category}</span><button aria-label="상세 닫기" onClick={closeDetail} type="button">×</button></div><h2>{active.title}</h2><p>{active.body}</p><div className="threadTopicActions"><button aria-pressed={likedTopics.includes(active.id)} className={likedTopics.includes(active.id) ? 'isActive' : ''} onClick={() => toggleTopicLike(active.id)} type="button"><span>♥</span> 좋아요 <strong>{active.votes + Number(likedTopics.includes(active.id))}</strong></button><button aria-pressed={scrappedTopics.includes(active.id)} className={scrappedTopics.includes(active.id) ? 'isActive' : ''} onClick={() => toggleTopicScrap(active.id)} type="button"><span>{scrappedTopics.includes(active.id) ? '★' : '☆'}</span> {scrappedTopics.includes(active.id) ? '스크랩됨' : '스크랩'}</button>{isPicking && <button className="ideaPickButton" onClick={() => pickTopic(active.id)} type="button">이 의제로 기획서 만들기</button>}</div><div className="threadAuthor"><span className="ideaAvatar">{active.author[0]}</span><div><strong>{active.author}</strong><small>{active.role} · {formatRelativeTime(active.createdAt)}</small></div></div><div className="threadDiscussionTitle"><strong>대화 {activeReplies.length}</strong><button onClick={() => setReplySort((value) => value === '좋아요 순' ? '최신순' : '좋아요 순')} type="button">{replySort} ↕</button></div><div className="replyList">{orderedReplies.map((item) => <article className={item.depth ? 'isNested' : ''} key={item.id}><div><span className="ideaAvatar">{item.author[0]}</span><strong>{item.author}</strong><small>{item.role} · {formatRelativeTime(item.createdAt)}</small></div>{item.parentAuthor && <span className="replyTarget">@{item.parentAuthor}에게 답글</span>}<p>{item.body}</p><footer><button className={likedReplies.includes(item.id) ? 'isLiked' : ''} onClick={() => setLikedReplies((items) => items.includes(item.id) ? items.filter((id) => id !== item.id) : [...items, item.id])} type="button">♡ {item.votes + Number(likedReplies.includes(item.id))}</button><button onClick={() => { setReplyingTo({ id: item.id, author: item.author }); setReply(''); }} type="button">답글 달기</button></footer></article>)}</div>{activeReplies.length === 0 && <p className="threadEmpty">첫 번째 의견을 남겨보세요.</p>}<form className="replyComposer" onSubmit={(event) => { event.preventDefault(); void submitReply(); }}><div><label htmlFor="thread-reply">{replyingTo ? `${replyingTo.author}님에게 답글` : '의견 보태기'}</label>{replyingTo && <button onClick={() => setReplyingTo(null)} type="button">답글 취소</button>}</div><textarea id="thread-reply" maxLength={2000} onChange={(event) => setReply(event.target.value)} placeholder="아이디어가 더 좋아질 수 있는 생각을 나눠주세요." value={reply}/>{actionError && <p className="threadActionError" role="alert">{actionError}</p>}<button disabled={!reply.trim() || isSubmitting} type="submit">{isSubmitting ? '등록 중…' : replyingTo ? '답글 남기기' : '댓글 남기기'}</button></form></aside>}
    </div>}
    <button className="ideaFloatingButton" onClick={() => { setActionError(''); setIsCreateOpen(true); }} type="button"><span>＋</span> 새 아이디어</button>
    {isCreateOpen && <div className="ideaCreateModal" role="dialog" aria-modal="true" aria-labelledby="idea-create-title"><form onSubmit={(event) => { event.preventDefault(); void submitTopic(); }}><button aria-label="닫기" className="ideaCreateClose" onClick={() => setIsCreateOpen(false)} type="button">×</button><p>NEW IDEA</p><h2 id="idea-create-title">동네에 필요한 행사를 제안해 주세요.</h2><label>주제<select onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value }))} value={draft.category}>{topicCategories.map((item) => <option key={item}>{item}</option>)}</select></label><label>제목<input maxLength={100} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="아이디어를 한 문장으로 알려주세요." value={draft.title}/></label><label>내용<textarea maxLength={5000} onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))} placeholder="어떤 행사인지 자유롭게 적어주세요." value={draft.body}/></label>{actionError && <p className="threadActionError" role="alert">{actionError}</p>}<div><button disabled={isSubmitting} onClick={() => setIsCreateOpen(false)} type="button">취소</button><button disabled={!draft.title.trim() || !draft.body.trim() || isSubmitting} type="submit">{isSubmitting ? '등록 중…' : '아이디어 등록'}</button></div></form></div>}
  </main>;
}
