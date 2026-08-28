'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type VotingDocument = {
  id: string;
  title: string;
  content: string;
  voteCount: number;
  hasVoted: boolean;
  myIntention: string | null;
  myTimeSlot: string | null;
};

const intentions = ['꼭 참여하고 싶어요', '일정이 맞으면 참여하고 싶어요', '관심은 있지만 참여는 어려워요', '관심이 없어요'];
const timeSlots = ['평일 오전', '평일 오후', '평일 저녁', '주말'];

export default function StudioVotingDetail({ documentId }: { documentId: string }) {
  const [document, setDocument] = useState<VotingDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [intention, setIntention] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voteError, setVoteError] = useState('');

  useEffect(() => {
    fetch(`/api/studio/votes/${documentId}`, { cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => {
        const loaded = data.document as VotingDocument;
        setDocument(loaded);
        setIntention(loaded.myIntention ?? '');
        setTimeSlot(loaded.myTimeSlot ?? '');
      })
      .catch(() => setFailed(true));
  }, [documentId]);

  useEffect(() => {
    if (!isVoting) return;
    const overflow = globalThis.document.body.style.overflow;
    globalThis.document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsVoting(false); };
    globalThis.document.addEventListener('keydown', close);
    return () => {
      globalThis.document.body.style.overflow = overflow;
      globalThis.document.removeEventListener('keydown', close);
    };
  }, [isVoting]);

  async function submitVote(event: React.FormEvent) {
    event.preventDefault();
    if (!document || !intention || submitting) return;
    setSubmitting(true);
    setVoteError('');
    try {
      const response = await fetch(`/api/studio/votes/${encodeURIComponent(document.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intention, timeSlot }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '응답을 저장하지 못했습니다.');
      setDocument(data.document as VotingDocument);
      setIsVoting(false);
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : '응답을 저장하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelVote() {
    if (!document || submitting) return;
    setSubmitting(true);
    setVoteError('');
    try {
      const response = await fetch(`/api/studio/votes/${encodeURIComponent(document.id)}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '응답을 취소하지 못했습니다.');
      setDocument(data.document as VotingDocument);
      setIntention('');
      setTimeSlot('');
      setIsVoting(false);
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : '응답을 취소하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (failed) return <main className="studioVotingPage"><section className="uiContainer studioVotingDetail"><p className="studioVotingNotice">기획서를 불러오지 못했거나 수요조사가 종료되었습니다.</p><Link href="/survey">수요조사 목록으로 돌아가기</Link></section></main>;
  if (!document) return <main className="studioVotingPage"><p className="studioVotingNotice">기획서를 불러오는 중입니다.</p></main>;

  return <main className="studioVotingPage"><article className="uiContainer studioVotingDetail">
    <Link className="studioVotingBack" href="/survey">← 수요조사 목록</Link>
    <header><span>수요조사 중 · {document.voteCount}명 참여{document.hasVoted ? ' · 참여 완료' : ''}</span><h1>{document.title}</h1></header>
    <div className="studioVotingFullContent">{document.content}</div>
    <div className="studioVotingDetailActions"><button className="uiButton uiButtonPrimary" type="button" onClick={() => { setVoteError(''); setIsVoting(true); }}>{document.hasVoted ? '내 응답 수정' : '수요조사 참여'}</button></div>
    {isVoting ? <div className="surveyModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsVoting(false); }}>
      <div className="surveyModal studioVotingModal" role="dialog" aria-modal="true" aria-labelledby="studio-detail-vote-title">
        <button className="surveyModalClose" type="button" aria-label="수요조사 창 닫기" onClick={() => setIsVoting(false)}>×</button>
        <p className="uiEyebrow">PROGRAM SURVEY</p><h2 id="studio-detail-vote-title">{document.title}</h2>
        <form onSubmit={submitVote}>
          <fieldset><legend>이 프로그램이 개설된다면 참여할 의향이 있나요?</legend><div className="surveyOptions">{intentions.map((option) => <label key={option}><input type="radio" name="detail-intention" value={option} checked={intention === option} onChange={(event) => setIntention(event.target.value)} /><span>{option}</span></label>)}</div></fieldset>
          <fieldset><legend>선호하는 시간대가 있나요? <small>선택사항</small></legend><div className="surveyTimeOptions">{timeSlots.map((option) => <label key={option}><input type="radio" name="detail-time-slot" value={option} checked={timeSlot === option} onChange={(event) => setTimeSlot(event.target.value)} /><span>{option}</span></label>)}</div></fieldset>
          {voteError ? <p role="alert">{voteError}</p> : null}
          <button className="uiButton uiButtonPrimary surveySubmit" type="submit" disabled={!intention || submitting}>{submitting ? '처리 중…' : document.hasVoted ? '응답 수정하기' : '응답 제출'}</button>
          {document.hasVoted ? <button type="button" className="studioVotingModalCancel" disabled={submitting} onClick={() => void cancelVote()}>응답 취소</button> : null}
        </form>
      </div>
    </div> : null}
  </article></main>;
}
