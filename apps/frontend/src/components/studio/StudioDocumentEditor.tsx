'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

type SaveState = 'saved' | 'dirty' | 'saving';
type AiRequestState = 'idle' | 'submitting' | 'ready' | 'failed';

type StudioDocument = {
  id: string;
  title: string;
  updatedAt: string;
  content: string;
};

const dummyDocument: StudioDocument = {
  id: 'demo-document-1',
  title: '시니어 디지털 생활 교실',
  updatedAt: '방금 전',
  content: `기획 배경
지역 작은도서관을 이용하는 중장년 및 시니어 주민 가운데 스마트폰, 키오스크, 온라인 행정 서비스 이용에 어려움을 겪는 사례가 꾸준히 확인되고 있다. 일상생활에 필요한 디지털 도구 활용 역량은 정보 접근성과 사회 참여를 높이는 기본 조건이므로, 도서관이 안전하고 익숙한 학습 거점이 되어 단계적인 생활 디지털 교육을 제공한다.

프로그램 목적
이 프로그램은 시니어 주민이 스마트폰 기본 설정, 메신저 활용, 사진 관리, 온라인 예약, 공공 서비스 이용을 직접 실습하며 생활 속 불편을 줄이는 것을 목표로 한다. 참여자는 자신의 속도에 맞춰 반복 실습하고, 교육 이후에도 도서관에서 도움을 받을 수 있는 연결점을 확보한다.

운영 대상
스마트폰 사용이 익숙하지 않거나 생활 디지털 서비스 활용에 어려움을 느끼는 60세 이상 지역 주민 12명을 대상으로 운영한다. 보조 진행자가 함께 참여하여 개인별 질문과 속도 차이를 지원한다.

운영 기간
총 4회차 과정으로 운영하며, 회차당 90분을 기준으로 한다. 매주 같은 요일과 시간에 진행하여 참여자의 일정 예측 가능성을 높인다.

세부 운영 내용
1회차에서는 스마트폰 화면 구성, 글자 크기 조정, 와이파이 연결, 앱 설치와 삭제 방법을 다룬다.
2회차에서는 카카오톡 또는 문자 메시지 보내기, 사진 촬영과 공유, 연락처 저장을 실습한다.
3회차에서는 병원 예약, 교통 정보 확인, 도서관 프로그램 신청 등 생활 서비스 이용 흐름을 다룬다.
4회차에서는 개인별로 자주 겪는 문제를 해결하는 상담형 실습과 배운 내용을 정리하는 시간을 운영한다.

기대 효과
참여자는 디지털 기기 사용에 대한 불안감을 줄이고, 일상에서 필요한 서비스를 스스로 이용할 수 있는 자신감을 얻는다. 도서관은 지역 주민의 생활 문제를 해결하는 실질적인 학습 거점으로 인식될 수 있다.

준비물
참여자 개인 스마트폰, 충전기, 와이파이 환경, 실습 안내지, 큰 글씨 체크리스트, 보조 진행자용 질문 기록지를 준비한다.

예산 계획
강사비, 보조 진행 인건비, 실습 안내지 인쇄비, 참여자 다과비를 포함하여 소규모 예산으로 운영한다. 기존 도서관 공간과 장비를 활용해 추가 장비 구입은 최소화한다.

홍보 및 모집 방법
도서관 안내 데스크, 지역 복지관, 주민센터 게시판을 통해 모집한다. 온라인 신청이 어려운 대상을 고려해 전화 및 방문 접수를 함께 운영한다.`,
};

