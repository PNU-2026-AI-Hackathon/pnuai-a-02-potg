import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MOIRA STUDIO | 기획안 생성 중',
  description: 'MOIRA STUDIO 프로그램 기획안 생성 준비 화면입니다.',
};

export default function StudioGeneratingPage() {
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
          <button className="studioHistoryItem isCurrent" type="button">
            <span>생성 중</span>
            <strong>새 프로그램 기획안</strong>
            <small>지금</small>
          </button>
          <button className="studioHistoryItem" type="button">
            <span>최근 기획</span>
            <strong>시니어 디지털 생활 교실</strong>
            <small>어제</small>
          </button>
        </div>
      </aside>

      <main className="studioMain">
        <section className="uiContainer studioStartSection" aria-labelledby="studio-generating-title">
          <div className="studioStartCopy">
            <p className="uiEyebrow">
              <span className="studioBrandSpark" aria-hidden="true">✦</span>
              MOIRA STUDIO
            </p>
            <h1 id="studio-generating-title">기획안을 준비하고 있습니다</h1>
            <p>작업 내역을 유지한 상태에서 생성 진행 상황을 확인할 수 있습니다.</p>
          </div>
          <section className="studioPromptCard studioGeneratingInlineCard" aria-label="기획안 생성 상태">
            <div className="studioGeneratingMark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <strong>프로그램 기획 초안 생성 중</strong>
            <p>
              현재 이슈 범위에서는 실제 AI 생성 API 대신 더미 기획서를 사용합니다.
              생성된 초안은 다음 화면에서 직접 수정할 수 있습니다.
            </p>
            <Link className="uiButton uiButtonPrimary" href="/studio/document/demo-document-1">
              편집 화면 열기
            </Link>
            <Link className="uiButton uiButtonSecondary" href="/studio">
              기획 메모로 돌아가기
            </Link>
          </section>
        </section>
      </main>
    </div>
  );
}
