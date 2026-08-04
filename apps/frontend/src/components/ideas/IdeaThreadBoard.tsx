'use client';

import { useMemo, useRef, useState } from 'react';

type Topic = { id: number; title: string; body: string; author: string; role: string; category: string; votes: number; time: string; createdOrder: number };
type Reply = { id: number; author: string; role: string; time: string; body: string; votes: number; depth: number; parentAuthor?: string };

const initialTopics: Topic[] = [
  { id: 1, title: '골목을 무대로 만드는 하루, 우리동네 작은 공연제', body: '빈 점포 앞과 작은도서관 마당을 연결해 주민이 직접 공연하고 관객이 되는 하루를 제안해요.', author: '소연', role: '장전동 주민', category: '문화·예술', votes: 128, time: '12분 전', createdOrder: 3 },
  { id: 2, title: '아이와 어른이 바꾸어 읽는 세대공감 책장', body: '서로에게 한 권을 추천하고 짧은 편지를 책갈피로 남기는 교환 행사는 어떨까요?', author: '책방지기 민호', role: '금정구 활동가', category: '책·배움', votes: 96, time: '1시간 전', createdOrder: 2 },
  { id: 3, title: '버려지는 천으로 만드는 동네 피크닉 매트', body: '재봉을 배우면서 공동 피크닉 물품도 만드는 자원순환 워크숍을 열고 싶습니다.', author: '초록단추', role: '부곡동 주민', category: '환경', votes: 74, time: '어제', createdOrder: 1 },
];

const initialReplies: Record<number, Reply[]> = {
  1: [
    { id: 101, author: '유진', role: '지역 예술가', time: '8분 전', body: '공연 사이 이동 동선에 작은 전시를 두면 골목 전체가 하나의 무대처럼 느껴질 것 같아요.', votes: 19, depth: 0 },
    { id: 102, author: '소연', role: '제안자', time: '5분 전', body: '좋아요! 주민 사진전을 함께 열 수 있도록 아이디어에 반영해 볼게요.', votes: 12, depth: 1, parentAuthor: '유진' },
    { id: 103, author: '도담도서관', role: '공간 파트너', time: '2분 전', body: '도서관 마당은 오후 2시부터 사용할 수 있어요. 음향 규모만 같이 확인하면 좋겠습니다.', votes: 8, depth: 0 },
  ],
  2: [
    { id: 201, author: '지혜', role: '학부모', time: '40분 전', body: '아이와 어른이 같은 책에 서로 다른 추천 이유를 적으면 대화가 더 풍성해질 것 같아요.', votes: 16, depth: 0 },
    { id: 202, author: '책방지기 민호', role: '제안자', time: '31분 전', body: '좋은 생각이에요. 책갈피 앞뒤를 세대별 추천 카드로 구성해 볼게요.', votes: 10, depth: 1, parentAuthor: '지혜' },
    { id: 203, author: '은하도서관', role: '공간 파트너', time: '18분 전', body: '교환할 책을 미리 기증받는다면 도서관 로비에 일주일간 전시할 수 있습니다.', votes: 7, depth: 0 },
  ],
  3: [
    { id: 301, author: '수진', role: '재봉 모임 운영자', time: '20시간 전', body: '초보자도 참여할 수 있도록 재단된 천 조각과 손바느질 코너를 따로 준비하면 좋겠습니다.', votes: 14, depth: 0 },
    { id: 302, author: '초록단추', role: '제안자', time: '18시간 전', body: '매트 크기별 난이도를 나누고 남은 조각으로 이름표도 만들면 좋겠네요.', votes: 9, depth: 1, parentAuthor: '수진' },
  ],
};

