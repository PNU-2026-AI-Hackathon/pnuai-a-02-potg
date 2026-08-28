'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import GenerateButton from './GenerateButton';
import ConditionDropdown from './ConditionDropdown';
import StudioTutorialModal from './StudioTutorialModal';
import { studioFields, type StudioConditionKey } from './studio-options';
import { formatStudioDate, type StudioSavedDocument } from '@/lib/studio-draft';

const storageKey = 'moira-studio-tutorial-seen';
const conditionKeys: StudioConditionKey[] = ['category', 'audience', 'period'];
const planningFields = studioFields.filter((field) => conditionKeys.includes(field.key));
const planningExamples = ['초등학생 독서 토론', '시니어 디지털 교육', '가족 주말 프로그램'];
/** 선택창에 실리는 의제 하나. 의제 게시판 글에서 필요한 것만 뽑아 온다. */
export type StudioAgendaOption = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

/**
 * 게시판에 다녀오는 동안 적어 둔 것을 맡아 두는 자리.
 *
 * 「아이디어 게시판 둘러보기」를 누르면 화면이 통째로 바뀌므로, 담아 두지 않으면
 * 돌아왔을 때 메모와 고른 조건이 사라진다.
 */
const draftStorageKey = 'moira-studio-condition-draft';

type ConditionDraft = {
  prompt: string;
  conditions: Record<StudioConditionKey, string[]>;
};

export type ProgramConditionFormProps = {
  agendaOptions: StudioAgendaOption[];
  /** 게시판에서 고르고 돌아왔을 때 미리 골라 둘 의제. */
  initialAgendaId: string | null;
};