const historyDocuments: StudioDocument[] = [
  dummyDocument,
  {
    id: 'family-reading-weekend',
    title: '가족 독서 주말 프로그램',
    updatedAt: '3일 전',
    content: `기획 배경
주말에 도서관을 찾는 가족 단위 이용자는 많지만, 부모와 자녀가 함께 책을 읽고 대화하는 정기 프로그램은 부족하다. 가족 독서 활동은 책을 매개로 세대 간 대화를 만들고, 도서관을 주말 여가와 학습이 만나는 생활 공간으로 인식하게 하는 데 효과적이다.

프로그램 목적
부모와 자녀가 같은 책을 읽고 서로의 생각을 나누는 경험을 제공한다. 참여 가족은 독서 후 감상 나누기, 짧은 글쓰기, 책 속 장면 만들기 활동을 통해 가정에서도 이어갈 수 있는 독서 습관을 형성한다.

운영 대상
초등학생 자녀를 둔 가족 10팀을 대상으로 운영한다. 자녀 연령은 초등 1학년부터 4학년까지를 권장하며, 보호자 1인 이상이 함께 참여한다.

운영 기간
총 3회차 주말 프로그램으로 운영하며, 회차당 100분을 기준으로 한다. 토요일 오전 시간대를 활용해 가족 참여 부담을 줄인다.

세부 운영 내용
1회차에서는 가족별 관심사를 확인하고 함께 읽을 그림책과 동화책을 고른다.
2회차에서는 책 속 인물의 선택을 주제로 가족 대화를 진행하고, 인상 깊은 문장을 기록한다.
3회차에서는 가족별 독서 약속을 만들고, 함께 만든 결과물을 작은 전시 형태로 공유한다.

기대 효과
가족 간 대화 시간이 늘어나고, 도서관 방문이 단순 대출을 넘어 공동 경험으로 확장된다. 도서관은 지역 가족의 주말 문화 활동 거점으로 자리 잡을 수 있다.

준비물
선정 도서, 가족 활동지, 필기구, 색지, 스티커, 전시용 보드, 참여 가족 명찰을 준비한다.

예산 계획
활동지 인쇄비, 만들기 재료비, 전시 소모품비, 간단한 다과비를 포함한다.

홍보 및 모집 방법
도서관 홈페이지, 학교 알림장, 지역 맘카페, 안내 데스크를 통해 홍보한다. 가족 단위 신청이므로 전화와 온라인 접수를 병행한다.`,
  },
  {
    id: 'local-memory-archive',
    title: '우리 동네 기억 수집 워크숍',
    updatedAt: '지난주',
    content: `기획 배경
지역의 오래된 장소, 생활사, 주민의 경험은 시간이 지나면 쉽게 사라진다. 작은도서관은 지역 주민이 가진 기억을 기록하고 공유할 수 있는 가까운 문화 거점이므로, 주민 참여형 아카이브 프로그램을 통해 지역 이야기를 보존한다.

프로그램 목적
주민이 자신의 동네 경험을 글, 사진, 인터뷰 형태로 정리하고 서로 공유하도록 돕는다. 프로그램 결과물은 도서관 내 작은 전시와 온라인 게시 자료로 활용할 수 있는 기초 아카이브가 된다.

운영 대상
지역 생활사를 기록하고 싶은 성인 주민 15명을 대상으로 한다. 오래 거주한 주민과 새로 이주한 주민이 함께 참여할 수 있도록 모집한다.

운영 기간
총 4회차로 운영하며, 회차당 120분을 기준으로 한다. 기록 작성, 인터뷰 실습, 자료 정리, 공유 전시 순서로 구성한다.

세부 운영 내용
1회차에서는 지역 기억 아카이브의 의미와 기록 주제를 소개한다.
2회차에서는 사진과 사물에 담긴 개인 기억을 글로 정리한다.
3회차에서는 짝 인터뷰를 진행하고 질문 기록지를 작성한다.
4회차에서는 수집한 내용을 함께 편집하고 도서관 전시 구성을 논의한다.

기대 효과
주민은 자신의 경험이 지역 문화 자산이 될 수 있음을 체감한다. 도서관은 지역 기록을 축적하고 주민 간 관계를 연결하는 플랫폼 역할을 강화할 수 있다.

준비물
기록 활동지, 인터뷰 질문지, 녹음 가능한 스마트폰, 사진 스캔 안내문, 전시용 파일과 보드를 준비한다.

예산 계획
강사비, 기록지 인쇄비, 전시 물품비, 사진 출력비를 중심으로 예산을 편성한다.

홍보 및 모집 방법
주민센터, 아파트 게시판, 지역 커뮤니티, 도서관 안내문을 통해 모집한다. 고령 주민 참여를 위해 방문 접수도 함께 운영한다.`,
  },
];

const saveStateLabel: Record<SaveState, string> = {
  saved: '저장됨',
  dirty: '저장 필요',
  saving: '저장 중',
};

