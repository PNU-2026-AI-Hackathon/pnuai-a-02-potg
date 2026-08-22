/**
 * 같은 프로그램의 반복 회차를 묶는 키를 만든다.
 *
 * 원사이트는 회차별로 따로 접수를 받으려고 글을 나눠 올린다. 그래서 제목만 다르고
 * 내용이 같은 글이 줄줄이 생긴다(예: '이야기로 만나는 동화나라[4/11(토)]' 35건).
 * 이 상태로 게시판에 그대로 올리면 첫 화면이 같은 제목으로 덮인다.
 *
 * 여기서는 묶을 수 있는 키만 붙이고, 실제로 묶어서 보여줄지는 게시판 쪽에서 정한다.
 * 신청은 회차별로 따로 받아야 하므로 레코드를 합치지는 않는다.
 */

export type SeriesInfo = {
  /** 같은 값을 가지면 같은 프로그램의 다른 회차 */
  seriesKey: string;
  /** 제목에서 회차를 가리키던 부분(날짜·차수 등). 회차 선택 UI에 쓴다. */
  occurrenceLabel: string | null;
};

/**
 * 회차를 가리키는 표기. 원사이트는 같은 프로그램을 날짜뿐 아니라 시각(풍선아트 13:00~13:20),
 * 월(6월 벙개 독서회), 차수((2차))로도 나눠 올린다. 셋 다 걷어내야 같은 묶음으로 모인다.
 */
const OCCURRENCE_IN_TITLE = new RegExp([
  /\d{1,2}\s*[/.]\s*\d{1,2}\s*\.?\s*(?:\([월화수목금토일]\))?/, // 4/11(토), 10.15.
  /\d{1,2}\s*월\s*\d{0,2}\s*일?/,                                  // 6월, 12월 2일
  /\d{1,2}\s*:\s*\d{2}\s*(?:~\s*\d{1,2}\s*:\s*\d{2})?/,            // 13:00 ~ 13:20
  /\(?\s*\d{1,2}\s*차\s*\)?/,                                       // (2차)
  /\(\s*\d+\s*분\s*\)/,                                             // (20분)
  /\([월화수목금토일]요일[^)]*\)/,                                   // (일요일 10:00~11:00)
].map((part) => part.source).join('|'), 'g');

export function seriesInfoOf(title: string, libraryName: string | null): SeriesInfo {
  const withoutTags = title.replace(/^\s*(?:\[[^\]]*\]\s*)+/, '').trim();

  const occurrences = withoutTags.match(OCCURRENCE_IN_TITLE);
  const occurrenceLabel = occurrences?.length ? occurrences.join(' ').replace(/\s+/g, ' ').trim() : null;

  const base = withoutTags
    .replace(OCCURRENCE_IN_TITLE, ' ')
    .replace(/[[\]()（）<>「」]/g, ' ')
    .replace(/\s+/g, '')
    .trim();

  return {
    seriesKey: `${libraryName ?? '미상'}::${base || withoutTags.replace(/\s+/g, '')}`,
    occurrenceLabel,
  };
}
