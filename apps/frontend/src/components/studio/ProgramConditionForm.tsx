'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import GenerateButton from './GenerateButton';
import ConditionDropdown from './ConditionDropdown';
import StudioTutorialModal from './StudioTutorialModal';
import { studioFields, type StudioConditionKey } from './studio-options';

const storageKey = 'moira-studio-tutorial-seen';
const conditionKeys: StudioConditionKey[] = ['category', 'audience', 'period'];
const planningFields = studioFields.filter((field) => conditionKeys.includes(field.key));
type AgendaPost = {
  id: string;
  title: string;
  content: string;
  tags: string[];
};

const agendaPosts = [
  {
    id: 'proposals-2',
    title: '시니어 대상 스마트폰 반복 교육이 필요합니다',
    content:
      '키오스크, 공공앱, 모바일 은행 사용을 여러 번 연습할 수 있는 소규모 프로그램을 제안합니다.',
    tags: ['디지털 교육', '시니어'],
  },
  {
    id: 'proposals-3',
    title: '방과후 숙제 도움 프로그램을 운영하면 좋겠습니다',
    content:
      '맞벌이 가정 아이들이 도서관에서 안전하게 머물며 숙제를 도울 수 있는 시간이 있으면 좋겠습니다.',
    tags: ['아동', '방과후'],
  },
  {
    id: 'proposals-4',
    title: '도서관 주변 분리배출 캠페인을 제안합니다',
    content:
      '작은도서관을 거점으로 어린이와 주민이 함께 참여하는 자원순환 캠페인을 열면 좋겠습니다.',
    tags: ['환경', '캠페인'],
  },
];

