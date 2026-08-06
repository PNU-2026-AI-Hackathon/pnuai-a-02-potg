'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';

type StudioDocumentStatus = '작성 중' | '저장됨' | '검토 필요';

type ManagedStudioDocument = {
  id: string;
  title: string;
  status: StudioDocumentStatus;
  updatedAt: string;
  category: string;
  audience: string;
  period: string;
  preview: string;
};

const dummyDocuments: ManagedStudioDocument[] = [
  {
    id: 'demo-document-1',
    title: '시니어 디지털 생활 교실',
    status: '작성 중',
    updatedAt: '방금 전',
    category: '디지털 역량',
    audience: '시니어',
    period: '4회차',
    preview: '지역 어르신이 스마트폰 기본 기능과 생활 편의 서비스를 익히는 프로그램입니다.',
  },
  {
    id: 'family-reading-weekend',
    title: '가족 독서 주말 프로그램',
    status: '저장됨',
    updatedAt: '어제',
    category: '독서 문화',
    audience: '가족',
    period: '3회차',
    preview: '보호자와 어린이가 함께 책을 읽고 지역 이야기를 나누는 주말 프로그램입니다.',
  },
  {
    id: 'local-memory-archive',
    title: '우리 동네 기억 수집 워크숍',
    status: '검토 필요',
    updatedAt: '지난주',
    category: '지역 기록',
    audience: '성인',
    period: '4회차',
    preview: '주민의 사진과 인터뷰를 모아 동네 생활사를 기록하는 참여형 아카이브 프로그램입니다.',
  },
];

const statusClassName: Record<StudioDocumentStatus, string> = {
  '작성 중': 'isDraft',
  저장됨: 'isSaved',
  '검토 필요': 'isReview',
};