const aiStateLabel: Record<AiRequestState, string> = {
  idle: '요청 전',
  submitting: '수정 요청 중',
  ready: '수정안 준비됨',
  failed: '요청 실패',
};

const aiQuickRequests = [
  '더 공공기관 문서답게 다듬어 주세요.',
  '초등학생 대상 프로그램에 맞게 쉽게 바꿔 주세요.',
  '문장을 짧고 명확하게 정리해 주세요.',
  '운영 내용이 더 구체적으로 보이게 다듬어 주세요.',
  '홍보 문구처럼 참여하고 싶게 바꿔 주세요.',
];

const dummyAiRevisionText =
  '지역 주민의 디지털 활용 역량을 높이기 위해 스마트폰 기본 사용법과 생활 편의 서비스를 함께 익히는 참여형 프로그램입니다.';
const dummyAiRevisionHighlight = '생활 편의 서비스를 함께 익히는 참여형 프로그램';

type StudioDocumentEditorProps = {
  documentId: string;
};

export default function StudioDocumentEditor({ documentId }: StudioDocumentEditorProps) {
  const document = useMemo(
    () => historyDocuments.find((item) => item.id === documentId) ?? dummyDocument,
    [documentId],
  );

  return <StudioDocumentEditorView document={document} key={document.id} />;
}

type StudioDocumentEditorViewProps = {
  document: StudioDocument;
};

