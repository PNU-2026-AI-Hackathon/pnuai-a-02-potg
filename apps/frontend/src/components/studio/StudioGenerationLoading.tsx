'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type GenerationState = 'generating' | 'complete' | 'failed';

const dummyDocumentId = 'demo-document-1';

const dummyGenerationSummary = {
  category: '디지털 역량',
  audience: '시니어',
  age: '60대 이상',
  operation: '강의 + 실습',
  period: '4회차',
  budget: '50만 원 이하',
  location: '작은도서관 프로그램실',
  agenda: '시니어 대상 스마트폰 반복 교육이 필요합니다',
  memo: '스마트폰 사용이 익숙하지 않은 어르신을 위한 생활 밀착형 프로그램',
};

const generationSteps = [
  {
    label: '조건 확인',
    description: '선택한 분야, 대상, 운영 조건을 점검합니다.',
  },
  {
    label: '기획 구조 구성',
    description: '기획 배경과 목적, 운영 흐름의 뼈대를 정리합니다.',
  },
  {
    label: '세부 운영 내용 작성',
    description: '회차별 활동과 준비물을 더미 초안에 배치합니다.',
  },
  {
    label: '기획서 초안 정리',
    description: '편집 화면에서 이어서 다듬을 수 있도록 문서를 준비합니다.',
  },
];

const summaryItems = [
  ['프로그램 분야', dummyGenerationSummary.category],
  ['프로그램 대상', dummyGenerationSummary.audience],
  ['대상 연령', dummyGenerationSummary.age],
  ['운영 방식', dummyGenerationSummary.operation],
  ['운영 기간', dummyGenerationSummary.period],
  ['예산 범위', dummyGenerationSummary.budget],
  ['운영 장소', dummyGenerationSummary.location],
  ['참고한 지역 의제', dummyGenerationSummary.agenda],
  ['기획 메모', dummyGenerationSummary.memo],
];

