import type { ProgramBoardSearchSource } from './profileBuilder';

/**
 * 같은 프로그램이 여러 건으로 등록된 것을 검색에서만 하나로 묶는다.
 *
 * 원사이트는 시간대마다 따로 접수를 받으므로 「마술체험(일요일 10:00~11:00)」처럼
 * 시간대만 다른 레코드가 다섯 건씩 있다. 이대로 검색하면 한 프로그램이 상위를 다 차지한다.
 *
 * 레코드를 지우지는 않는다. 게시판은 원본대로 다 보여줘야 하므로, 검색에 내보낼 대표만
 * 고르고 나머지는 대표에 딸려 보낸다. 화면에서 「5개 시간대 운영」처럼 안내할 수 있다.
 *
 * 묶는 기준은 제목·대상·교육기간이 모두 같을 때다. 셋 중 하나라도 다르면 다른 프로그램이다.
 * 「들락날락 영어랑 놀자」는 열두 건이지만 대상이 유아반과 초등반으로 갈리고 기수마다
 * 기간이 달라 묶이지 않는다. 실제로 다른 수업이므로 그것이 맞다.
 */

export type ProgramGroup = {
  key: string;
  representative: ProgramBoardSearchSource;
  /** 대표에 딸린 같은 프로그램들. 등록 순서(sourceId)대로 둔다. */
  variants: Array<{ sourceId: number; title: string; sourceUrl: string }>;
};

/**
 * 제목에서 회차·기수·시간대 표기를 걷어낸다.
 *
 * 괄호는 통째로 뗀다. 시간대(`(일요일 10:00~11:00)`)와 출생연도 안내가 모두 괄호에 들어간다.
 * `1차`·`2기`·`3회`처럼 붙는 수량 표기와 연도·반기 표기도 뗀다.
 */
export function titleKey(title: string) {
  return title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\d+\s*(?:기|차|회|타임|반)/g, '')
    .replace(/\d{4}년|상반기|하반기/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * 대상에서 괄호 안 부연을 뗀다.
 *
 * 같은 대상을 `초등학생 전학년(2024학년도 기준)`과 `초등학생 전학년 (2024학년도 기준`처럼
 * 달리 적은 건이 있다. 괄호를 떼야 같은 것으로 본다.
 */
export function targetKey(target: string | null) {
  return (target ?? '').replace(/\(.*$/, '').replace(/[^\p{L}\p{N}~-]/gu, '');
}

function groupKeyOf(source: ProgramBoardSearchSource, period: string) {
  return [titleKey(source.title), targetKey(source.targetDetail ?? source.targetGroup), period].join('|');
}

/** 회차가 많을수록 내용이 자세하다. 같으면 먼저 등록된 것을 대표로 둔다. */
function betterRepresentative(left: ProgramBoardSearchSource, right: ProgramBoardSearchSource) {
  const bySessions = (right.curriculum?.length ?? 0) - (left.curriculum?.length ?? 0);
  return bySessions !== 0 ? bySessions : left.sourceId - right.sourceId;
}

export function groupSimilarPrograms(
  sources: ProgramBoardSearchSource[],
  periodOf: (source: ProgramBoardSearchSource) => string,
): ProgramGroup[] {
  const buckets = new Map<string, ProgramBoardSearchSource[]>();
  for (const source of sources) {
    const key = groupKeyOf(source, periodOf(source));
    buckets.set(key, [...(buckets.get(key) ?? []), source]);
  }
  return [...buckets.entries()].map(([key, members]) => {
    const [representative, ...rest] = [...members].sort(betterRepresentative);
    return {
      key,
      representative,
      variants: rest
        .sort((left, right) => left.sourceId - right.sourceId)
        .map((source) => ({ sourceId: source.sourceId, title: source.title, sourceUrl: source.sourceUrl })),
    };
  });
}