export default function ProgramConditionForm() {
  const [prompt, setPrompt] = useState('');
  const [activeMode, setActiveMode] = useState<'planning' | 'agenda'>('planning');
  const [selectedAgendaId, setSelectedAgendaId] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Record<StudioConditionKey, string[]>>({
    category: [],
    audience: [],
    period: [],
  });
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  useEffect(() => {
    if (window.localStorage.getItem(storageKey) !== 'true') {
      window.localStorage.setItem(storageKey, 'true');
      queueMicrotask(() => setIsTutorialOpen(true));
    }
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

  const selectedAgenda = agendaPosts.find((post) => post.id === selectedAgendaId) || null;
  /**
   * 메모와 의제 중 하나만 있으면 생성한다. 의제를 고르는 것 자체가 「이걸로 기획해 달라」는
   * 요청이라, 같은 말을 메모에 한 번 더 적게 할 이유가 없다.
   */
  const canGenerate = prompt.trim().length > 0 || selectedAgenda !== null;

  function updateCondition(key: StudioConditionKey, value: string[]) {
    setConditions((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div className="studioPage">
      <aside className="studioSideRail" aria-label="MOIRA STUDIO 메뉴">
        <Link className="studioRailLogo" href="/" aria-label="MOIRA 홈으로 이동">
          <span>MO</span>
        </Link>
        <nav className="studioRailNav" aria-label="작업 메뉴">
          <button className="isActive" type="button">
            <span aria-hidden="true">+</span>
            새 기획
          </button>
          <Link href="/studio/documents">
            <span aria-hidden="true">≡</span>
            작업내역
          </Link>
          <button type="button" onClick={() => setIsTutorialOpen(true)}>
            <span aria-hidden="true">?</span>
            도움말
          </button>
        </nav>
      </aside>

      <aside className="studioHistoryPanel" aria-label="MOIRA STUDIO 작업 내역">
        <div className="studioHistoryHeader">
          <div>
            <strong>작업 내역</strong>
            <small>MOIRA STUDIO</small>
          </div>
          <button type="button" aria-label="작업 내역 고정">◆</button>
        </div>

        <div className="studioHistoryList" aria-live="polite">
          {prompt.trim().length > 0 ? (
            <button className="studioHistoryItem isCurrent" type="button">
              <span>작성 중</span>
              <strong>{prompt.trim()}</strong>
              <small>방금 전</small>
            </button>
          ) : (
            <div className="studioEmptyHistory">
              <span aria-hidden="true">□</span>
              <p>작성 중인 기획이 여기에 표시돼요.</p>
            </div>
          )}

          <button className="studioHistoryItem" type="button">
            <span>초안</span>
            <strong>시니어 디지털 생활 교실</strong>
            <small>어제</small>
          </button>
          <button className="studioHistoryItem" type="button">
            <span>검토</span>
            <strong>가족 독서 주말 프로그램</strong>
            <small>3일 전</small>
          </button>
        </div>

        <div className="studioQuickGuide">
          <strong>빠른 시작</strong>
          <ol>
            <li>만들고 싶은 프로그램을 한 줄로 적습니다.</li>
            <li>관련 의제나 사례를 참고합니다.</li>
            <li>기획안 만들기로 초안 흐름을 시작합니다.</li>
          </ol>
        </div>
      </aside>

      <main className="studioMain">
        <section className="uiContainer studioStartSection" aria-labelledby="studio-workspace-title">
          <div className="studioStartCopy">
            <p className="uiEyebrow">LIBRARIAN PLANNING TOOL</p>
            <h1 id="studio-workspace-title">MOIRA STUDIO</h1>
            <p>
              주민의 이야기에서 시작하는 도서관 프로그램 기획을 짧은 메모로 시작하세요.
            </p>
          </div>

          <div className="studioStartBoard">
            <div className="studioPromptCard">
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
                  지역 의제
                </button>
              </div>
              {activeMode === 'agenda' ? (
                <section className="studioAgendaPicker" aria-label="지역 의제 제안 글 선택">
                  <div className="studioAgendaPickerHeader">
                    <strong>지역 의제 제안 글</strong>
                    {/* 의제가 올라오는 곳은 아이디어 게시판이다. 자유 게시판이 아니다. */}
                    <Link href="/community/ideas">동네 광장 보기</Link>
                  </div>
                  <div className="studioAgendaList">
                    {agendaPosts.map((post) => (
                      <button
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
                </section>
              ) : null}
              {selectedAgenda ? (
                <div className="studioSelectedAgenda" aria-live="polite">
                  <span>선택한 의제</span>
                  <strong>{selectedAgenda.title}</strong>
                </div>
              ) : null}
              <label className="studioPromptBox">
                <span>기획 메모{selectedAgenda ? ' (선택)' : ''}</span>
                <textarea
                  aria-label="기획 요청 입력"
                  placeholder={selectedAgenda
                    ? '고른 의제에 덧붙일 것이 있으면 적어 주세요. 비워 두어도 됩니다.'
                    : '예: 초등 고학년과 함께 우리 동네 기억을 수집하는 4회차 프로그램'}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
              </label>
              <div className="studioInlineConditions">
                {planningFields.map((field) => (
                  <ConditionDropdown
                    key={field.key}
                    label={field.label}
                    multiple={field.multiple}
                    options={field.options}
                    placeholder={field.label}
                    value={conditions[field.key]}
                    onChange={(value) => updateCondition(field.key, value)}
                  />
                ))}
              </div>
              <div className="studioPromptMeta">
                {/* 의제를 골랐으면 메모가 없어도 된다는 것을 여기서 알려 준다. */}
                <span>
                  {prompt.length > 0
                    ? `${prompt.length}자`
                    : selectedAgenda
                      ? '의제만으로도 만들 수 있어요. 메모를 더하면 더 잘 맞습니다.'
                      : '짧게 적어도 괜찮아요'}
                </span>
              </div>
              <GenerateButton
                canGenerate={canGenerate}
                prompt={prompt}
                conditions={conditions}
                selectedAgenda={selectedAgenda}
              />
            </div>
          </div>

        </section>

        <footer className="studioFootnote">
          기획 초안은 사서의 검토와 지역 상황에 맞춘 조정을 전제로 합니다.
        </footer>
      </main>

      {isTutorialOpen ? <StudioTutorialModal onClose={() => setIsTutorialOpen(false)} /> : null}
    </div>
  );
}
