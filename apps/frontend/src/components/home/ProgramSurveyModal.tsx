'use client';

import { useEffect, useRef, useState } from 'react';
import type { HomeVotingDocument } from './ProgramSurveySection';

type Props = { program: HomeVotingDocument; onUpdated: (program: HomeVotingDocument) => void; onClose: () => void };
const intentions = ['꼭 참여하고 싶어요', '일정이 맞으면 참여하고 싶어요', '관심은 있지만 참여는 어려워요', '관심이 없어요'];
const timeSlots = ['평일 오전', '평일 오후', '평일 저녁', '주말'];

export default function ProgramSurveyModal({ program, onUpdated, onClose }: Props) {
  const [intention, setIntention] = useState(program.myIntention ?? '');
  const [timeSlot, setTimeSlot] = useState(program.myTimeSlot ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', close); };
  }, [onClose]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!intention) return;
    setSubmitting(true); setError('');
    try {
      const response = await fetch(`/api/studio/votes/${program.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intention, timeSlot }) });
      const data = await response.json();
      if (!response.ok) throw new Error();
      onUpdated(data.document);
      onClose();
    } catch { setError('응답을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    finally { setSubmitting(false); }
  }

  return <div className="surveyModalBackdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="surveyModal" role="dialog" aria-modal="true" aria-labelledby="survey-modal-title" ref={dialogRef}>
      <button className="surveyModalClose" type="button" onClick={onClose} aria-label="수요조사 닫기">×</button>
      <p className="uiEyebrow">PROGRAM SURVEY</p><h2 id="survey-modal-title">{program.title}</h2>
      <form onSubmit={submit}>
        <fieldset><legend>이 프로그램이 개설된다면 참여할 의향이 있나요?</legend><div className="surveyOptions">{intentions.map((option) => <label key={option}><input type="radio" name="intention" value={option} checked={intention === option} onChange={(event) => setIntention(event.target.value)} /><span>{option}</span></label>)}</div></fieldset>
        <fieldset><legend>선호하는 시간대가 있나요? <small>선택사항</small></legend><div className="surveyTimeOptions">{timeSlots.map((option) => <label key={option}><input type="radio" name="timeSlot" value={option} checked={timeSlot === option} onChange={(event) => setTimeSlot(event.target.value)} /><span>{option}</span></label>)}</div></fieldset>
        {error ? <p role="alert">{error}</p> : null}
        <button className="uiButton uiButtonPrimary surveySubmit" type="submit" disabled={!intention || submitting}>{submitting ? '저장 중…' : program.hasVoted ? '응답 수정하기' : '응답 제출'}</button>
      </form>
    </div>
  </div>;
}
