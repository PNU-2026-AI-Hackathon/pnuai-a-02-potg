'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CommunitySectionBreadcrumb from '@/components/community/CommunitySectionBreadcrumb';

type VotingDocument = {
  id: string; title: string; content: string; voteCount: number; hasVoted: boolean;
  myIntention: string | null; myTimeSlot: string | null; updatedAt: string;
};
type Selection = { intention: string; timeSlot: string };
type Sort = 'popular' | 'latest';

const PAGE_SIZE = 9;
const intentions = ['꼭 참여하고 싶어요', '일정이 맞으면 참여하고 싶어요', '관심은 있지만 참여는 어려워요', '관심이 없어요'];
const timeSlots = ['평일 오전', '평일 오후', '평일 저녁', '주말'];

function fieldValue(content: string, label: string) {
  return content.match(new RegExp(`(?:^|\\n)${label}\\n([^\\n]+)`))?.[1]?.trim() ?? '';
}

function Icon({ name }: { name: 'search' | 'book' | 'users' | 'check' | 'empty' }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    book: <><path d="M4 5a3 3 0 0 1 3-3h5v18H7a3 3 0 0 0-3 3Z"/><path d="M20 5a3 3 0 0 0-3-3h-5v18h5a3 3 0 0 1 3 3Z"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    empty: <><path d="M4 5h16v14H4z"/><path d="m8 10 2 2 5-5"/><path d="M8 16h8"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function StudioVotingBoard() {
  const [documents, setDocuments] = useState<VotingDocument[]>([]);
  const [selections, setSelections] = useState<Record<string, Selection>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('popular');
  const [page, setPage] = useState(1);

  const loadDocuments = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/studio/votes', { cache: 'no-store' });
      if (!response.ok) throw new Error();
      const data = await response.json() as { documents?: VotingDocument[] };
      const rows = data.documents ?? [];
      setDocuments(rows);
      setSelections(Object.fromEntries(rows.map((row) => [row.id, { intention: row.myIntention ?? '', timeSlot: row.myTimeSlot ?? '' }])));
    } catch { setError('프로그램을 불러오지 못했습니다.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('ko');
    const rows = keyword ? documents.filter((document) => document.title.toLocaleLowerCase('ko').includes(keyword)) : [...documents];
    return rows.sort((a, b) => sort === 'popular'
      ? b.voteCount - a.voteCount || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
      : Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [documents, query, sort]);
  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [query, sort]);

  function select(documentId: string, key: keyof Selection, value: string) {
    setSelections((current) => ({ ...current, [documentId]: { ...(current[documentId] ?? { intention: '', timeSlot: '' }), [key]: value } }));
  }

  async function submitVote(document: VotingDocument) {
    const selection = selections[document.id];
    if (!selection?.intention) return;
    setPendingId(document.id); setError('');
    try {
      const response = await fetch(`/api/studio/votes/${document.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selection) });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setDocuments((current) => current.map((item) => item.id === document.id ? data.document : item));
      setSelectedId(null);
    } catch { setError('응답을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    finally { setPendingId(null); }
  }

  async function cancelVote(document: VotingDocument) {
    setPendingId(document.id); setError('');
    try {
      const response = await fetch(`/api/studio/votes/${document.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setDocuments((current) => current.map((item) => item.id === document.id ? data.document : item));
      setSelections((current) => ({ ...current, [document.id]: { intention: '', timeSlot: '' } }));
      setSelectedId(null);
    } catch { setError('응답 취소를 처리하지 못했습니다.'); }
    finally { setPendingId(null); }
  }

  const selectedDocument = documents.find((document) => document.id === selectedId);

  return <main className="studioVotingPage"><section className="uiContainer studioVotingShell">
    <CommunitySectionBreadcrumb current="프로그램 수요조사" />
    <section className="studioVotingHero" aria-labelledby="studio-voting-title"><div><p>MOIRA STUDIO</p><h1 id="studio-voting-title">우리 동네 프로그램 수요조사</h1><span>도서관에서 만나고 싶은 프로그램의 수요조사에 참여해 주세요.<br />여러분의 응답은 도서관 프로그램을 준비하는 데 도움이 됩니다.</span></div><div className="studioVotingHeroArt" aria-hidden="true"><div className="studioVotingBallot"><i /><i /><Icon name="check" /></div><div className="studioVotingBooks"><i /><i /><i /></div></div></section>

    {!loading && !error && documents.length > 0 ? <section className="studioVotingControls" aria-label="프로그램 탐색"><p>프로그램 <strong>{filtered.length}</strong></p><div><label className="studioVotingSearch"><Icon name="search" /><span className="uiSrOnly">프로그램 검색</span><input type="search" placeholder="프로그램명으로 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="studioVotingSort"><span className="uiSrOnly">정렬</span><select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="popular">인기순</option><option value="latest">최신순</option></select></label></div></section> : null}

    {error ? <section className="studioVotingState" role="alert"><Icon name="empty" /><h2>프로그램을 불러오지 못했습니다.</h2><p>잠시 후 다시 시도해주세요.</p><button type="button" onClick={() => void loadDocuments()}>다시 시도</button></section> : null}
    {loading ? <div className="studioVotingGrid" aria-label="프로그램을 불러오는 중">{Array.from({ length: 6 }, (_, index) => <div className="studioVotingSkeleton" key={index}><i /><b /><span /><span /><em /></div>)}</div> : null}
    {!loading && !error && documents.length === 0 ? <section className="studioVotingState"><Icon name="empty" /><h2>현재 진행 중인 프로그램 수요조사가 없습니다.</h2><p>새로운 프로그램이 등록되면 이곳에서 확인할 수 있습니다.</p></section> : null}
    {!loading && !error && documents.length > 0 && filtered.length === 0 ? <section className="studioVotingState"><Icon name="search" /><h2>검색 결과가 없습니다.</h2><p>다른 검색어를 입력해주세요.</p></section> : null}

    {!loading && !error && pageItems.length > 0 ? <div className="studioVotingGrid">{pageItems.map((document) => {
      const description = fieldValue(document.content, '기획 의도') || document.content.replace(/\s+/g, ' ').trim();
      return <article className="studioVotingCard" key={document.id}>
        <div className="studioVotingCardTop"><span>수요조사 중</span>{document.hasVoted ? <strong><Icon name="check" /> 참여 완료</strong> : null}</div>
        <div className="studioVotingCardIdentity"><div><Icon name="book" /></div><h2>{document.title}</h2></div>
        <p className="studioVotingContent">{description}</p>
        <Link className="studioVotingDetailLink" href={`/survey/${document.id}`}>자세히 보기 <span aria-hidden="true">→</span></Link>
        <footer className="studioVotingCardFooter"><span><Icon name="users" />{document.voteCount}명 참여</span><button type="button" className={document.hasVoted ? 'isVoted' : ''} onClick={() => setSelectedId(document.id)}>{document.hasVoted ? <><Icon name="check" />내 응답 수정</> : '수요조사 참여'}</button></footer>
      </article>;
    })}</div> : null}

    {lastPage > 1 && filtered.length > 0 ? <nav className="studioVotingPagination" aria-label="프로그램 목록 페이지"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} aria-label="이전 페이지">←</button>{Array.from({ length: lastPage }, (_, index) => index + 1).map((number) => <button type="button" className={page === number ? 'isCurrent' : ''} aria-current={page === number ? 'page' : undefined} onClick={() => setPage(number)} key={number}>{number}</button>)}<button type="button" disabled={page === lastPage} onClick={() => setPage((value) => value + 1)} aria-label="다음 페이지">→</button></nav> : null}

    {selectedDocument ? (() => { const selection = selections[selectedDocument.id] ?? { intention: '', timeSlot: '' }; return <div className="surveyModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}><div className="surveyModal studioVotingModal" role="dialog" aria-modal="true" aria-labelledby="studio-vote-modal-title"><button className="surveyModalClose" type="button" aria-label="수요조사 창 닫기" onClick={() => setSelectedId(null)}>×</button><p className="uiEyebrow">PROGRAM SURVEY</p><h2 id="studio-vote-modal-title">{selectedDocument.title}</h2><form onSubmit={(event) => { event.preventDefault(); void submitVote(selectedDocument); }}><fieldset><legend>이 프로그램이 개설된다면 참여할 의향이 있나요?</legend><div className="surveyOptions">{intentions.map((option) => <label key={option}><input type="radio" name="intention" checked={selection.intention === option} onChange={() => select(selectedDocument.id, 'intention', option)} /><span>{option}</span></label>)}</div></fieldset><fieldset><legend>선호하는 시간대가 있나요? <small>선택사항</small></legend><div className="surveyTimeOptions">{timeSlots.map((option) => <label key={option}><input type="radio" name="timeSlot" checked={selection.timeSlot === option} onChange={() => select(selectedDocument.id, 'timeSlot', option)} /><span>{option}</span></label>)}</div></fieldset><button className="uiButton uiButtonPrimary surveySubmit" type="submit" disabled={!selection.intention || pendingId === selectedDocument.id}>{pendingId === selectedDocument.id ? '처리 중…' : selectedDocument.hasVoted ? '응답 수정하기' : '응답 제출'}</button>{selectedDocument.hasVoted ? <button type="button" className="studioVotingModalCancel" disabled={pendingId === selectedDocument.id} onClick={() => cancelVote(selectedDocument)}>응답 취소</button> : null}</form></div></div>; })() : null}
  </section></main>;
}