export default function StudioGenerationLoading() {
  const [generationState, setGenerationState] = useState<GenerationState>('generating');
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const progressValue = useMemo(() => {
    if (generationState === 'failed') {
      return 42;
    }

    if (generationState === 'complete') {
      return 100;
    }

    return Math.round(((activeStepIndex + 1) / generationSteps.length) * 100);
  }, [activeStepIndex, generationState]);

  useEffect(() => {
    if (generationState !== 'generating') {
      return;
    }

    const stepTimer = window.setInterval(() => {
      setActiveStepIndex((currentIndex) => Math.min(currentIndex + 1, generationSteps.length - 1));
    }, 900);

    const completeTimer = window.setTimeout(() => {
      setGenerationState('complete');
      setActiveStepIndex(generationSteps.length - 1);
    }, 3800);

    return () => {
      window.clearInterval(stepTimer);
      window.clearTimeout(completeTimer);
    };
  }, [generationState]);

  function retryGeneration() {
    setGenerationState('generating');
    setActiveStepIndex(0);
  }

  function showFailedState() {
    setGenerationState('failed');
  }

  const statusTitle =
    generationState === 'complete'
      ? '기획서 초안이 준비되었습니다.'
      : generationState === 'failed'
        ? '기획서 생성에 실패했습니다.'
        : '프로그램 기획서를 준비하고 있습니다.';

  const statusDescription =
    generationState === 'complete'
      ? '더미 생성이 완료되었습니다. 편집 화면에서 초안을 확인하고 이어서 수정할 수 있습니다.'
      : generationState === 'failed'
        ? '잠시 후 다시 시도하거나 조건 선택 화면에서 입력값을 수정해 주세요.'
        : '선택한 조건을 바탕으로 기획 배경, 운영 내용, 기대 효과를 정리하는 중입니다.';

  return (
    <div className="studioPage studioGeneratingLayout">
      <aside className="studioSideRail" aria-label="MOIRA STUDIO 메뉴">
        <Link className="studioRailLogo" href="/" aria-label="홈으로 이동" title="홈으로 이동">
          <svg className="studioHomeIcon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 11.2 12 4l8 7.2" />
            <path d="M6.5 10.5V20h11v-9.5" />
            <path d="M10 20v-5h4v5" />
          </svg>
          <small>홈</small>
        </Link>
        <nav className="studioRailNav" aria-label="작업 메뉴">
          <Link href="/studio">
            <span aria-hidden="true">+</span>
            새 기획
          </Link>
          <Link href="/studio/documents">
            <span aria-hidden="true">≡</span>
            작업내역
          </Link>
        </nav>
      </aside>

      <aside className="studioHistoryPanel" aria-label="MOIRA STUDIO 작업 내역">
        <div className="studioHistoryHeader">
          <div>
            <strong>작업 내역</strong>
            <small>MOIRA STUDIO</small>
          </div>
        </div>
        <div className="studioHistoryList" aria-live="polite">
          <button className="studioHistoryItem isCurrent" type="button">
            <span>{generationState === 'complete' ? '생성 완료' : generationState === 'failed' ? '생성 실패' : '생성 중'}</span>
            <strong>시니어 디지털 생활 교실</strong>
            <small>지금</small>
          </button>
          <Link className="studioHistoryItem" href="/studio/document/demo-document-1">
            <span>최근 기획</span>
            <strong>시니어 디지털 생활 교실</strong>
            <small>어제</small>
          </Link>
        </div>
        <div className="studioQuickGuide">
          <strong>생성 흐름</strong>
          <ol>
            <li>입력 조건을 확인합니다.</li>
            <li>더미 단계 진행 후 완료 상태를 표시합니다.</li>
            <li>편집 화면에서 초안을 이어서 확인합니다.</li>
          </ol>
        </div>
      </aside>

      <main className="studioMain studioGeneratingMain">
        <section className="studioGenerationHero" aria-labelledby="studio-generating-title">
          <div className="studioGenerationStatusCard" aria-live="polite">
            <div className={`studioGenerationMark is-${generationState}`} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div>
              <p className="uiEyebrow">
                <span className="studioBrandSpark" aria-hidden="true">✦</span>
                AI PROGRAM DOCUMENT
              </p>
              <h1 id="studio-generating-title">{statusTitle}</h1>
              <p>{statusDescription}</p>
            </div>
            <div className="studioGenerationProgress" aria-label={`생성 진행률 ${progressValue}%`}>
              <span style={{ width: `${progressValue}%` }} />
            </div>
            <strong>
              {generationState === 'complete'
                ? '더미 생성 완료'
                : generationState === 'failed'
                  ? '더미 생성 실패'
                  : `${generationSteps[activeStepIndex].label} 중`}
            </strong>
          </div>

          <section className="studioGenerationSummary" aria-label="선택 조건 요약">
            <div className="studioGenerationSectionHeader">
              <h2>선택 조건 요약</h2>
              <span>더미 데이터</span>
            </div>
            <dl>
              {summaryItems.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </section>

        <section className="studioGenerationSteps" aria-label="단계형 진행 안내">
          <div className="studioGenerationSectionHeader">
            <h2>생성 단계</h2>
            <span>{generationState === 'complete' ? '완료' : generationState === 'failed' ? '중단됨' : '진행 중'}</span>
          </div>
          <ol>
            {generationSteps.map((step, index) => {
              const isDone = generationState === 'complete' || index < activeStepIndex;
              const isActive = generationState === 'generating' && index === activeStepIndex;
              const isFailed = generationState === 'failed' && index === activeStepIndex;

              return (
                <li
                  className={`${isDone ? 'isDone' : ''} ${isActive ? 'isActive' : ''} ${isFailed ? 'isFailed' : ''}`}
                  key={step.label}
                >
                  <span>{index + 1}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <p>{step.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section className={`studioGenerationResult is-${generationState}`} aria-label="생성 결과 액션">
          {generationState === 'complete' ? (
            <>
              <div>
                <strong>편집 화면에서 초안을 확인할 수 있습니다.</strong>
                <p>생성된 더미 문서 ID는 {dummyDocumentId}입니다.</p>
              </div>
              <Link className="uiButton uiButtonPrimary" href={`/studio/document/${dummyDocumentId}`}>
                편집 화면으로 이동
              </Link>
            </>
          ) : generationState === 'failed' ? (
            <>
              <div>
                <strong>조건을 유지한 채 다시 시도할 수 있습니다.</strong>
                <p>이번 화면에서는 실제 오류 응답 없이 더미 실패 상태만 표시합니다.</p>
              </div>
              <button className="uiButton uiButtonPrimary" type="button" onClick={retryGeneration}>
                다시 시도
              </button>
              <Link className="uiButton uiButtonSecondary" href="/studio">
                조건 선택으로 돌아가기
              </Link>
            </>
          ) : (
            <>
              <div>
                <strong>중복 요청 없이 잠시 기다려 주세요.</strong>
                <p>실제 API 호출 없이 더미 진행 상태를 표시하고 있습니다.</p>
              </div>
              <button className="uiButton uiButtonSecondary" type="button" onClick={showFailedState}>
                실패 상태 확인
              </button>
              <Link className="uiButton uiButtonSecondary" href="/studio">
                조건 선택으로 돌아가기
              </Link>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
