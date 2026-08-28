import type { ProgramBoardSearchSource } from './profileBuilder';

/**
 * 정제 결과와 크롤 원본을 검색 코퍼스 입력으로 잇는다.
 *
 * 파일럿은 텍스트 정제 17건과 첨부 정제 표본 20건을 따로 읽어 합쳤다.
 * 전체 정제 결과(351건)는 그 17건을 모두 품고 있어 그대로 합치면 `sourceId`가 겹친다.
 * 그래서 전체 정제 결과 하나만 쓰고, 거기에 없는 것만 크롤 원본에서 채운다.
 *
 * 크롤 원본에서 가져오는 것은 본문 원문(`bodyText`)과 프로그램 내용 표다.
 * 본문에 강의계획서를 통째로 붙여넣은 건이 있는데, 정제가 항목을 못 뽑아 소개가 비는 대신
 * 원문에는 `목 표 …`가 남아 있다. 이 원문이 있어야 그런 건의 소개를 살릴 수 있다.
 */

export type NormalizedProgram = {
  sourceId: number;
  sourceUrl: string;
  title: string;
  basicInfo?: Array<{ label: string; value: string }>;
  board?: { intro?: string[]; sections?: Array<{ id: string; items: Array<{ label: string; value: string }> }> };
  curriculum?: ProgramBoardSearchSource['curriculum'];
  lane?: string;
};

export type CrawlRecord = {
  idx: number;
  bodyText?: string | null;
  programContent?: { tables?: Array<{ rows?: unknown[] }> } | null;
};

/** 기본정보는 `{ label, value }` 목록이라 이름으로 찾아 쓴다. */
function basicValue(program: NormalizedProgram, label: string) {
  return program.basicInfo?.find((entry) => entry.label === label)?.value ?? null;
}

export function toSearchSource(
  program: NormalizedProgram,
  crawl?: CrawlRecord | null,
): ProgramBoardSearchSource {
  return {
    sourceId: program.sourceId,
    sourceUrl: program.sourceUrl,
    title: program.title,
    // 정제는 대상을 한 자리에만 담는다. 파일럿의 두 자리 중 상세 쪽에 맞춘다.
    targetGroup: null,
    targetDetail: basicValue(program, '대상'),
    libraryName: basicValue(program, '운영 도서관'),
    description: crawl?.bodyText ?? null,
    programContent: crawl?.programContent ?? undefined,
    board: { intro: program.board?.intro ?? [], sections: program.board?.sections ?? [] },
    curriculum: program.curriculum ?? [],
    // 회차나 첨부에서 온 내용이 있으면 첨부 계열로 본다. 검색 결과에 근거를 함께 보이기 위함이다.
    sourceType: program.lane === 'TEXT_ONLY' ? 'text' : 'attachment',
  };
}

export function buildCorpusSources(
  programs: NormalizedProgram[],
  crawlRecords: CrawlRecord[],
): ProgramBoardSearchSource[] {
  const byId = new Map(crawlRecords.map((record) => [record.idx, record]));
  const sources = programs.map((program) => toSearchSource(program, byId.get(program.sourceId)));
  const ids = new Set(sources.map((source) => source.sourceId));
  if (!sources.length) throw new Error('semantic search corpus is empty');
  if (ids.size !== sources.length) throw new Error('semantic search corpus contains duplicate sourceId');
  return sources;
}
