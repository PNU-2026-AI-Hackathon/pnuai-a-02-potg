import type { ProgramRecruitStatus, ProgramSummary } from './program-prototype';
import { programRecruitStatus } from './program-prototype';

/**
 * 프로그램 게시판을 달력으로 보여주기 위한 순수 계산 로직.
 *
 * 참고한 금정구청 예약 캘린더(체육시설 접수 현황)는 하루 칸마다 그날의 일정을 따로
 * 줄글로 나열한다. 우리는 신청기간이 여러 날에 걸치는 경우가 대부분이라, 하루마다
 * 같은 프로그램명을 반복해 적기보다 시작일부터 종료일까지 이어진 막대 하나로 보여준다
 * (구글 캘린더의 여러 날 일정과 같은 방식). 화면과 계산을 분리해 두어야 주 단위로 막대를
 * 나누고 겹침을 정리하는 로직을 테스트하기 쉽다.
 */

export const CALENDAR_WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/** 한 주에 동시에 그릴 막대 줄 수. 이보다 많이 겹치면 "+N건"으로 접는다. 화면 쪽 grid-template-rows 계산에도 쓴다. */
export const CALENDAR_MAX_VISIBLE_LANES = 4;

export type CalendarDay = {
  date: Date;
  iso: string;
  dayOfMonth: number;
  inMonth: boolean;
  isToday: boolean;
};

export type CalendarSegment = {
  /** React key. 같은 프로그램이 여러 주에 걸쳐 나오면 주마다 하나씩 생긴다. */
  key: string;
  program: ProgramSummary;
  status: ProgramRecruitStatus;
  /** 이 주(0-6, 일~토) 안에서 막대가 시작·끝나는 칸. */
  startCol: number;
  endCol: number;
  lane: number;
  /** 신청 시작일 자체가 이 칸에서 시작하는지. 아니면 주 경계에 잘려 이어지는 중이라는 뜻. */
  isRangeStart: boolean;
  isRangeEnd: boolean;
};

export type ProgramCalendarMonth = {
  year: number;
  month: number;
  weeks: CalendarDay[][];
  /** weeks와 같은 길이. 주별로 그릴 막대 목록. */
  segmentsByWeek: CalendarSegment[][];
  /** weeks[i][j]에 대응. MAX_VISIBLE_LANES를 넘겨 접힌 일정 수. */
  overflowByWeek: number[][];
};

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' 를 그 날짜의 로컬 자정으로 만든다. new Date(iso)는 UTC로 해석해 하루 밀릴 수 있다. */
function parseIsoDate(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function clampDate(date: Date, min: Date, max: Date) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

/** month는 1~12. year·month가 범위를 벗어나면 Date 쪽에서 알아서 이웃 달로 넘어간다. */
export function buildCalendarWeeks(year: number, month: number, today: Date): CalendarDay[][] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);
  const gridStart = addDays(firstOfMonth, -firstOfMonth.getDay());
  const gridEnd = addDays(lastOfMonth, 6 - lastOfMonth.getDay());
  const todayIso = toIsoDate(today);

  const days: CalendarDay[] = [];
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    days.push({
      date: cursor,
      iso: toIsoDate(cursor),
      dayOfMonth: cursor.getDate(),
      inMonth: cursor.getMonth() === month - 1,
      isToday: toIsoDate(cursor) === todayIso,
    });
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/**
 * 신청기간이 있는 프로그램들을 주 단위 막대(segment)로 잘라 반환한다.
 *
 * 한 주 안에서 칸이 겹치는 막대는 구간 스케줄링의 그리디 방식으로 줄(lane)을 나눠 배정한다.
 * 시작일이 빠른 것부터, 같은 시작일이면 기간이 긴 것부터 훑으며 먼저 끝난 줄에 이어 붙인다.
 */
export function buildProgramCalendarMonth(
  programs: ProgramSummary[],
  year: number,
  month: number,
  today: Date,
): ProgramCalendarMonth {
  const weeks = buildCalendarWeeks(year, month, today);
  const gridStart = weeks[0][0].date;
  const gridEnd = weeks[weeks.length - 1][6].date;

  type Range = { program: ProgramSummary; status: ProgramRecruitStatus; start: Date; end: Date };
  const ranges: Range[] = [];
  for (const program of programs) {
    // 신청 시작·종료일 둘 다 없으면 달력 위 어디에도 놓을 수 없다.
    if (!program.applyStartDate && !program.applyEndDate) continue;
    const startIso = program.applyStartDate ?? program.applyEndDate!;
    const endIso = program.applyEndDate ?? program.applyStartDate!;
    let start = parseIsoDate(startIso);
    let end = parseIsoDate(endIso);
    if (end < start) [start, end] = [end, start];
    if (end < gridStart || start > gridEnd) continue; // 이번 달 화면 범위 밖
    ranges.push({ program, status: programRecruitStatus(program, today), start, end });
  }

  ranges.sort((a, b) => {
    if (a.start.getTime() !== b.start.getTime()) return a.start.getTime() - b.start.getTime();
    return (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime());
  });

  const segmentsByWeek: CalendarSegment[][] = weeks.map(() => []);
  const overflowByWeek: number[][] = weeks.map(() => [0, 0, 0, 0, 0, 0, 0]);

  weeks.forEach((week, weekIndex) => {
    const weekStart = week[0].date;
    const weekEnd = week[6].date;
    /** laneEnds[lane] = 그 줄에 마지막으로 놓인 막대의 끝 칸. */
    const laneEnds: number[] = [];

    for (const range of ranges) {
      if (range.end < weekStart || range.start > weekEnd) continue;

      const overlapStart = clampDate(range.start, weekStart, weekEnd);
      const overlapEnd = clampDate(range.end, weekStart, weekEnd);
      const startCol = Math.round((overlapStart.getTime() - weekStart.getTime()) / 86_400_000);
      const endCol = Math.round((overlapEnd.getTime() - weekStart.getTime()) / 86_400_000);

      let lane = laneEnds.findIndex((lastEndCol) => lastEndCol < startCol);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(endCol);
      } else {
        laneEnds[lane] = endCol;
      }

      if (lane >= CALENDAR_MAX_VISIBLE_LANES) {
        for (let col = startCol; col <= endCol; col += 1) overflowByWeek[weekIndex][col] += 1;
        continue;
      }

      segmentsByWeek[weekIndex].push({
        key: `${range.program.sourceId}-${weekIndex}`,
        program: range.program,
        status: range.status,
        startCol,
        endCol,
        lane,
        isRangeStart: overlapStart.getTime() === range.start.getTime(),
        isRangeEnd: overlapEnd.getTime() === range.end.getTime(),
      });
    }
  });

  return { year, month, weeks, segmentsByWeek, overflowByWeek };
}

/** 이전/다음 달 링크를 만들 때 쓰는 정규화. 1월의 이전 달은 작년 12월, 12월의 다음 달은 내년 1월. */
export function shiftMonth(year: number, month: number, delta: number) {
  const base = new Date(year, month - 1 + delta, 1);
  return { year: base.getFullYear(), month: base.getMonth() + 1 };
}
