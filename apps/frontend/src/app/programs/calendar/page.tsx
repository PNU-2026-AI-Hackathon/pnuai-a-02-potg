import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CALENDAR_MAX_VISIBLE_LANES,
  CALENDAR_WEEKDAY_LABELS,
  buildProgramCalendarMonth,
  shiftMonth,
} from '@/lib/program-calendar';
import {
  formatProgramPeriod,
  getProgramSummaries,
  programRecruitLabel,
} from '@/lib/program-prototype';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '캘린더 | 모이라',
  description: '금정구 작은도서관 프로그램의 신청기간을 달력으로 확인합니다.',
};

/** 달력 행의 grid-template-rows. 요일 숫자용 1줄 + 막대 줄 + 넘친 건수용 1줄. */
const CALENDAR_ROW_TEMPLATE = `26px repeat(${CALENDAR_MAX_VISIBLE_LANES}, 22px) 16px`;

type CalendarPageProps = {
  searchParams: Promise<{ year?: string; month?: string }>;
};

/** 벗어난 값이 오면(주소를 직접 고친 경우 등) 오늘 달로 되돌린다. */
function readYearMonth(params: { year?: string; month?: string }, today: Date) {
  const year = Number.parseInt(params.year ?? '', 10);
  const month = Number.parseInt(params.month ?? '', 10);
  const validYear = Number.isFinite(year) && year >= 1970 && year <= 2100 ? year : today.getFullYear();
  const validMonth = Number.isFinite(month) && month >= 1 && month <= 12 ? month : today.getMonth() + 1;
  return { year: validYear, month: validMonth };
}

function monthHref(year: number, month: number) {
  return `/programs/calendar?year=${year}&month=${month}`;
}

export default async function ProgramCalendarPage({ searchParams }: CalendarPageProps) {
  const [params, allPrograms] = await Promise.all([searchParams, getProgramSummaries()]);

  const today = new Date();
  const { year, month } = readYearMonth(params, today);
  const calendar = buildProgramCalendarMonth(allPrograms, year, month, today);
  const { year: prevYear, month: prevMonth } = shiftMonth(year, month, -1);
  const { year: nextYear, month: nextMonth } = shiftMonth(year, month, 1);
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  return (
    <main className="programPage">
      <section className="uiContainer programShell" aria-labelledby="program-calendar-title">
        <nav className="communityBreadcrumb" aria-label="현재 위치">
          <Link href="/">홈</Link><span aria-hidden="true">/</span>
          <Link href="/programs">프로그램 게시판</Link><span aria-hidden="true">/</span>
          <span>캘린더</span>
        </nav>

        <header className="programBoardHero">
          <div>
            <p className="programBoardEyebrow">MOIRA LIBRARY · PROGRAM</p>
            <h1 id="program-calendar-title">캘린더</h1>
            <p>프로그램 게시판에 올라온 신청기간을 달력에서 한눈에 확인해 보세요.</p>
          </div>
        </header>

        <div className="calendarToolbar">
          <div className="calendarMonthNav">
            <Link aria-label="이전 달" href={monthHref(prevYear, prevMonth)}>‹</Link>
            <strong>{year}년 {month}월</strong>
            <Link aria-label="다음 달" href={monthHref(nextYear, nextMonth)}>›</Link>
          </div>
          {!isCurrentMonth ? (
            <Link className="calendarTodayLink" href={monthHref(today.getFullYear(), today.getMonth() + 1)}>
              오늘로 이동
            </Link>
          ) : null}
          <div className="calendarLegend">
            <span className="calendarLegendItem is-open"><i aria-hidden="true" />모집중</span>
            <span className="calendarLegendItem is-upcoming"><i aria-hidden="true" />모집 예정</span>
            <span className="calendarLegendItem is-closed"><i aria-hidden="true" />모집 마감</span>
          </div>
        </div>

        <div className="calendarGrid">
          <div className="calendarWeekdayHeader">
            {CALENDAR_WEEKDAY_LABELS.map((label, index) => (
              <span
                className={index === 0 ? 'isSunday' : index === 6 ? 'isSaturday' : ''}
                key={label}
              >
                {label}
              </span>
            ))}
          </div>

          {calendar.weeks.map((week, weekIndex) => (
            <div
              className="calendarWeekGrid"
              key={week[0].iso}
              style={{ gridTemplateRows: CALENDAR_ROW_TEMPLATE }}
            >
              {week.map((day, col) => (
                <div
                  className={`calendarDayFrame ${day.inMonth ? '' : 'isOutside'} ${day.isToday ? 'isToday' : ''} ${col === 6 ? 'isLastCol' : ''}`}
                  key={`frame-${day.iso}`}
                  style={{ gridColumn: col + 1, gridRow: '1 / -1' }}
                />
              ))}

              {week.map((day, col) => (
                <span
                  className={`calendarDayNumber ${day.inMonth ? '' : 'isOutside'}`}
                  key={`number-${day.iso}`}
                  style={{ gridColumn: col + 1, gridRow: 1 }}
                >
                  {day.dayOfMonth}
                </span>
              ))}

              {calendar.segmentsByWeek[weekIndex].map((segment) => (
                <a
                  aria-label={`${segment.program.title} · ${segment.program.libraryName ?? '운영 도서관 확인 필요'} · 신청기간 ${formatProgramPeriod(segment.program.applyStartDate, segment.program.applyEndDate)} · ${programRecruitLabel[segment.status]} · 공공예약 서비스에서 보기 · 새 탭에서 열립니다`}
                  className={[
                    'calendarEventBar',
                    `is-${segment.status}`,
                    segment.isRangeStart ? '' : 'isContinuedStart',
                    segment.isRangeEnd ? '' : 'isContinuedEnd',
                  ].filter(Boolean).join(' ')}
                  href={segment.program.sourceUrl}
                  key={segment.key}
                  rel="noreferrer"
                  style={{ gridColumn: `${segment.startCol + 1} / ${segment.endCol + 2}`, gridRow: segment.lane + 2 }}
                  target="_blank"
                  title={segment.program.title}
                >
                  {segment.program.title}
                </a>
              ))}

              {week.map((day, col) => {
                const overflowCount = calendar.overflowByWeek[weekIndex][col];
                if (overflowCount === 0) return null;
                return (
                  <span
                    className="calendarDayOverflow"
                    key={`overflow-${day.iso}`}
                    style={{ gridColumn: col + 1, gridRow: CALENDAR_MAX_VISIBLE_LANES + 2 }}
                  >
                    +{overflowCount}건
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