function StudioDocumentEditorView({ document }: StudioDocumentEditorViewProps) {
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState(document.updatedAt);
  const [selectedText, setSelectedText] = useState('');
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiRequest, setAiRequest] = useState('');
  const [aiRequestState, setAiRequestState] = useState<AiRequestState>('idle');
  const [aiReviewMessage, setAiReviewMessage] = useState('선택한 문장을 검토한 뒤 수정 요청을 보낼 수 있습니다.');

  const hasEmptyTitle = title.trim().length === 0;
  const canSave = saveState === 'dirty' && !hasEmptyTitle;
  const hasSelectedText = selectedText.trim().length > 0;
  const canRequestAiEdit = hasSelectedText && aiRequest.trim().length > 0 && aiRequestState !== 'submitting';

  useEffect(() => {
    if (!isAiPanelOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeAiPanel();
      }
    }

    globalThis.document.addEventListener('keydown', handleKeyDown);

    return () => {
      globalThis.document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAiPanelOpen]);

  function markDirty() {
    if (saveState !== 'dirty') {
      setSaveState('dirty');
    }
  }

  function handleSave() {
    if (!canSave) {
      return;
    }

    setSaveState('saving');
    window.setTimeout(() => {
      setSaveState('saved');
      setLastSavedAt('방금 전');
    }, 450);
  }

  function updateSelectedText() {
    const textarea = bodyTextareaRef.current;

    if (!textarea || textarea.selectionStart === textarea.selectionEnd) {
      setSelectedText('');
      return;
    }

    setSelectedText(content.slice(textarea.selectionStart, textarea.selectionEnd));
  }

  function openAiPanel() {
    updateSelectedText();
    setIsAiPanelOpen(true);
    setAiRequestState('idle');
    setAiReviewMessage('선택한 문장을 검토한 뒤 수정 요청을 보낼 수 있습니다.');
  }

  function closeAiPanel() {
    setIsAiPanelOpen(false);
    setAiRequest('');
    setAiRequestState('idle');
    setAiReviewMessage('선택한 문장을 검토한 뒤 수정 요청을 보낼 수 있습니다.');
  }

  function handleAiRequest() {
    if (!canRequestAiEdit) {
      return;
    }

    setAiRequestState('submitting');
    setAiReviewMessage('더미 수정안을 준비하고 있습니다.');
    window.setTimeout(() => {
      setAiRequestState('ready');
      setAiReviewMessage('수정안 준비 완료');
    }, 720);
  }

  function handleAiRevisionApply() {
    setAiReviewMessage('적용 이벤트가 준비되었습니다. 실제 문서 본문은 변경되지 않았습니다.');
  }

  function handleAiRevisionRetry() {
    setAiRequestState('idle');
    setAiReviewMessage('요청 입력 상태로 돌아왔습니다.');
  }

  function handleAiRevisionFailure() {
    setAiRequestState('failed');
    setAiReviewMessage('수정안 생성 실패 상태입니다.');
  }

  return (
    <div className="studioPage studioDocumentPage">
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
          <button className="isActive" type="button">
            <span aria-hidden="true">≡</span>
            작업내역
          </button>
        </nav>
      </aside>

      <aside className="studioHistoryPanel" aria-label="MOIRA STUDIO 작업 내역">
        <div className="studioHistoryHeader">
          <div>
            <strong>작업 내역</strong>
            <small>MOIRA STUDIO</small>
          </div>
        </div>

        <div className="studioHistoryList">
          {historyDocuments.map((item) => (
            <Link
              className={item.id === document.id ? 'studioHistoryItem isCurrent' : 'studioHistoryItem'}
              href={`/studio/document/${item.id}`}
              key={item.id}
            >
              <span>{item.id === document.id ? '편집 중' : '최근 기획'}</span>
              <strong>{item.id === document.id ? title || '제목 없는 기획서' : item.title}</strong>
              <small>{item.id === document.id ? lastSavedAt : item.updatedAt}</small>
            </Link>
          ))}
        </div>

        <div className="studioQuickGuide">
          <strong>문서 편집</strong>
          <ol>
            <li>제목과 본문을 직접 수정합니다.</li>
            <li>변경 후 저장 버튼으로 상태를 갱신합니다.</li>
            <li>필요하면 새 기획으로 돌아갈 수 있습니다.</li>
          </ol>
        </div>
      </aside>

      <main className="studioMain studioDocumentMain">
        <section className="studioDocumentToolbar" aria-label="문서 저장 상태와 작업">
          <div>
            <p className="uiEyebrow">
              <span className="studioBrandSpark" aria-hidden="true">✦</span>
              AI PROGRAM DOCUMENT
            </p>
            <h1>프로그램 기획서 편집</h1>
          </div>
          <div className="studioDocumentActions">
            <span className={`studioSaveBadge is-${saveState}`} aria-live="polite">
              {saveStateLabel[saveState]}
            </span>
            <span className="studioSavedMeta">최근 수정 {lastSavedAt}</span>
            <button className="uiButton uiButtonPrimary" type="button" disabled={!canSave} onClick={handleSave}>
              저장
            </button>
            <button className="uiButton uiButtonSecondary" type="button" onClick={openAiPanel}>
              AI 수정
            </button>
            <Link className="uiButton uiButtonSecondary" href="/studio">
              새 기획서
            </Link>
          </div>
        </section>

        <div className={isAiPanelOpen ? 'studioDocumentWorkspace hasAiPanel' : 'studioDocumentWorkspace'}>
          <section className="studioDocumentEditor" aria-labelledby="studio-document-title-label">
            <label className="studioDocumentTitleField">
              <span id="studio-document-title-label">기획서 제목</span>
              <input
                aria-invalid={hasEmptyTitle}
                placeholder="기획서 제목을 입력하세요"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  markDirty();
                }}
              />
            </label>
            {hasEmptyTitle ? <p className="studioDocumentError">제목은 비워둘 수 없습니다.</p> : null}

            <div className="studioDocumentBodyField">
              <div className="studioDocumentBodyHeader">
                <span>기획서 본문</span>
                <button
                  className="studioTextAiButton"
                  type="button"
                  disabled={!hasSelectedText}
                  onClick={openAiPanel}
                >
                  AI 수정
                </button>
              </div>
              <textarea
                aria-label="기획서 본문 편집"
                ref={bodyTextareaRef}
                value={content}
                onBlur={updateSelectedText}
                onKeyUp={updateSelectedText}
                onMouseUp={updateSelectedText}
                onSelect={updateSelectedText}
                onChange={(event) => {
                  setContent(event.target.value);
                  markDirty();
                  window.requestAnimationFrame(updateSelectedText);
                }}
              />
            </div>
          </section>

          {isAiPanelOpen ? (
            <aside className="studioAiEditPanel" aria-labelledby="studio-ai-edit-title">
              <div className="studioAiEditPanelHeader">
                <div>
                  <p className="uiEyebrow">SELECTED TEXT AI EDIT</p>
                  <h2 id="studio-ai-edit-title">AI 수정 요청</h2>
                </div>
                <button type="button" aria-label="AI 수정 패널 닫기" onClick={closeAiPanel}>
                  ×
                </button>
              </div>

              {aiRequestState === 'ready' ? (
                <StudioAiRevisionCompare originalText={selectedText} revisedText={dummyAiRevisionText} />
              ) : (
                <>
                  <section className="studioAiSelectedSource" aria-label="선택한 원문">
                    <strong>선택한 원문</strong>
                    {hasSelectedText ? (
                      <p>{selectedText}</p>
                    ) : (
                      <p className="studioAiEmptySource">수정할 문장을 먼저 선택해 주세요.</p>
                    )}
                  </section>

                  <label className="studioAiRequestField">
                    <span>수정 요청</span>
                    <textarea
                      placeholder="더 공공기관 문서답게 다듬어 주세요."
                      value={aiRequest}
                      onChange={(event) => {
                        setAiRequest(event.target.value);
                        setAiRequestState('idle');
                        setAiReviewMessage('선택한 문장을 검토한 뒤 수정 요청을 보낼 수 있습니다.');
                      }}
                    />
                  </label>

                  <div className="studioAiQuickRequests" aria-label="빠른 수정 요청">
                    {aiQuickRequests.map((request) => (
                      <button
                        className={aiRequest === request ? 'isSelected' : ''}
                        key={request}
                        type="button"
                        onClick={() => {
                          setAiRequest(request);
                          setAiRequestState('idle');
                          setAiReviewMessage('선택한 문장을 검토한 뒤 수정 요청을 보낼 수 있습니다.');
                        }}
                      >
                        {request.replace(' 주세요.', '')}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className={`studioAiRequestState is-${aiRequestState}`} aria-live="polite">
                <strong>{aiStateLabel[aiRequestState]}</strong>
                <span>{aiReviewMessage}</span>
              </div>

              <div className="studioAiEditActions">
                {aiRequestState === 'ready' ? (
                  <>
                    <button className="uiButton uiButtonPrimary" type="button" onClick={handleAiRevisionApply}>
                      적용
                    </button>
                    <button className="uiButton uiButtonSecondary" type="button" onClick={handleAiRevisionRetry}>
                      다시 요청
                    </button>
                    <button className="uiButton uiButtonSecondary" type="button" onClick={closeAiPanel}>
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button className="uiButton uiButtonSecondary" type="button" onClick={closeAiPanel}>
                      취소
                    </button>
                    <button
                      className="uiButton uiButtonSecondary"
                      type="button"
                      disabled={aiRequestState === 'submitting'}
                      onClick={handleAiRevisionFailure}
                    >
                      실패 상태
                    </button>
                    <button
                      className="uiButton uiButtonPrimary"
                      type="button"
                      disabled={!canRequestAiEdit}
                      onClick={handleAiRequest}
                    >
                      {aiRequestState === 'submitting' ? '요청 중' : '수정 요청'}
                    </button>
                  </>
                )}
              </div>
            </aside>
          ) : null}
        </div>
      </main>
    </div>
  );
}

type StudioAiRevisionCompareProps = {
  originalText: string;
  revisedText: string;
};

function StudioAiRevisionCompare({ originalText, revisedText }: StudioAiRevisionCompareProps) {
  const [beforeHighlight, afterHighlight = ''] = revisedText.split(dummyAiRevisionHighlight);

  return (
    <section className="studioAiRevisionCompare" aria-labelledby="studio-ai-revision-compare-title">
      <div className="studioAiRevisionCompareHeader">
        <h3 id="studio-ai-revision-compare-title">수정 결과 비교</h3>
        <p>수정안을 적용하기 전에 기존 원문과 나란히 검토합니다.</p>
      </div>

      <div className="studioAiRevisionCompareGrid">
        <section className="studioAiRevisionPane" aria-labelledby="studio-ai-original-title">
          <h4 id="studio-ai-original-title">기존 원문</h4>
          <p>{originalText}</p>
        </section>
        <section className="studioAiRevisionPane isRevised" aria-labelledby="studio-ai-revised-title">
          <h4 id="studio-ai-revised-title">AI 수정안</h4>
          <p>
            {beforeHighlight}
            <mark>{dummyAiRevisionHighlight}</mark>
            {afterHighlight}
          </p>
        </section>
      </div>
    </section>
  );
}
