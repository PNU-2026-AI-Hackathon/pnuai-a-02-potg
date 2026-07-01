'use client';

import { useMemo, useState } from 'react';

type InterestCategory = {
  id: string;
  title: string;
  description: string;
  icon: string;
  tintClass: string;
};

const categories: InterestCategory[] = [
  {
    id: 'reading',
    title: '독서/인문',
    description: '독서 모임, 글쓰기, 인문 강연',
    icon: '📚',
    tintClass: 'interestTintWarm',
  },
  {
    id: 'culture',
    title: '문화/예술',
    description: '공연, 전시, 만들기, 그림책 활동',
    icon: '🎨',
    tintClass: 'interestTintSun',
  },
  {
    id: 'digital',
    title: '디지털/AI',
    description: '스마트폰, 키오스크, AI 활용 교육',
    icon: '🤖',
    tintClass: 'interestTintSky',
  },
  {
    id: 'children',
    title: '아동/가족',
    description: '방과후, 독서놀이, 가족 참여 프로그램',
    icon: '👨‍👩‍👧‍👦',
    tintClass: 'interestTintMint',
  },
  {
    id: 'youth',
    title: '청소년/진로',
    description: '진로 탐색, 동아리, 프로젝트형 활동',
    icon: '🧭',
    tintClass: 'interestTintIndigo',
  },
  {
    id: 'senior',
    title: '시니어/복지',
    description: '디지털 문해, 건강, 생활정보 지원',
    icon: '🌿',
    tintClass: 'interestTintRose',
  },
  {
    id: 'community',
    title: '지역참여',
    description: '주민 의제, 마을 회의, 공감형 제안',
    icon: '🏘️',
    tintClass: 'interestTintViolet',
  },
  {
    id: 'volunteer',
    title: '봉사/나눔',
    description: '도서관 봉사, 멘토링, 참여형 활동',
    icon: '🤝',
    tintClass: 'interestTintGold',
  },
];

export default function InterestsPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectionSummary = useMemo(() => {
    if (selectedIds.length === 0) {
      return '선택된 관심분야 없음';
    }

    return `선택된 관심분야 ${selectedIds.length}개`;
  }, [selectedIds]);

  function toggleCategory(categoryId: string) {
    setSelectedIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  function handleSkip() {
    setSelectedIds([]);
  }

  return (
    <main className="interestPage">
      <div className="interestShell">
        <section className="interestCardShell" aria-labelledby="interest-panel-title">
          <div className="interestCardHead">
            <p className="interestEyebrow">모이라 회원가입</p>
            <h1 id="interest-panel-title">관심 분야를 선택해 주세요</h1>
            <p className="interestLead">
              관심 있는 주제를 골라 두면 이후 도서관 프로그램과 주민 의제 탐색에 활용되는 화면입니다.
            </p>
          </div>

          <div className="interestSelectionBar">
            <span>{selectionSummary}</span>
            <span>{selectedIds.length > 0 ? '복수 선택 가능' : '아무거나 눌러 선택해 보세요'}</span>
          </div>

          <div className="interestGrid">
            {categories.map((category) => {
              const isSelected = selectedIds.includes(category.id);

              return (
                <button
                  key={category.id}
                  type="button"
                  className={`interestCard ${category.tintClass} ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleCategory(category.id)}
                  aria-pressed={isSelected}
                >
                  <span className="interestIcon" aria-hidden="true">
                    {category.icon}
                  </span>
                  <span className="interestTitle">{category.title}</span>
                  <span className="interestDescription">{category.description}</span>
                  <span className="interestState">{isSelected ? '선택됨' : '선택하기'}</span>
                </button>
              );
            })}
          </div>

          <div className="interestActionRow">
            <button type="button" className="interestGhostButton" onClick={handleSkip}>
              건너뛰기
            </button>
            <button type="button" className="interestPrimaryButton" onClick={() => undefined}>
              완료
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}