export default function StudioDocumentsManager() {
  const [documents, setDocuments] = useState(dummyDocuments);
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [openMenuDocumentId, setOpenMenuDocumentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedStudioDocument | null>(null);
  const [isShowingEmptyState, setIsShowingEmptyState] = useState(false);
  const [notice, setNotice] = useState('저장된 기획서를 다시 열거나 관리할 수 있습니다.');

  const visibleDocuments = useMemo(
    () => (isShowingEmptyState ? [] : documents),
    [documents, isShowingEmptyState],
  );
  const totalCount = visibleDocuments.length;
  const recentlyUpdatedTitle = useMemo(() => visibleDocuments[0]?.title ?? '최근 문서 없음', [visibleDocuments]);

  function startTitleEdit(document: ManagedStudioDocument) {
    setOpenMenuDocumentId(null);
    setEditingDocumentId(document.id);
    setEditingTitle(document.title);
    setNotice('목록에서 제목 변경 UI를 확인하는 중입니다.');
  }

  function cancelTitleEdit() {
    setEditingDocumentId(null);
    setEditingTitle('');
    setNotice('제목 변경을 취소했습니다.');
  }

  function submitTitleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextTitle = editingTitle.trim();
    if (!editingDocumentId || nextTitle.length === 0) {
      return;
    }

    setDocuments((currentDocuments) =>
      currentDocuments.map((document) =>
        document.id === editingDocumentId
          ? {
              ...document,
              title: nextTitle,
              updatedAt: '방금 전',
              status: '작성 중',
            }
          : document,
      ),
    );
    setEditingDocumentId(null);
    setEditingTitle('');
    setNotice('더미 상태에서 제목이 변경되었습니다. 실제 API는 호출하지 않았습니다.');
  }

  function confirmDeleteDocument() {
    if (!deleteTarget) {
      return;
    }

    setDocuments((currentDocuments) => currentDocuments.filter((document) => document.id !== deleteTarget.id));
    setNotice(`"${deleteTarget.title}" 문서를 더미 목록에서 제거했습니다.`);
    setDeleteTarget(null);
  }

  function openDeleteConfirm(document: ManagedStudioDocument) {
    setOpenMenuDocumentId(null);
    setDeleteTarget(document);
  }

  return (
    <div className="studioPage studioDocumentsPage">
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
          <Link className="isActive" href="/studio/documents">
            <span aria-hidden="true">≡</span>
            작업내역
          </Link>
        </nav>
      </aside>

      <aside className="studioHistoryPanel" aria-label="MOIRA STUDIO 최근 문서">
        <div className="studioHistoryHeader">
          <div>
            <strong>최근 문서</strong>
            <small>MOIRA STUDIO</small>
          </div>
        </div>

        <div className="studioHistoryList" aria-live="polite">
          {visibleDocuments.length > 0 ? (
            visibleDocuments.slice(0, 4).map((document) => (
              <Link className="studioHistoryItem" href={`/studio/document/${document.id}`} key={document.id}>
                <span>{document.status}</span>
                <strong>{document.title}</strong>
                <small>{document.updatedAt}</small>
              </Link>
            ))
          ) : (
            <div className="studioEmptyHistory">
              <span aria-hidden="true">□</span>
              <p>저장된 기획서가 없습니다.</p>
            </div>
          )}
        </div>

        <div className="studioQuickGuide">
          <strong>문서 관리</strong>
          <ol>
            <li>저장된 기획서를 목록에서 확인합니다.</li>
            <li>다시 열기, 제목 변경, 삭제 흐름을 점검합니다.</li>
            <li>새 기획으로 다음 초안을 시작합니다.</li>
          </ol>
        </div>
      </aside>

      <main className="studioMain studioDocumentsMain">
        <section className="studioDocumentsHeader" aria-labelledby="studio-documents-title">
          <div>
            <p className="uiEyebrow">
              <span className="studioBrandSpark" aria-hidden="true">✦</span>
              AI PROGRAM DOCUMENTS
            </p>
            <h1 id="studio-documents-title">기획서 관리</h1>
            <p>저장된 프로그램 기획서를 확인하고 이어서 편집할 수 있습니다.</p>
          </div>
          <div className="studioDocumentsHeaderActions">
            <span aria-live="polite">전체 {totalCount}건</span>
            <button
              className="uiButton uiButtonSecondary"
              type="button"
              onClick={() => {
                setIsShowingEmptyState((current) => !current);
                setNotice(isShowingEmptyState ? '더미 기획서 목록을 다시 표시합니다.' : '빈 목록 상태를 표시합니다.');
              }}
            >
              {isShowingEmptyState ? '목록 보기' : '빈 상태 보기'}
            </button>
            <Link className="uiButton uiButtonPrimary" href="/studio">
              새 기획서 작성
            </Link>
          </div>
        </section>

        <section className="studioDocumentsSummary" aria-label="기획서 관리 요약">
          <div>
            <span>최근 수정</span>
            <strong>{recentlyUpdatedTitle}</strong>
          </div>
          <div>
            <span>검토 필요</span>
            <strong>{visibleDocuments.filter((document) => document.status === '검토 필요').length}건</strong>
          </div>
          <div>
            <span>관리 상태</span>
            <strong>{notice}</strong>
          </div>
        </section>

        {visibleDocuments.length > 0 ? (
          <section className="studioDocumentsList" aria-label="저장된 기획서 목록">
            <div className="studioDocumentsListHead" aria-hidden="true">
              <span>기획서</span>
              <span>조건</span>
              <span>상태</span>
              <span>작업</span>
            </div>

            {visibleDocuments.map((document) => {
              const isEditing = editingDocumentId === document.id;

              return (
                <article className="studioDocumentRow" key={document.id}>
                  <div className="studioDocumentRowTitle">
                    {isEditing ? (
                      <form className="studioDocumentRenameForm" onSubmit={submitTitleEdit}>
                        <label>
                          <span>기획서 제목</span>
                          <input
                            autoFocus
                            value={editingTitle}
                            onChange={(event) => setEditingTitle(event.target.value)}
                          />
                        </label>
                        <div>
                          <button
                            className="uiButton uiButtonPrimary"
                            disabled={editingTitle.trim().length === 0}
                            type="submit"
                          >
                            저장
                          </button>
                          <button className="uiButton uiButtonSecondary" type="button" onClick={cancelTitleEdit}>
                            취소
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <h2>{document.title}</h2>
                        <p>{document.preview}</p>
                        <small>최근 수정 {document.updatedAt}</small>
                      </>
                    )}
                  </div>

                  <dl className="studioDocumentConditionSummary">
                    <div>
                      <dt>분야</dt>
                      <dd>{document.category}</dd>
                    </div>
                    <div>
                      <dt>대상</dt>
                      <dd>{document.audience}</dd>
                    </div>
                    <div>
                      <dt>기간</dt>
                      <dd>{document.period}</dd>
                    </div>
                  </dl>

                  <div>
                    <span className={`studioDocumentStatusBadge ${statusClassName[document.status]}`}>
                      {document.status}
                    </span>
                  </div>

                  <div className="studioDocumentRowActions">
                    <Link className="uiButton uiButtonPrimary" href={`/studio/document/${document.id}`}>
                      다시 열기
                    </Link>
                    <div className="studioDocumentMoreMenu">
                      <button
                        className="studioDocumentMoreButton"
                        type="button"
                        aria-expanded={openMenuDocumentId === document.id}
                        aria-label={`${document.title} 더보기`}
                        onClick={() =>
                          setOpenMenuDocumentId((currentId) => (currentId === document.id ? null : document.id))
                        }
                      >
                        ⋯
                      </button>
                      {openMenuDocumentId === document.id ? (
                        <div className="studioDocumentMorePopover">
                        <button type="button" onClick={() => startTitleEdit(document)}>
                          제목 변경
                        </button>
                        <button type="button" onClick={() => openDeleteConfirm(document)}>
                          삭제
                        </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="studioDocumentsEmptyState" aria-labelledby="studio-documents-empty-title">
            <span aria-hidden="true">□</span>
            <h2 id="studio-documents-empty-title">아직 저장된 기획서가 없습니다.</h2>
            <p>새 프로그램 기획을 시작해 보세요.</p>
            <Link className="uiButton uiButtonPrimary" href="/studio">
              새 기획서 작성
            </Link>
          </section>
        )}
      </main>

      {deleteTarget ? (
        <div className="studioDocumentDeleteOverlay" role="presentation">
          <section
            className="studioDocumentDeleteModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-document-delete-title"
            aria-describedby="studio-document-delete-description"
          >
            <p className="uiEyebrow">DELETE DOCUMENT</p>
            <h2 id="studio-document-delete-title">이 기획서를 삭제할까요?</h2>
            <p id="studio-document-delete-description">
              <strong>{deleteTarget.title}</strong> 문서를 목록에서 제거합니다. 이번 단계에서는 실제 삭제 API를 호출하지 않습니다.
            </p>
            <div className="studioDocumentDeleteActions">
              <button className="uiButton uiButtonSecondary" type="button" onClick={() => setDeleteTarget(null)}>
                취소
              </button>
              <button className="uiButton uiButtonPrimary" type="button" onClick={confirmDeleteDocument}>
                삭제
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
