'use client';

import { useEffect, useState } from 'react';

type Option = { value: string; label: string };
type Filters = { q: string; status: string; target: string; library: string };

export function ProgramBoardHero() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <header className="programBoardHero" data-expanded={isExpanded} onClick={() => setIsExpanded((value) => !value)}>
      <div>
        <p className="programBoardEyebrow">MOIRA LIBRARY · PROGRAM</p>
        <div className="programBoardHeroHeading">
          <h1 id="program-board-title">우리 동네에서<br />열리는 프로그램들</h1>
          <button
            className="programBoardHeroToggle"
            type="button"
            aria-expanded={isExpanded}
            aria-controls="program-board-introduction"
            onClick={(event) => {
              event.stopPropagation();
              setIsExpanded((value) => !value);
            }}
          >
            <span className="uiSrOnly">프로그램 게시판 소개 {isExpanded ? '접기' : '펼치기'}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
          </button>
        </div>
        <p id="program-board-introduction">금정구 도서관이 운영한 문화·교육 프로그램을 한곳에서 확인해 보세요.</p>
      </div>
    </header>
  );
}

export function ProgramFilterPanel({ filters, statusOptions, targetOptions, libraryOptions }: {
  filters: Filters;
  statusOptions: Option[];
  targetOptions: string[];
  libraryOptions: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  return (
    <div className="programFilterPanel">
      <button className="programFilterOpen" type="button" onClick={() => setIsOpen(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
        프로그램 검색
      </button>
      {isOpen ? <button className="programFilterBackdrop" type="button" aria-label="검색 팝업 닫기" onClick={() => setIsOpen(false)} /> : null}
      <form action="/programs" className={`programFilterBar ${isOpen ? 'isMobileOpen' : ''}`} method="get" aria-label="프로그램 검색 및 필터">
        <div className="programFilterModalHeading">
          <strong>프로그램 검색</strong>
          <button type="button" aria-label="검색 팝업 닫기" onClick={() => setIsOpen(false)}>×</button>
        </div>
        <label>
          <span>접수별</span>
          <select defaultValue={filters.status} name="status">
            {statusOptions.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>대상별</span>
          <select defaultValue={filters.target} name="target">
            <option value="">전체 대상</option>
            {targetOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label>
          <span>도서관</span>
          <select defaultValue={filters.library} name="library">
            <option value="">전체 도서관</option>
            {libraryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="programFilterSearch">
          <span>프로그램 검색</span>
          <input defaultValue={filters.q} name="q" placeholder="프로그램명 또는 도서관명" type="search" />
        </label>
        <button className="uiButton uiButtonPrimary" type="submit">검색</button>
      </form>
    </div>
  );
}
