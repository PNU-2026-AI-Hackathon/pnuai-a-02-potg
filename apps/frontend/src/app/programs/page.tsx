import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatProgramPeriod,
  getProgramPrototypes,
  programCapacityLabel,
  programRecruitLabel,
  programRecruitStatus,
} from '@/lib/program-prototype';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '작은도서관 프로그램 | 모이라',
  description: '금정구 작은도서관의 문화·교육 프로그램을 확인하는 게시판입니다.',
};

/** 한 페이지에 3열 × 3행. */
const PAGE_SIZE = 9;

/** 페이지 번호 막대에 한 번에 보일 개수. 350건이면 39페이지라 전부 늘어놓을 수 없다. */
const PAGE_WINDOW = 5;

function readPage(value: string | undefined, lastPage: number) {
  const parsed = Number.parseInt(value ?? '1', 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(Math.max(parsed, 1), lastPage);
}

/** 지금 페이지를 가운데 두고 앞뒤로 몇 개. 처음과 끝에서는 한쪽으로 붙는다. */
function pageWindow(current: number, lastPage: number) {
  const half = Math.floor(PAGE_WINDOW / 2);
  const start = Math.max(1, Math.min(current - half, lastPage - PAGE_WINDOW + 1));
  const end = Math.min(lastPage, start + PAGE_WINDOW - 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

type ProgramsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function ProgramsPage({ searchParams }: ProgramsPageProps) {
  const [{ page: pageParam }, programs] = await Promise.all([searchParams, getProgramPrototypes()]);

  const today = new Date();
  const openCount = programs.filter((program) => programRecruitStatus(program, today) === 'open').length;
  const libraries = new Set(programs.map((program) => program.libraryName).filter(Boolean)).size;

  const lastPage = Math.max(1, Math.ceil(programs.length / PAGE_SIZE));
  const page = readPage(pageParam, lastPage);
  const pageItems = programs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageHref = (target: number) => (target === 1 ? '/programs' : `/programs?page=${target}`);

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
          <div><strong>{programs.length}</strong><span>전체 프로그램</span></div>
          <div><strong>{openCount}</strong><span>모집 중</span></div>
          <div><strong>{libraries}</strong><span>운영 도서관</span></div>
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
            <span>총 {programs.length}건 · {page}/{lastPage} 페이지</span>
          </div>

          {/*
            모집 중이 하나도 없을 때 아무 말이 없으면 회색 카드만 늘어놓은 화면이 되어,
            무엇이 잘못된 것인지 알 수 없다. 수집 시점 탓이라는 것을 알려 준다.
          */}
          {programs.length > 0 && openCount === 0 ? (
            <p className="programBoardNotice" role="status">
              지금 모집 중인 프로그램이 없습니다. 지난 프로그램을 최신순으로 보여드립니다.
            </p>
          ) : null}

          {programs.length === 0 ? (
            <p className="programBoardNotice" role="status">
              프로그램 데이터가 아직 준비되지 않았습니다. 백엔드에서 <code>npm run program-board:build -- --profile all</code>을 실행해 주세요.
            </p>
          ) : (
            <div className="programCardGrid">
              {pageItems.map((program) => {
                const status = programRecruitStatus(program, today);
                return (
                  <article className={`programCard is-${status}`} key={program.sourceId}>
                    <div className="programCardFlags">
                      <span className={`programStatusBadge is-${status}`}>{programRecruitLabel[status]}</span>
                      <span className="programCardTarget">{program.targetGroup ?? '대상 미정'}</span>
                    </div>
                    <h3><Link href={`/programs/${program.sourceId}`}>{program.title}</Link></h3>
                    <p className="programLibrary">{program.libraryName ?? '운영 도서관 확인 필요'}</p>
                    <dl>
                      <div><dt>신청기간</dt><dd>{formatProgramPeriod(program.applyStartDate, program.applyEndDate)}</dd></div>
                      <div><dt>교육기간</dt><dd>{formatProgramPeriod(program.programStartDate, program.programEndDate)}</dd></div>
                      <div><dt>모집인원</dt><dd>{programCapacityLabel(program)}</dd></div>
                    </dl>
                    {/* 첨부·포스터에서 회차를 뽑아 둔 프로그램은 눌러 볼 값이 있다는 뜻이다. */}
                    {program.curriculum.length ? (
                      <p className="programCurriculumChip">회차 {program.curriculum.length}회 정리됨</p>
                    ) : null}
                    <Link className="programCardLink" href={`/programs/${program.sourceId}`}>상세 정보 보기 <span aria-hidden="true">→</span></Link>
                  </article>
                );
              })}
            </div>
          )}

          {lastPage > 1 ? (
            <nav className="programPagination" aria-label="프로그램 목록 페이지">
              <Link aria-disabled={page === 1} className={page === 1 ? 'isDisabled' : ''} href={pageHref(1)}>«</Link>
              <Link aria-disabled={page === 1} className={page === 1 ? 'isDisabled' : ''} href={pageHref(Math.max(1, page - 1))}>‹</Link>
              {pageWindow(page, lastPage).map((target) => (
                <Link
                  aria-current={target === page ? 'page' : undefined}
                  className={target === page ? 'isCurrent' : ''}
                  href={pageHref(target)}
                  key={target}
                >
                  {target}
                </Link>
              ))}
              <Link aria-disabled={page === lastPage} className={page === lastPage ? 'isDisabled' : ''} href={pageHref(Math.min(lastPage, page + 1))}>›</Link>
              <Link aria-disabled={page === lastPage} className={page === lastPage ? 'isDisabled' : ''} href={pageHref(lastPage)}>»</Link>
            </nav>
          ) : null}
        </section>
      </section>
    </main>
  );
}
