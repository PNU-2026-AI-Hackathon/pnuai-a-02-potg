'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { formatStudioDate, type StudioDocumentStage, type StudioSavedDocument } from '@/lib/studio-draft';

type ManagedStudioDocument = {
  id: string;
  title: string;
  stage: StudioDocumentStage;
  updatedAt: string;
  category: string;
  audience: string;
  period: string;
  preview: string;
};

type DocumentListState = 'loading' | 'ready' | 'failed' | 'auth-required';

const stageClassName: Record<StudioDocumentStage, string> = {
  '기획 중': 'isDraft',
  '수요조사 중': 'isSurvey',
  '수요조사 완료': 'isSurveyDone',
  '기획서 확정': 'isConfirmed',
};

function normalizeDocument(document: StudioSavedDocument): ManagedStudioDocument {
  return {
    id: document.id,
    title: document.title,
    stage: document.stage,
    updatedAt: formatStudioDate(document.updatedAt),
    category: document.category || '-',
    audience: document.audience || '-',
    period: document.period || '-',
    preview: document.preview || document.content.replace(/\s+/g, ' ').slice(0, 96),
  };
}

export default function StudioDocumentsManager() {
  const [documents, setDocuments] = useState<ManagedStudioDocument[]>([]);
  const [listState, setListState] = useState<DocumentListState>('loading');
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [openMenuDocumentId, setOpenMenuDocumentId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedStudioDocument | null>(null);
  const [notice, setNotice] = useState('');

  const loadDocuments = useCallback(async () => {
    setListState('loading');
    setNotice('');

    try {
      const response = await fetch('/api/studio/documents', {
        cache: 'no-store',
      });
      const data = (await response.json()) as { documents?: StudioSavedDocument[]; error?: string };

      if (response.status === 401) {
        setListState('auth-required');
        setNotice('저장된 기획서를 보려면 로그인이 필요합니다.');
        return;
      }

      if (!response.ok || !data.documents) {
        throw new Error(data.error || '저장된 기획서 목록을 불러오지 못했습니다.');
      }

      setDocuments(data.documents.map(normalizeDocument));
      setListState('ready');
    } catch (error) {
      setListState('failed');
      setNotice(error instanceof Error ? error.message : '저장된 기획서 목록을 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadDocuments();
    });
  }, [loadDocuments]);

  const visibleDocuments = documents;
  const totalCount = visibleDocuments.length;
  const firstDocumentId = visibleDocuments[0]?.id ?? null;

  function startTitleEdit(document: ManagedStudioDocument) {
    setOpenMenuDocumentId(null);
    setEditingDocumentId(document.id);
    setEditingTitle(document.title);
    setNotice('선택한 기획서 제목을 수정할 수 있습니다.');
  }

  function cancelTitleEdit() {
    setEditingDocumentId(null);
    setEditingTitle('');
    setNotice('제목 수정을 취소했습니다.');
  }

  async function submitTitleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextTitle = editingTitle.trim();
    if (!editingDocumentId || nextTitle.length === 0) {
      return;
    }

    try {
      const response = await fetch(`/api/studio/documents/${editingDocumentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: nextTitle }),
      });
      const data = (await response.json()) as { document?: StudioSavedDocument; error?: string };

      if (!response.ok || !data.document) {
        throw new Error(response.status === 401 ? '제목을 변경하려면 로그인이 필요합니다.' : data.error || '기획서 제목을 저장하지 못했습니다.');
      }

      const updatedDocument = normalizeDocument(data.document);
      setDocuments((currentDocuments) =>
        currentDocuments.map((document) => (document.id === updatedDocument.id ? updatedDocument : document)),
      );
      setEditingDocumentId(null);
      setEditingTitle('');
      setNotice('제목이 저장되었습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '기획서 제목을 저장하지 못했습니다.');
    }
  }

  async function confirmDeleteDocument() {
    if (!deleteTarget) {
      return;
    }

    try {
      const response = await fetch(`/api/studio/documents/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = (await response.json()) as { success?: boolean; error?: string };

      if (!response.ok || !data.success) {
        throw new Error(response.status === 401 ? '기획서를 삭제하려면 로그인이 필요합니다.' : data.error || '기획서를 삭제하지 못했습니다.');
      }

      setDocuments((currentDocuments) => currentDocuments.filter((document) => document.id !== deleteTarget.id));
      setNotice(`"${deleteTarget.title}" 기획서를 삭제했습니다.`);
      setDeleteTarget(null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '기획서를 삭제하지 못했습니다.');
    }
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

      <aside className="studioHistoryPanel" aria-label="MOIRA STUDIO 문서 관리 메뉴">
        <div className="studioHistoryHeader">
          <div>
            <strong>문서 관리</strong>
            <small>MOIRA STUDIO</small>
          </div>
        </div>

        <div className="studioHistoryList">
          <Link className="studioHistoryItem isCurrent" href="/studio/documents">
            <span>목록</span>
            <strong>저장된 프로그램 기획서</strong>
            <small>{totalCount}건을 최근 수정 순으로 확인합니다.</small>
          </Link>
          <Link className="studioHistoryItem" href={firstDocumentId ? `/studio/document/${firstDocumentId}` : '/studio'}>
            <span>빠른 이동</span>
            <strong>{firstDocumentId ? '최근 수정 기획서 열기' : '새 프로그램 기획 시작'}</strong>
            <small>{firstDocumentId ? '가장 최근에 수정한 문서로 이동합니다.' : '아직 저장된 문서가 없습니다.'}</small>
          </Link>
          <Link className="studioHistoryItem" href="/studio">
            <span>새 작업</span>
            <strong>새 프로그램 기획 시작</strong>
            <small>조건을 입력하고 새 초안을 준비합니다.</small>
          </Link>
        </div>

        <div className="studioQuickGuide">
          <strong>진행 단계</strong>
          <ol>
            <li>기획 중: 초안을 작성하거나 수정하는 단계입니다.</li>
            <li>수요조사 중: 참여 수요를 확인하는 단계입니다.</li>
            <li>수요조사 완료: 조사 결과를 기획서에 반영하는 단계입니다.</li>
            <li>기획서 확정: 운영 전 최종안으로 확정된 단계입니다.</li>
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
            <h1 id="studio-documents-title">프로그램 기획서 관리</h1>
            <p>저장된 프로그램 기획서를 확인하고 이어서 편집할 수 있습니다.</p>
          </div>
          <div className="studioDocumentsHeaderActions">
            <span aria-live="polite">전체 {totalCount}건</span>
            <button
              className="uiButton uiButtonSecondary"
              type="button"
              onClick={() => void loadDocuments()}
            >
              새로고침
            </button>
            <Link className="uiButton uiButtonPrimary" href="/studio">
              새 기획서 작성
            </Link>
          </div>
        </section>

        {notice ? <p className="studioDocumentsNotice" aria-live="polite">{notice}</p> : null}

        {listState === 'loading' ? (
          <section className="studioDocumentsNotice" aria-live="polite">
            저장된 기획서 목록을 불러오는 중입니다.
          </section>
        ) : null}

        {listState === 'ready' && visibleDocuments.length > 0 ? (
          <section className="studioDocumentsList" aria-label="저장된 기획서 목록">
            <div className="studioDocumentsListHead" aria-hidden="true">
              <span>기획서</span>
              <span>조건</span>
              <span>진행 단계</span>
              <span>문서 작업</span>
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
                        <small>최근 수정 날짜 : {document.updatedAt}</small>
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
                    <span className={`studioDocumentStatusBadge ${stageClassName[document.stage]}`}>
                      {document.stage}
                    </span>
                  </div>

                  <div className="studioDocumentRowActions">
                    <Link className="uiButton uiButtonPrimary" href={`/studio/document/${document.id}`}>
                      기획서 열기
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
        ) : null}

        {listState === 'ready' && visibleDocuments.length === 0 ? (
          <section className="studioDocumentsEmptyState" aria-labelledby="studio-documents-empty-title">
            <span aria-hidden="true">□</span>
            <h2 id="studio-documents-empty-title">아직 저장된 기획서가 없습니다.</h2>
            <p>새 프로그램 기획을 시작해 보세요.</p>
            <Link className="uiButton uiButtonPrimary" href="/studio">
              새 기획서 작성
            </Link>
          </section>
        ) : null}

        {listState === 'failed' ? (
          <section className="studioDocumentsEmptyState" aria-labelledby="studio-documents-failed-title">
            <span aria-hidden="true">□</span>
            <h2 id="studio-documents-failed-title">기획서 목록을 불러오지 못했습니다.</h2>
            <p>{notice}</p>
            <button className="uiButton uiButtonPrimary" type="button" onClick={() => void loadDocuments()}>
              다시 시도
            </button>
          </section>
        ) : null}

        {listState === 'auth-required' ? (
          <section className="studioDocumentsEmptyState" aria-labelledby="studio-documents-auth-title">
            <span aria-hidden="true">□</span>
            <h2 id="studio-documents-auth-title">로그인이 필요합니다.</h2>
            <p>본인이 저장한 프로그램 기획서를 확인하려면 로그인해 주세요.</p>
            <Link className="uiButton uiButtonPrimary" href="/login?next=/studio/documents">
              로그인하기
            </Link>
          </section>
        ) : null}
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
              <strong>{deleteTarget.title}</strong> 문서를 삭제합니다. 삭제 후에는 목록에서 더 이상 표시되지 않습니다.
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
