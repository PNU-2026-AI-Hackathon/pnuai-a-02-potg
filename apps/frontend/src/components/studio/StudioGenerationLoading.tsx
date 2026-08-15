'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  studioDraftStorageKey,
  studioGenerateRequestStorageKey,
  type StudioDraft,
  type StudioGenerateRequest,
} from '@/lib/studio-draft';

type GenerationState = 'generating' | 'complete' | 'failed' | 'missing-request';

type StudioGenerateResponse = {
  documentId?: string;
  draft?: StudioDraft;
  error?: string;
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
    description: '회차별 활동과 준비물을 기획서 초안에 배치합니다.',
  },
  {
    label: '기획서 초안 정리',
    description: '편집 화면에서 이어서 다듬을 수 있도록 문서를 준비합니다.',
  },
];

const conditionLabels: Record<string, string> = {
  category: '프로그램 분야',
  topic: '주제',
  audience: '프로그램 대상',
  age: '대상 연령',
  operation: '운영 방식',
  period: '운영 기간',
  sessions: '운영 회차',
  capacity: '모집 인원',
  budget: '예산 범위',
  location: '운영 장소',
  agenda: '참고한 지역 의제',
  example: '참고 사례',
};

function createDocumentId() {
  return `generated-${Date.now()}`;
}

function readStoredRequest() {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedRequest = window.sessionStorage.getItem(studioGenerateRequestStorageKey);

  if (!storedRequest) {
    return null;
  }

  try {
    const parsedRequest = JSON.parse(storedRequest) as Partial<StudioGenerateRequest>;

    if (typeof parsedRequest.prompt !== 'string' || parsedRequest.prompt.trim().length === 0) {
      return null;
    }

    return {
      prompt: parsedRequest.prompt.trim(),
      conditions:
        parsedRequest.conditions && typeof parsedRequest.conditions === 'object'
          ? parsedRequest.conditions
          : {},
      agenda:
        parsedRequest.agenda && typeof parsedRequest.agenda === 'object'
          ? parsedRequest.agenda
          : null,
    } satisfies StudioGenerateRequest;
  } catch (error) {
    console.error('Failed to read studio generate request:', error);
    return null;
  }
}

function summarizeConditions(request: StudioGenerateRequest | null) {
  if (!request) {
    return [];
  }

  const conditionEntries = Object.entries(request.conditions)
    .map(([key, values]) => {
      const cleanedValues = values.map((value) => value.trim()).filter((value) => value.length > 0);

      return cleanedValues.length > 0
        ? {
            label: conditionLabels[key] ?? key,
            value: cleanedValues.join(', '),
          }
        : null;
    })
    .filter((entry): entry is { label: string; value: string } => entry !== null);

  return [
    ...conditionEntries,
    request.agenda
      ? {
          label: '참고한 지역 의제',
          value: request.agenda.title,
        }
      : null,
    {
      label: '기획 메모',
      value: request.prompt,
    },
  ].filter((entry): entry is { label: string; value: string } => entry !== null);
}