export default function ProgramConditionForm({ agendaOptions, initialAgendaId }: ProgramConditionFormProps) {
  const [prompt, setPrompt] = useState('');
  // 의제를 골라 돌아왔으면 그 탭을 펴 둔다. 고른 것이 안 보이면 골라진 줄 모른다.
  const [activeMode, setActiveMode] = useState<'planning' | 'agenda'>(initialAgendaId ? 'agenda' : 'planning');
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(initialAgendaId);
  const [conditions, setConditions] = useState<Record<StudioConditionKey, string[]>>({
    category: [],
    audience: [],
    period: [],
  });
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [savedDocuments, setSavedDocuments] = useState<Pick<StudioSavedDocument, 'id' | 'title' | 'updatedAt'>[]>([]);

  /**
   * 게시판에 다녀오기 전에 적어 둔 것을 되살린다.
   *
   * 첫 렌더가 아니라 마운트 뒤에 읽는다. 서버에는 세션 저장소가 없어, 첫 렌더에서 읽으면
   * 서버가 그린 화면과 달라져 hydration이 어긋난다.
   */
  useEffect(() => {
    const stored = window.sessionStorage.getItem(draftStorageKey);
    if (!stored) return;
    window.sessionStorage.removeItem(draftStorageKey);

    try {
      const draft = JSON.parse(stored) as Partial<ConditionDraft>;
      if (typeof draft.prompt === 'string') {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPrompt(draft.prompt);
      }
      if (draft.conditions && typeof draft.conditions === 'object') {
        setConditions((current) => ({ ...current, ...draft.conditions }));
      }
    } catch (error) {
      console.error('Failed to restore studio condition draft:', error);
    }
  }, []);

  useEffect(() => {
    if (window.localStorage.getItem(storageKey) !== 'true') {
      window.localStorage.setItem(storageKey, 'true');
      queueMicrotask(() => setIsTutorialOpen(true));
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function loadSavedDocuments() {
      try {
        const response = await fetch('/api/studio/documents', { cache: 'no-store' });
        const data = (await response.json()) as { documents?: StudioSavedDocument[] };

        if (!isCancelled && response.ok && data.documents) {
          setSavedDocuments(data.documents.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })));
        }
      } catch {
        // 저장 문서 목록은 보조 탐색 UI이므로 실패해도 새 기획 기능은 그대로 유지한다.
      }
    }

    void loadSavedDocuments();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isTutorialOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsTutorialOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isTutorialOpen]);

  const selectedAgenda = agendaOptions.find((post) => post.id === selectedAgendaId) || null;
  const activeAgenda = activeMode === 'agenda' ? selectedAgenda : null;

  /** 게시판으로 떠나기 전에 적어 둔 것을 맡긴다. 돌아오면 위 effect가 되살린다. */
  function keepDraftBeforeLeaving() {
    const draft: ConditionDraft = { prompt, conditions };
    window.sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
  }
  /**
   * 메모와 의제 중 하나만 있으면 생성한다. 의제를 고르는 것 자체가 「이걸로 기획해 달라」는
   * 요청이라, 같은 말을 메모에 한 번 더 적게 할 이유가 없다.
   */
  const canGenerate = prompt.trim().length > 0 || activeAgenda !== null;

  function updateCondition(key: StudioConditionKey, value: string[]) {
    setConditions((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div className="studioPage studioPlanningPage">
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
          <Link className="isActive" href="/studio" aria-current="page">
            <span aria-hidden="true">+</span>
            새 기획
          </Link>
          <Link href="/studio/documents">
            <span aria-hidden="true">≡</span>
            내 기획서
          </Link>
          <button type="button" onClick={() => setIsTutorialOpen(true)}>
            <span aria-hidden="true">?</span>
            도움말
          </button>
        </nav>
      </aside>

      <aside className="studioHistoryPanel" aria-label="MOIRA STUDIO 문서 메뉴">
        <div className="studioHistoryHeader">
          <div>
            <small>MOIRA STUDIO</small>
          </div>
          <span className="studioHistoryPinIcon" aria-hidden="true">◆</span>
        </div>

        <div className="studioDocumentsSidebarBody">
          <Link className="uiButton uiButtonPrimary studioDocumentsNewButton" href="/studio" aria-current="page">
            <span aria-hidden="true">＋</span>
            새 기획서
          </Link>

          <div className="studioDocumentsRecentSection">
            <strong className="studioDocumentsSidebarLabel">최근 기획서</strong>
            {savedDocuments.length > 0 ? (
              <nav className="studioDocumentsRecentList" aria-label="최근 기획서">
                {savedDocuments.map((document) => (
                  <Link className="studioDocumentsRecentItem" href={`/studio/document/${document.id}`} key={document.id}>
                    <strong>{document.title}</strong>
                    <small>{formatStudioDate(document.updatedAt)} 수정</small>
                  </Link>
                ))}
              </nav>
            ) : (
              <p className="studioDocumentsRecentEmpty">아직 저장된 기획서가 없습니다.</p>
            )}
          </div>
        </div>
      </aside>

      <main className="studioMain">
        <section className="uiContainer studioStartSection" aria-labelledby="studio-workspace-title">
          <div className="studioStartCopy">
            <p className="uiEyebrow">LIBRARIAN PLANNING TOOL</p>
            <h1 id="studio-workspace-title">
              <span className="studioTitleSpark" aria-hidden="true">✦</span>
              MOIRA STUDIO
            </h1>
            <p>
              주민의 이야기에서 시작하는 도서관 프로그램 기획을 간단한 아이디어로 시작하세요.
            </p>
          </div>

          <div className="studioStartBoard">
            <div className={`studioPromptCard ${activeMode === 'planning' ? 'isPlanningMode' : 'isAgendaMode'}`}>
              <div className="studioModeTabs" role="list" aria-label="기획 모드">
                <button
                  className={activeMode === 'planning' ? 'isActive' : ''}
                  type="button"
                  onClick={() => setActiveMode('planning')}
                >
                  프로그램 기획
                </button>
                <button
                  className={activeMode === 'agenda' ? 'isActive' : ''}
                  type="button"
                  onClick={() => setActiveMode('agenda')}
                >
                  주민 아이디어
                </button>
              </div>
              <div className="studioModeContent">
                {activeMode === 'planning' ? (
                  <section className="studioPlanningGuide" aria-labelledby="studio-planning-guide-title">
                    <div className="studioPlanningGuideCopy">
                      <strong id="studio-planning-guide-title">
                        <span className="studioPlanningGuideSpark" aria-hidden="true">✦</span>
                        어떤 프로그램을 기획하고 싶나요?
                      </strong>
                      <p>예시를 선택하거나 직접 아이디어를 입력해보세요.</p>
                    </div>
                    <div className="studioPlanningGuideChips" aria-label="프로그램 아이디어 예시">
                      {planningExamples.map((example) => (
                        <button key={example} type="button" onClick={() => setPrompt(example)}>
                          {example}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : (
                  <section className="studioAgendaPicker" aria-label="주민 아이디어 선택">
                    <div className="studioAgendaPickerHeader">
                      <strong><span className="studioAccentSpark" aria-hidden="true">✦</span> 주민 아이디어</strong>
                      {/*
                        의제가 올라오는 곳은 아이디어 게시판이다. 자유 게시판이 아니다.
                        `pick=studio`를 달고 가면 게시판이 「고르는 화면」으로 열려, 거기서 고른
                        의제를 들고 이 화면으로 돌아온다. 단순 링크면 읽고 와서 다시 찾아야 하고,
                        아래 목록에 없는 글은 아예 고를 수가 없다.
                      */}
                      <Link href="/community/ideas?pick=studio" onClick={keepDraftBeforeLeaving}>
                        아이디어 게시판 둘러보기 <span aria-hidden="true">→</span>
                      </Link>
                    </div>
                    {agendaOptions.length > 0 ? (
                      <div className="studioAgendaList">
                        {agendaOptions.map((post) => (
                          <button
                            aria-pressed={post.id === selectedAgendaId}
                            className={post.id === selectedAgendaId ? 'isSelected' : ''}
                            key={post.id}
                            type="button"
                            onClick={() => setSelectedAgendaId((currentId) => (currentId === post.id ? null : post.id))}
                          >
                            <span>{post.tags.join(' · ')}</span>
                            <strong>{post.title}</strong>
                            <p>{post.content}</p>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="studioAgendaEmpty">
                        아직 올라온 주민 아이디어가 없습니다. 게시판에 주민 제안이 올라오면 여기에 보입니다.
                      </p>
                    )}
                  </section>
                )}
              </div>
              <label className="studioPromptBox">
                <span>{activeAgenda ? '추가 요청 (선택)' : '프로그램 아이디어'}</span>
                <textarea
                  aria-label="기획 요청 입력"
                  placeholder={activeAgenda
                    ? '추가하고 싶은 내용이 있다면 입력해 주세요.'
                    : '예: 초등 고학년과 함께 우리 동네 기억을 수집하는 4회차 프로그램'}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                <span className="studioPromptMeta">
                  {prompt.length > 0 ? `${prompt.length}자` : null}
                </span>
              </label>
              <div className="studioInlineConditions">
                {planningFields.map((field) => (
                  <ConditionDropdown
                    key={field.key}
                    label={field.label}
                    multiple={field.multiple}
                    showDescriptions={field.key !== 'category'}
                    options={field.options}
                    placeholder={field.label}
                    value={conditions[field.key]}
                    onChange={(value) => updateCondition(field.key, value)}
                  />
                ))}
              </div>
              <GenerateButton
                canGenerate={canGenerate}
                prompt={prompt}
                conditions={conditions}
                selectedAgenda={activeAgenda}
              />
            </div>
          </div>

        </section>

      </main>

      {isTutorialOpen ? <StudioTutorialModal onClose={() => setIsTutorialOpen(false)} /> : null}
    </div>
  );
}
