'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildStudioDraftContent, studioDraftStorageKey, type StudioDraft } from '@/lib/studio-draft';

type SaveState = 'saved' | 'dirty' | 'saving';

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

const historyDocuments = [
  dummyDocument,
  {
    id: 'family-reading-weekend',
    title: '가족 독서 주말 프로그램',
    updatedAt: '3일 전',
  },
  {
    id: 'local-memory-archive',
    title: '우리 동네 기억 수집 워크숍',
    updatedAt: '지난주',
  },
];

const saveStateLabel: Record<SaveState, string> = {
  saved: '저장됨',
  dirty: '저장 필요',
  saving: '저장 중',
};

type StudioDocumentEditorProps = {
  documentId: string;
};

export default function StudioDocumentEditor({ documentId }: StudioDocumentEditorProps) {
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const document = useMemo(() => ({ ...dummyDocument, id: documentId || dummyDocument.id }), [documentId]);
  const [storedDraft] = useState<StudioDraft | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    const storedDraftText = window.sessionStorage.getItem(studioDraftStorageKey);

    if (!storedDraftText) {
      return null;
    }

    try {
      const parsedDraft = JSON.parse(storedDraftText) as Partial<StudioDraft>;

      if (!parsedDraft.title || !parsedDraft.summary || !parsedDraft.target || !parsedDraft.duration || !parsedDraft.expectedEffects) {
        return null;
      }

      return {
        title: parsedDraft.title,
        summary: parsedDraft.summary,
        target: parsedDraft.target,
        duration: parsedDraft.duration,
        details: Array.isArray(parsedDraft.details) ? parsedDraft.details.filter((item): item is string => typeof item === 'string') : [],
        expectedEffects: parsedDraft.expectedEffects,
        notes: Array.isArray(parsedDraft.notes) ? parsedDraft.notes.filter((item): item is string => typeof item === 'string') : [],
        content:
          typeof parsedDraft.content === 'string' && parsedDraft.content.trim().length > 0
            ? parsedDraft.content
            : buildStudioDraftContent({
                summary: parsedDraft.summary,
                target: parsedDraft.target,
                duration: parsedDraft.duration,
                details: Array.isArray(parsedDraft.details) ? parsedDraft.details.filter((item): item is string => typeof item === 'string') : [],
                expectedEffects: parsedDraft.expectedEffects,
                notes: Array.isArray(parsedDraft.notes) ? parsedDraft.notes.filter((item): item is string => typeof item === 'string') : [],
              }),
      };
    } catch (error) {
      console.error('Failed to load studio draft from sessionStorage:', error);
      return null;
    }
  });
  const [title, setTitle] = useState(storedDraft?.title || document.title);
  const [content, setContent] = useState(storedDraft?.content || document.content);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [lastSavedAt, setLastSavedAt] = useState(storedDraft ? '방금 전' : document.updatedAt);

  const hasEmptyTitle = title.trim().length === 0;
  const canSave = saveState === 'dirty' && !hasEmptyTitle;

  useEffect(() => {
    const textarea = bodyTextareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [content]);

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
              MOIRA STUDIO
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
            <Link className="uiButton uiButtonSecondary" href="/studio">
              새 기획서
            </Link>
          </div>
        </section>

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

          <label className="studioDocumentBodyField">
            <span>기획서 본문</span>
            <textarea
              aria-label="기획서 본문 편집"
              ref={bodyTextareaRef}
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                markDirty();
              }}
            />
          </label>
        </section>
      </main>
    </div>
  );
}