export default function StudioGenerationLoading() {
  const router = useRouter();
  const hasStartedRef = useRef(false);
  const [request] = useState<StudioGenerateRequest | null>(() => readStoredRequest());
  const [generationState, setGenerationState] = useState<GenerationState>(() =>
    readStoredRequest() ? 'generating' : 'missing-request',
  );
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [createdDocumentId, setCreatedDocumentId] = useState('demo-document-1');

  const summaryItems = useMemo(() => summarizeConditions(request), [request]);
  const progressValue = useMemo(() => {
    if (generationState === 'failed' || generationState === 'missing-request') {
      return 42;
    }

    if (generationState === 'complete') {
      return 100;
    }

    return Math.round(((activeStepIndex + 1) / generationSteps.length) * 100);
  }, [activeStepIndex, generationState]);

  const generateDraft = useCallback(async (nextRequest: StudioGenerateRequest) => {
    setGenerationState('generating');
    setActiveStepIndex(0);
    setErrorMessage('');

    try {
      const response = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(nextRequest),
      });
      const data = (await response.json()) as StudioGenerateResponse;

      if (!response.ok || !data.draft) {
        throw new Error(data.error || '기획서 초안 생성에 실패했습니다.');
      }

      const documentId = data.documentId || data.draft.id || createDocumentId();
      const draftWithId: StudioDraft = {
        ...data.draft,
        id: documentId,
      };

      window.sessionStorage.setItem(studioDraftStorageKey, JSON.stringify(draftWithId));
      setCreatedDocumentId(documentId);
      setGenerationState('complete');
      setActiveStepIndex(generationSteps.length - 1);

      window.setTimeout(() => {
        router.push(`/studio/document/${documentId}`);
      }, 900);
    } catch (error) {
      setGenerationState('failed');
      setErrorMessage(error instanceof Error ? error.message : '기획서 초안 생성 중 문제가 발생했습니다.');
    }
  }, [router]);

  useEffect(() => {
    if (request && !hasStartedRef.current) {
      hasStartedRef.current = true;
      void generateDraft(request);
    }
  }, [generateDraft, request]);

  useEffect(() => {
    if (generationState !== 'generating') {
      return;
    }

    const stepTimer = window.setInterval(() => {
      setActiveStepIndex((currentIndex) => Math.min(currentIndex + 1, generationSteps.length - 1));
    }, 900);

    return () => {
      window.clearInterval(stepTimer);
    };
  }, [generationState]);

  function retryGeneration() {
    if (!request || generationState === 'generating') {
      return;
    }

    void generateDraft(request);
  }

  const statusTitle =
    generationState === 'complete'
      ? '기획서 초안이 준비되었습니다.'
      : generationState === 'failed'
        ? '기획서 생성에 실패했습니다.'
        : generationState === 'missing-request'
          ? '생성할 기획 조건이 없습니다.'
          : '프로그램 기획서를 준비하고 있습니다.';

  const statusDescription =
    generationState === 'complete'
      ? '생성이 완료되었습니다. 편집 화면에서 초안을 확인하고 이어서 수정할 수 있습니다.'
      : generationState === 'failed'
        ? errorMessage || '잠시 후 다시 시도하거나 조건 선택 화면에서 입력값을 수정해 주세요.'
        : generationState === 'missing-request'
          ? '조건 입력 화면에서 기획 메모를 작성한 뒤 다시 생성해 주세요.'
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
            <strong>생성 작업</strong>
            <small>MOIRA STUDIO</small>
          </div>
        </div>
        <div className="studioHistoryList" aria-live="polite">
          <div className="studioHistoryItem isCurrent">
            <span>
              {generationState === 'complete'
                ? '생성 완료'
                : generationState === 'failed'
                  ? '생성 실패'
                  : generationState === 'missing-request'
                    ? '조건 없음'
                    : '생성 중'}
            </span>
            <strong>{request?.prompt || '새 프로그램 기획안'}</strong>
            <small>{generationState === 'complete' ? '편집 화면으로 이동합니다.' : '생성 조건을 확인하고 있습니다.'}</small>
          </div>
        </div>
        <div className="studioQuickGuide">
          <strong>생성 흐름</strong>
          <ol>
            <li>입력 조건을 확인합니다.</li>
            <li>AI 생성 API로 초안을 요청합니다.</li>
            <li>완료되면 편집 화면에서 초안을 확인합니다.</li>
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
                MOIRA STUDIO
              </p>
              <h1 id="studio-generating-title">{statusTitle}</h1>
              <p>{statusDescription}</p>
            </div>
            <div className="studioGenerationProgress" aria-label={`생성 진행률 ${progressValue}%`}>
              <span style={{ width: `${progressValue}%` }} />
            </div>
            <strong>
              {generationState === 'complete'
                ? '생성 완료'
                : generationState === 'failed'
                  ? '생성 실패'
                  : generationState === 'missing-request'
                    ? '조건 입력 필요'
                    : `${generationSteps[activeStepIndex].label} 중`}
            </strong>
          </div>

          <section className="studioGenerationSummary" aria-label="선택 조건 요약">
            <div className="studioGenerationSectionHeader">
              <h2>선택 조건 요약</h2>
              <span>{summaryItems.length > 0 ? '입력 조건' : '조건 없음'}</span>
            </div>
            {summaryItems.length > 0 ? (
              <dl>
                {summaryItems.map(({ label, value }) => (
                  <div key={`${label}-${value}`}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="studioGenerationEmptySummary">아직 전달된 생성 조건이 없습니다.</p>
            )}
          </section>
        </section>

        <section className="studioGenerationSteps" aria-label="단계형 진행 안내">
          <div className="studioGenerationSectionHeader">
            <h2>생성 단계</h2>
            <span>
              {generationState === 'complete'
                ? '완료'
                : generationState === 'failed'
                  ? '중단됨'
                  : generationState === 'missing-request'
                    ? '대기'
                    : '진행 중'}
            </span>
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
                <p>생성된 문서 ID는 {createdDocumentId}입니다.</p>
              </div>
              <Link className="uiButton uiButtonPrimary" href={`/studio/document/${createdDocumentId}`}>
                편집 화면으로 이동
              </Link>
            </>
          ) : generationState === 'failed' ? (
            <>
              <div>
                <strong>조건을 유지한 채 다시 시도할 수 있습니다.</strong>
                <p>{errorMessage || '기획서 생성 요청을 완료하지 못했습니다.'}</p>
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
                <strong>{generationState === 'missing-request' ? '조건 입력 화면으로 돌아가 주세요.' : '중복 요청 없이 잠시 기다려 주세요.'}</strong>
                <p>
                  {generationState === 'missing-request'
                    ? '저장된 생성 요청이 없어 API를 호출하지 않았습니다.'
                    : '실제 AI 생성 API 응답을 기다리고 있습니다.'}
                </p>
              </div>
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
