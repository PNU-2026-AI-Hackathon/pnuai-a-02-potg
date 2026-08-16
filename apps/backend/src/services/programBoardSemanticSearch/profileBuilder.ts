import { createHash } from 'node:crypto';

export type SearchProfileKind = 'title' | 'title+intro' | 'title+intro+target' | 'title+intro+target+curriculum';

/**
 * 회차 글을 임베딩에 넣을 때의 길이 한도.
 *
 * 회차 글은 중앙값 251자지만 긴 것은 6,500자가 넘어 모델 입력을 넘긴다.
 * 90%를 그대로 담으면서 제목·소개가 묻히지 않는 선으로 자른다.
 */
const CURRICULUM_TEXT_LIMIT = 600;

type BoardItem = { label: string; value: string };

export type ProgramBoardSearchSource = {
  sourceId: number;
  sourceUrl: string;
  title: string;
  targetGroup: string | null;
  targetDetail: string | null;
  libraryName: string | null;
  description: string | null;
  programContent?: { tables?: Array<{ rows?: unknown[] }> };
  curriculum?: Array<{ session?: number; date?: string | null; activity?: string; category?: string | null; teachingMethod?: string | null; materials?: string | null; notes?: string | null }>;
  sourceType?: 'text' | 'attachment';
  board: {
    intro: string[];
    sections: Array<{ id: string; items: BoardItem[] }>;
  };
};

export type ProgramBoardSearchDocument = {
  sourceId: number;
  sourceUrl: string;
  title: string;
  target: string | null;
  libraryName: string | null;
  summary: string;
  profile: SearchProfileKind;
  embeddingText: string;
  checksum: string;
  detailLevel: 'detailed' | 'partial' | 'basic';
  detailReason: string;
  sessionCount: number;
  sourceType: 'text' | 'attachment';
  /**
   * 같은 프로그램이 시간대만 달리해 따로 등록된 것들.
   * 검색에는 대표 하나만 내보내되 나머지를 잃지 않도록 여기에 담는다.
   */
  variants?: Array<{ sourceId: number; title: string; sourceUrl: string }>;
};

const SEMANTIC_LABELS = /(?:내용|목표|소개|선정도서|공연내용|교육내용|운영내용)/;
const ADMIN_LABELS = /(?:일시|기간|장소|신청|접수|문의|전화|인원|비용|재료비|교재비|비고)/;

function clean(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function unique(values: string[]) {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function descriptionGoal(description: string | null) {
  if (!description) return [];
  const compact = description.replace(/\r/g, '');
  const goal = compact.match(/(?:개\s*요\s*)?목\s*표\s+([\s\S]*?)(?=교육\s*대상|수\s*강\s*정\s*보|교육\s*기간|준\s*비\s*사\s*항|차시)/);
  return goal ? [clean(goal[1])] : [];
}

export function programSummary(source: ProgramBoardSearchSource) {
  const contentItems = source.board.sections
    .flatMap((section) => section.items)
    .filter((item) => SEMANTIC_LABELS.test(item.label) && !ADMIN_LABELS.test(item.label))
    .map((item) => `${clean(item.label)}: ${clean(item.value)}`);
  const intro = source.board.intro.filter((line) => !ADMIN_LABELS.test(line));
  const values = unique([...contentItems, ...descriptionGoal(source.description), ...intro]);
  return values.join(' · ');
}

/**
 * 회차에서 검색에 쓸 말만 모은다.
 *
 * 분류·활동·비고만 쓴다. 날짜와 교수방법은 무엇을 배우는지와 상관이 없어 넣지 않는다.
 * 같은 문구가 회차마다 되풀이되는 계획서가 많아 중복은 접는다.
 */
export function curriculumText(source: ProgramBoardSearchSource) {
  const lines = unique((source.curriculum ?? [])
    .map((session) => [session.category, session.activity, session.notes].filter(Boolean).join(' ')));
  const joined = lines.join(' · ');
  return joined.length > CURRICULUM_TEXT_LIMIT ? `${joined.slice(0, CURRICULUM_TEXT_LIMIT)}…` : joined;
}

export function buildSearchDocument(
  source: ProgramBoardSearchSource,
  profile: SearchProfileKind,
): ProgramBoardSearchDocument {
  const summary = programSummary(source);
  const target = clean(source.targetDetail || source.targetGroup || '') || null;
  const parts = [`[제목] ${clean(source.title)}`];
  if (profile !== 'title' && summary) parts.push(`[소개·목표] ${summary}`);
  if (profile.includes('target') && target) parts.push(`[대상] ${target}`);
  if (profile.includes('curriculum')) {
    const sessions = curriculumText(source);
    if (sessions) parts.push(`[회차] ${sessions}`);
  }
  const embeddingText = parts.join('\n');
  const description = source.description || '';
  const numberedSessions = [...description.matchAll(/(?:^|\n)\s*(\d{1,2})\s+(?=\d{1,2}[./-]|\d{1,2}\s*월|<|[-ㆍ◈])/g)].length;
  const tableSessionCount = Math.max(0, ...(source.programContent?.tables || []).map((table) => Math.max(0, (table.rows?.length || 0) - 1)));
  const structuredSessionCount = source.curriculum?.length || 0;
  const sessionCount = structuredSessionCount || numberedSessions || tableSessionCount;
  const hasCurriculum = /차시[\s\S]{0,80}(?:세부\s*)?(?:교육|강의|활동)\s*내용/.test(description) || sessionCount >= 2;
  const detailLevel = hasCurriculum ? 'detailed' : summary ? 'partial' : 'basic';
  return {
    sourceId: source.sourceId,
    sourceUrl: source.sourceUrl,
    title: clean(source.title),
    target,
    libraryName: source.libraryName ? clean(source.libraryName) : null,
    summary,
    profile,
    embeddingText,
    checksum: createHash('sha256').update(embeddingText, 'utf8').digest('hex'),
    detailLevel,
    detailReason: hasCurriculum ? '목표와 회차별 교육 내용 존재' : summary ? '소개·목표는 있으나 회차별 내용 없음' : '제목·대상 등 기본 정보만 존재',
    sessionCount,
    sourceType: source.sourceType || 'text',
  };
}

export function buildSearchDocuments(
  sources: ProgramBoardSearchSource[],
  profile: SearchProfileKind,
) {
  const documents = sources.map((source) => buildSearchDocument(source, profile));
  const ids = new Set(documents.map((document) => document.sourceId));
  if (ids.size !== documents.length) throw new Error('program board search documents contain duplicate sourceId');
  return documents;
}