export default function IdeaThreadBoard() {
  const [topics, setTopics] = useState(initialTopics);
  const [repliesByTopic, setRepliesByTopic] = useState(initialReplies);
  const [sort, setSort] = useState<'인기순' | '최신순'>('인기순');
  const [replySort, setReplySort] = useState<'좋아요 순' | '최신순'>('좋아요 순');
  const [category, setCategory] = useState('전체 주제');
  const [selected, setSelected] = useState<number | null>(1);
  const [isDetailClosing, setIsDetailClosing] = useState(false);
  const [likedTopics, setLikedTopics] = useState<number[]>([]);
  const [scrappedTopics, setScrappedTopics] = useState<number[]>([]);
  const [likedReplies, setLikedReplies] = useState<number[]>([]);
  const [reply, setReply] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', category: '문화·예술' });
  const closeTimer = useRef<number | null>(null);

  const categories = ['전체 주제', ...Array.from(new Set(topics.map((topic) => topic.category)))];
  const ordered = useMemo(() => topics
    .filter((topic) => category === '전체 주제' || topic.category === category)
    .sort((left, right) => sort === '인기순' ? right.votes - left.votes : right.createdOrder - left.createdOrder), [topics, category, sort]);
  const active = selected === null ? null : topics.find((topic) => topic.id === selected) ?? null;
  const activeReplies = active ? repliesByTopic[active.id] ?? [] : [];
  const orderedReplies = [...activeReplies].sort((left, right) => replySort === '좋아요 순' ? right.votes - left.votes : right.id - left.id);
  const totalReplies = Object.values(repliesByTopic).reduce((sum, items) => sum + items.length, 0);
  const toggleTopicLike = (id: number) => setLikedTopics((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const toggleTopicScrap = (id: number) => setScrappedTopics((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const selectTopic = (id: number) => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    setIsDetailClosing(false);
    setSelected(id);
  };
  const closeDetail = () => {
    setIsDetailClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setSelected(null);
      setIsDetailClosing(false);
      closeTimer.current = null;
    }, 320);
  };

  const submitReply = () => {
    if (!active || !reply.trim()) return;
    const newReply: Reply = { id: Date.now(), author: '나', role: '동네 주민', time: '방금 전', body: reply.trim(), votes: 0, depth: replyingTo ? 1 : 0, parentAuthor: replyingTo ?? undefined };
    setRepliesByTopic((current) => ({ ...current, [active.id]: [...(current[active.id] ?? []), newReply] }));
    setReply(''); setReplyingTo(null);
  };

  const submitTopic = () => {
    if (!draft.title.trim() || !draft.body.trim()) return;
    const id = Date.now();
    setTopics((items) => [{ id, title: draft.title.trim(), body: draft.body.trim(), author: '나', role: '동네 주민', category: draft.category, votes: 0, time: '방금 전', createdOrder: Math.max(...items.map((item) => item.createdOrder), 0) + 1 }, ...items]);
    setRepliesByTopic((current) => ({ ...current, [id]: [] }));
    setSelected(id); setCategory('전체 주제'); setDraft({ title: '', body: '', category: '문화·예술' }); setIsCreateOpen(false);
  };

  return <main className="ideaThreadPage">
    <section className="ideaHero"><div><p className="ideaEyebrow">MOIRA IDEA LAB · THREAD</p><h1>같이 말할수록<br />아이디어는 선명해져요.</h1><p>동네에 필요한 행사를 제안하고, 댓글로 가능성을 더해 함께 완성해 보세요.</p></div></section>
    <section className="threadStats" aria-label="아이디어 게시판 현황"><span><strong>{topics.length}</strong> 열린 아이디어</span><span><strong>{totalReplies}</strong> 시민의 의견</span><span><strong>{categories.length - 1}</strong> 아이디어 주제</span></section>
    <div className={`threadWorkspace ${active ? '' : 'isDetailClosed'} ${isDetailClosing ? 'isClosing' : ''}`}>
      <section className="threadFeed" aria-label="아이디어 목록">
        <div className="threadToolbar"><div className="threadTabs" role="tablist" aria-label="정렬 방식">{(['인기순', '최신순'] as const).map((item) => <button aria-selected={sort === item} className={sort === item ? 'isActive' : ''} key={item} onClick={() => setSort(item)} role="tab" type="button">{item}</button>)}</div><select aria-label="주제 필터" className="threadFilter" onChange={(event) => setCategory(event.target.value)} value={category}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="threadCards">{ordered.map((topic) => <article className={`threadCard ${selected === topic.id ? 'isSelected' : ''}`} key={topic.id} onClick={() => selectTopic(topic.id)}><button aria-label={`${topic.title} 좋아요`} aria-pressed={likedTopics.includes(topic.id)} className={`voteBox ${likedTopics.includes(topic.id) ? 'isLiked' : ''}`} onClick={(event) => { event.stopPropagation(); toggleTopicLike(topic.id); }} type="button"><span>♥</span><strong>{topic.votes + (likedTopics.includes(topic.id) ? 1 : 0)}</strong></button><div className="threadCardBody"><div className="threadCardFlags"><span>{topic.category}</span><button aria-label={`${topic.title} 스크랩`} aria-pressed={scrappedTopics.includes(topic.id)} className={`threadCardScrap ${scrappedTopics.includes(topic.id) ? 'isScrapped' : ''}`} onClick={(event) => { event.stopPropagation(); toggleTopicScrap(topic.id); }} type="button">{scrappedTopics.includes(topic.id) ? '★ 스크랩됨' : '☆ 스크랩'}</button></div><h2>{topic.title}</h2><p>{topic.body}</p><footer><span className="ideaAvatar">{topic.author[0]}</span><span><strong>{topic.author}</strong> · {topic.role}</span><span>💬 {(repliesByTopic[topic.id] ?? []).length}</span><time>{topic.time}</time></footer></div></article>)}</div>
        {ordered.length === 0 && <p className="threadEmpty">해당 주제의 아이디어가 아직 없습니다.</p>}
      </section>
      {active && <aside className={`threadDetail ${isDetailClosing ? 'isClosing' : 'isOpening'}`} aria-label="선택한 아이디어 토론"><div className="threadDetailHeader"><span>{active.category}</span><button aria-label="상세 닫기" onClick={closeDetail} type="button">×</button></div><h2>{active.title}</h2><p>{active.body}</p><div className="threadTopicActions"><button aria-pressed={likedTopics.includes(active.id)} className={likedTopics.includes(active.id) ? 'isActive' : ''} onClick={() => toggleTopicLike(active.id)} type="button"><span>♥</span> 좋아요 <strong>{active.votes + (likedTopics.includes(active.id) ? 1 : 0)}</strong></button><button aria-pressed={scrappedTopics.includes(active.id)} className={scrappedTopics.includes(active.id) ? 'isActive' : ''} onClick={() => toggleTopicScrap(active.id)} type="button"><span>{scrappedTopics.includes(active.id) ? '★' : '☆'}</span> {scrappedTopics.includes(active.id) ? '스크랩됨' : '스크랩'}</button></div><div className="threadAuthor"><span className="ideaAvatar">{active.author[0]}</span><div><strong>{active.author}</strong><small>{active.role} · {active.time}</small></div></div><div className="threadDiscussionTitle"><strong>대화 {activeReplies.length}</strong><button onClick={() => setReplySort((value) => value === '좋아요 순' ? '최신순' : '좋아요 순')} type="button">{replySort} ↕</button></div><div className="replyList">{orderedReplies.map((item) => <article className={item.depth ? 'isNested' : ''} key={item.id}><div><span className="ideaAvatar">{item.author[0]}</span><strong>{item.author}</strong><small>{item.role} · {item.time}</small></div>{item.parentAuthor && <span className="replyTarget">@{item.parentAuthor}에게 답글</span>}<p>{item.body}</p><footer><button className={likedReplies.includes(item.id) ? 'isLiked' : ''} onClick={() => setLikedReplies((items) => items.includes(item.id) ? items.filter((id) => id !== item.id) : [...items, item.id])} type="button">♡ {item.votes + (likedReplies.includes(item.id) ? 1 : 0)}</button><button onClick={() => { setReplyingTo(item.author); setReply(''); }} type="button">답글 달기</button></footer></article>)}</div>{activeReplies.length === 0 && <p className="threadEmpty">첫 번째 의견을 남겨보세요.</p>}<form className="replyComposer" onSubmit={(event) => { event.preventDefault(); submitReply(); }}><div><label htmlFor="thread-reply">{replyingTo ? `${replyingTo}님에게 답글` : '의견 보태기'}</label>{replyingTo && <button onClick={() => setReplyingTo(null)} type="button">답글 취소</button>}</div><textarea id="thread-reply" onChange={(event) => setReply(event.target.value)} placeholder="아이디어가 더 좋아질 수 있는 생각을 나눠주세요." value={reply}/><button disabled={!reply.trim()} type="submit">{replyingTo ? '답글 남기기' : '댓글 남기기'}</button></form></aside>}
    </div>
    <button className="ideaFloatingButton" onClick={() => setIsCreateOpen(true)} type="button"><span>＋</span> 새 아이디어</button>
    {isCreateOpen && <div className="ideaCreateModal" role="dialog" aria-modal="true" aria-labelledby="idea-create-title"><form onSubmit={(event) => { event.preventDefault(); submitTopic(); }}><button aria-label="닫기" className="ideaCreateClose" onClick={() => setIsCreateOpen(false)} type="button">×</button><p>NEW IDEA</p><h2 id="idea-create-title">동네에 필요한 행사를 제안해 주세요.</h2><label>주제<select onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value }))} value={draft.category}>{['문화·예술', '책·배움', '환경', '생활'].map((item) => <option key={item}>{item}</option>)}</select></label><label>제목<input maxLength={60} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="아이디어를 한 문장으로 알려주세요." value={draft.title}/></label><label>내용<textarea maxLength={300} onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))} placeholder="어떤 행사인지 자유롭게 적어주세요." value={draft.body}/></label><div><button onClick={() => setIsCreateOpen(false)} type="button">취소</button><button disabled={!draft.title.trim() || !draft.body.trim()} type="submit">아이디어 등록</button></div></form></div>}
  </main>;
}
