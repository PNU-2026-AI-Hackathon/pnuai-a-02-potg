import type { Metadata } from 'next';
import Link from 'next/link';
import {
  formatProgramPeriod,
  getProgramSummaries,
  programCapacityLabel,
  programRecruitLabel,
  programRecruitStatus,
  type ProgramSummary,
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

/** 검색·필터 조건. 주소에 남겨야 페이지를 넘겨도 조건이 유지된다. */
type ProgramFilters = {
  q: string;
  status: string;
  target: string;
  library: string;
};

const statusOptions = [
  { value: '', label: '전체' },
  { value: 'open', label: '모집중' },
  { value: 'upcoming', label: '모집 예정' },
  { value: 'closed', label: '모집 마감' },
];

function matchesFilters(program: ProgramSummary, filters: ProgramFilters, today: Date) {
  if (filters.status && programRecruitStatus(program, today) !== filters.status) return false;
  if (filters.target && program.targetGroup !== filters.target) return false;
  if (filters.library && program.libraryName !== filters.library) return false;

  if (filters.q) {
    /** 프로그램명과 도서관명 어느 쪽에 걸려도 찾은 것으로 본다. 띄어쓰기는 무시한다. */
    const needle = filters.q.replace(/\s+/g, '').toLowerCase();
    const haystack = `${program.title}${program.libraryName ?? ''}`.replace(/\s+/g, '').toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  return true;
}

type ProgramsPageProps = {
  searchParams: Promise<{ page?: string; q?: string; status?: string; target?: string; library?: string }>;
};

export default async function ProgramsPage({ searchParams }: ProgramsPageProps) {
  const [params, allPrograms] = await Promise.all([searchParams, getProgramSummaries()]);

  const filters: ProgramFilters = {
    q: (params.q ?? '').trim(),
    status: statusOptions.some((option) => option.value === params.status) ? params.status ?? '' : '',
    target: (params.target ?? '').trim(),
    library: (params.library ?? '').trim(),
  };
  const hasFilters = Boolean(filters.q || filters.status || filters.target || filters.library);

  const today = new Date();
  /**
   * 고르는 목록은 거른 결과가 아니라 전체에서 만든다. 거른 뒤로 만들면 방금 고른 조건
   * 말고는 선택지가 사라져, 조건을 바꾸려면 먼저 풀어야 한다.
   */
  const targetOptions = [...new Set(allPrograms.map((program) => program.targetGroup).filter((v): v is string => Boolean(v)))].sort();
  const libraryOptions = [...new Set(allPrograms.map((program) => program.libraryName).filter((v): v is string => Boolean(v)))].sort();

  const programs = allPrograms.filter((program) => matchesFilters(program, filters, today));
  const openCount = programs.filter((program) => programRecruitStatus(program, today) === 'open').length;
  const libraries = new Set(programs.map((program) => program.libraryName).filter(Boolean)).size;

  const lastPage = Math.max(1, Math.ceil(programs.length / PAGE_SIZE));
  const page = readPage(params.page, lastPage);
  const pageItems = programs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /** 페이지를 넘겨도 조건이 따라가야 한다. 안 그러면 2페이지에서 필터가 풀린다. */
  const pageHref = (target: number) => {
    const query = new URLSearchParams();
    if (filters.q) query.set('q', filters.q);
    if (filters.status) query.set('status', filters.status);
    if (filters.target) query.set('target', filters.target);
    if (filters.library) query.set('library', filters.library);
    if (target > 1) query.set('page', String(target));
    const suffix = query.toString();
    return suffix ? `/programs?${suffix}` : '/programs';
  };

  return (
    <main className="programPage">
      <section className="uiContainer programShell" aria-labelledby="program-board-title">
        <nav className="communityBreadcrumb" aria-label="현재 위치">
          <Link href="/">홈</Link><span aria-hidden="true">/</span><span>프로그램 게시판</span>
        </nav>

        <header className="programBoardHero">
          <div>
            <p className="programBoardEyebrow">MOIRA LIBRARY · PROGRAM</p>
            <h1 id="program-board-title">우리 동네에서<br />열리는 프로그램들.</h1>
            <p>금정구 도서관이 운영한 문화·교육 프로그램을 한곳에서 확인해 보세요.</p>
          </div>
        </header>

        <section className="programSummary" aria-label="프로그램 현황">
          <div><strong>{programs.length}</strong><span>전체 프로그램</span></div>
          <div><strong>{openCount}</strong><span>모집 중</span></div>
          <div><strong>{libraries}</strong><span>운영 도서관</span></div>
        </section>

        {/*
          평범한 form에 GET으로 보낸다. 조건이 주소에 남아야 뒤로 가기와 새로고침,
          링크 공유가 모두 되고, 페이지를 넘겨도 조건이 따라간다.
          page를 담지 않으므로 조건을 바꾸면 1페이지부터 다시 본다.
        */}
        <form action="/programs" className="programFilterBar" method="get">
          <label>
            <span>접수별</span>
            <select defaultValue={filters.status} name="status">
              {statusOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span>대상별</span>
            <select defaultValue={filters.target} name="target">
              <option value="">전체 대상</option>
              {targetOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>도서관</span>
            <select defaultValue={filters.library} name="library">
              <option value="">전체 도서관</option>
              {libraryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="programFilterSearch">
            <span>프로그램 검색</span>
            <input defaultValue={filters.q} name="q" placeholder="프로그램명 또는 도서관명" type="search" />
          </label>
          {/* 조건을 풀 때도 「전체」로 되돌려 검색을 누르면 된다. 되돌리기 단추를 따로 두지 않는다. */}
          <button className="uiButton uiButtonPrimary" type="submit">검색</button>
        </form>

        <section className="programListSection" aria-labelledby="program-list-title">
          <div className="programListHeading">
            <h2 id="program-list-title">{hasFilters ? '검색 결과' : '전체 프로그램'}</h2>
            <span>총 {programs.length}건 · {page}/{lastPage} 페이지</span>
          </div>

          {programs.length === 0 ? (
            <p className="programBoardNotice" role="status">
              {hasFilters
                ? '조건에 맞는 프로그램이 없습니다. 조건을 바꾸거나 지워 보세요.'
                : <>프로그램 데이터가 아직 준비되지 않았습니다. 백엔드에서 <code>npm run program-board:build -- --profile all</code> 뒤에 <code>npm run program-board:publish</code>를 실행해 주세요.</>}
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
                    {/*
                      카드를 누르면 공공예약 포털의 그 프로그램으로 바로 간다. 신청도 안내도
                      결국 그쪽에서 이뤄지므로, 우리 화면을 한 번 더 거치게 할 이유가 없다.
                      새 탭으로 열어 목록에서 보던 자리를 잃지 않게 한다.
                    */}
                    <h3>
                      <a href={program.sourceUrl} rel="noreferrer" target="_blank">{program.title}</a>
                    </h3>
                    <p className="programLibrary">{program.libraryName ?? '운영 도서관 확인 필요'}</p>
                    <dl>
                      <div><dt>신청기간</dt><dd>{formatProgramPeriod(program.applyStartDate, program.applyEndDate)}</dd></div>
                      <div><dt>교육기간</dt><dd>{formatProgramPeriod(program.programStartDate, program.programEndDate)}</dd></div>
                      <div><dt>모집인원</dt><dd>{programCapacityLabel(program)}</dd></div>
                    </dl>
                    <a className="programCardLink" href={program.sourceUrl} rel="noreferrer" target="_blank">
                      공공예약에서 보기 <span aria-hidden="true">↗</span>
                      <span className="uiSrOnly">새 탭에서 열립니다</span>
                    </a>
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
