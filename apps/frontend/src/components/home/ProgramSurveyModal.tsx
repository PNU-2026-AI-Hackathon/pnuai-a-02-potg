'use client';

import { useEffect, useRef, useState } from 'react';

type Program = {
  title: string;
  audience: string;
};

type ProgramSurveyModalProps = {
  program: Program;
  onClose: () => void;
};

const intentions = [
  '꼭 참여하고 싶어요',
  '일정이 맞으면 참여하고 싶어요',
  '관심은 있지만 참여는 어려워요',
  '관심이 없어요',
];

const timeSlots = ['평일 오전', '평일 오후', '평일 저녁', '주말'];

export default function ProgramSurveyModal({
  program,
  onClose,
}: ProgramSurveyModalProps) {
  const [intention, setIntention] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled])',
          ),
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (intention) {
      setSubmitted(true);
    }
  }

  return (
    <div
      className="surveyModalBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="surveyModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="survey-modal-title"
        ref={dialogRef}
      >
        <button
          className="surveyModalClose"
          type="button"
          onClick={onClose}
          aria-label="수요조사 닫기"
          ref={closeButtonRef}
        >
          ×
        </button>
        {submitted ? (
          <div className="surveyComplete" role="status">
            <span aria-hidden="true">✓</span>
            <p className="uiEyebrow">참여 완료</p>
            <h2>소중한 의견을 보태주셔서 고맙습니다.</h2>
            <p>
              ‘{program.title}’ 수요조사에 참여 의사가 반영되었습니다.
            </p>
            <button className="uiButton uiButtonPrimary" type="button" onClick={onClose}>
              확인
            </button>
          </div>
        ) : (
          <>
            <p className="uiEyebrow">PROGRAM SURVEY</p>
            <h2 id="survey-modal-title">{program.title}</h2>
            <p className="surveyModalMeta">대상 · {program.audience}</p>
            <form onSubmit={handleSubmit}>
              <fieldset>
                <legend>이 프로그램이 개설된다면 참여할 의향이 있나요?</legend>
                <div className="surveyOptions">
                  {intentions.map((option) => (
                    <label key={option}>
                      <input
                        type="radio"
                        name="intention"
                        value={option}
                        checked={intention === option}
                        onChange={(event) => setIntention(event.target.value)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend>
                  선호하는 시간대가 있나요? <small>선택</small>
                </legend>
                <div className="surveyTimeOptions">
                  {timeSlots.map((option) => (
                    <label key={option}>
                      <input
                        type="radio"
                        name="timeSlot"
                        value={option}
                        checked={timeSlot === option}
                        onChange={(event) => setTimeSlot(event.target.value)}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button
                className="uiButton uiButtonPrimary surveySubmit"
                type="submit"
                disabled={!intention}
              >
                의견 보내기
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
