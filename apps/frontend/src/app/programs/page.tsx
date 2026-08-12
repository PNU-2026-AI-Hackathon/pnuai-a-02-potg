import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatProgramPeriod,
  getProgramPrototypes,
  programCapacityLabel,
  programFeeLabel,
} from '@/lib/program-prototype';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '작은도서관 프로그램 | 모이라',
  description: '금정구 작은도서관의 문화·교육 프로그램을 확인하는 프로토타입 게시판입니다.',
};

export default async function ProgramsPage() {
  const programs = await getProgramPrototypes();
  const libraries = new Set(programs.map((program) => program.libraryName).filter(Boolean)).size;
  const targets = new Set(programs.map((program) => program.targetGroup).filter(Boolean)).size;

  return (
    <main className="programPage">
      <section className="uiContainer programShell" aria-labelledby="program-board-title">
        <nav className="communityBreadcrumb" aria-label="현재 위치">
          <Link href="/">홈</Link><span aria-hidden="true">/</span><span>프로그램 게시판</span>
        </nav>

        <header className="communityBoardHeader programBoardHeader">
          <div>
            <p className="uiEyebrow communityEyebrow">Library Program</p>
            <h1 id="program-board-title">작은도서관 프로그램</h1>
            <p>우리 동네 작은도서관에서 운영하는 문화·교육 프로그램을 한곳에서 확인해 보세요.</p>
          </div>
        </header>

        <section className="programSummary" aria-label="프로그램 현황">
          <div><strong>{programs.length}</strong><span>텍스트형 프로그램</span></div>
          <div><strong>{libraries}</strong><span>운영 도서관</span></div>
          <div><strong>{targets}</strong><span>대상 분류</span></div>
          <p>현재 화면은 본문 텍스트를 읽을 수 있는 프로그램 전체를 정제한 프로토타입입니다. 포스터 이미지와 첨부파일은 보조 자료로 함께 두었으며, 그 안의 내용을 읽어내는 작업은 다음 단계입니다.</p>
        </section>

        <section className="programFilterPreview" aria-label="프로그램 검색 미리보기">
          <label>
            <span>프로그램 검색</span>
            <input disabled placeholder="프로그램명 또는 도서관명 검색" />
          </label>
          <button disabled type="button">전체 대상</button>
          <button disabled type="button">전체 도서관</button>
          <small>검색과 필터는 UI 검토용이며 아직 동작하지 않습니다.</small>
        </section>

        <section className="programListSection" aria-labelledby="program-list-title">
          <div className="programListHeading">
            <h2 id="program-list-title">전체 프로그램</h2>
            <span>총 {programs.length}건</span>
          </div>
          <div className="programCardGrid">
            {programs.map((program) => (
              <article className="programCard" key={program.sourceId}>
                <div className="programCardFlags">
                  <span>{program.targetGroup ?? '대상 미정'}</span>
                  <span className={`is-${program.normalizationStatus}`}>{program.normalizationStatus === 'needs_review' ? '정보 확인 필요' : '정보 정제됨'}</span>
                </div>
                <h3><Link href={`/programs/${program.sourceId}`}>{program.title}</Link></h3>
                <p className="programLibrary">{program.libraryName ?? '운영 도서관 확인 필요'}</p>
                <dl>
                  <div><dt>대상</dt><dd>{program.targetDetail ?? program.targetGroup ?? '확인 필요'}</dd></div>
                  <div><dt>교육기간</dt><dd>{formatProgramPeriod(program.programStartDate, program.programEndDate)}</dd></div>
                  <div><dt>교육시간</dt><dd>{program.scheduleText ?? '확인 필요'}</dd></div>
                  <div><dt>모집인원</dt><dd>{programCapacityLabel(program)}</dd></div>
                </dl>
                <p className="programFee">{programFeeLabel(program)}</p>
                <Link className="programCardLink" href={`/programs/${program.sourceId}`}>상세 정보 보기 <span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
