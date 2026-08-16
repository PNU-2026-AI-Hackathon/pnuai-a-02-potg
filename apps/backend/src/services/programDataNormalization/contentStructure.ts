import labelDictionary from './dictionaries/labels.json';
import noticeDictionary from './dictionaries/notices.json';
import { lookupLabel, parseLabelLine } from './dictionary';

/**
 * 본문을 게시판 구획으로 배치한다.
 *
 * 이 작업은 렌더링이 아니라 정제다. 화면에서 하면 규칙을 테스트할 수 없고
 * DB로 옮길 때 다시 써야 하므로 백엔드에 둔다. 배치 규칙은 전부 사전에서 읽는다.
 */

export const NOTICE_DICTIONARY_VERSION = noticeDictionary.version;

type SectionId = 'content' | 'operation' | 'application' | 'contact';

const SECTIONS = labelDictionary.sections as Record<SectionId, { title: string; fields: string[] }>;
const SECTION_ORDER: SectionId[] = ['content', 'operation', 'application', 'contact'];
const FIELD_TO_SECTION = new Map<string, SectionId>();
for (const id of SECTION_ORDER) {
  for (const field of SECTIONS[id].fields) FIELD_TO_SECTION.set(field, id);
}
const DUPLICATE_FIELDS = new Set(labelDictionary.duplicateOfBasicInfo as string[]);

const NOTICE_TOPICS = noticeDictionary.topics as Array<{ id: string; title: string; keywords: string[] }>;
const NOTICE_FALLBACK = noticeDictionary.fallbackTopic as { id: string; title: string };
const SENTENCE_END = /(?:습니다|합니다|됩니다|바랍니다|주세요|드립니다|입니다)[.!]?$|다[.!]$/;

export type ProgramSection = { id: SectionId; title: string; items: Array<{ label: string; value: string }> };
export type ProgramNoticeGroup = { id: string; title: string; lines: string[] };

export type ProgramBoardContent = {
  sections: ProgramSection[];
  /** 라벨이 붙지 않은 자유문. 문장을 쪼개거나 항목명을 지어내지 않고 그대로 둔다. */
  intro: string[];
  notices: ProgramNoticeGroup[];
  unmappedLabels: string[];
};

/**
 * 비교용 정규화. 글머리표와 앞뒤 장식 기호를 걷어낸다.
 * '▢ 크리스마스 리스 만들기'처럼 제목을 기호와 함께 다시 적어 둔 줄을 걸러내야
 * 프로그램 소개에 제목이 한 번 더 나오지 않는다.
 */
function comparableOf(value: string) {
  return value
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '')
    .replace(/\s+/g, '');
}

function noticeTopicOf(line: string) {
  const compact = line.replace(/\s+/g, '');
  for (const topic of NOTICE_TOPICS) {
    if (topic.keywords.some((keyword) => compact.includes(keyword.replace(/\s+/g, '')))) return topic;
  }
  return null;
}

/** 안내로 옮길 줄인지 판정. 세 조건을 모두 만족해야 한다(사전의 routing.policy 참조). */
function isRoutableNotice(line: string) {
  if (parseLabelLine(line)) return false;
  if (!SENTENCE_END.test(line.trim())) return false;
  return noticeTopicOf(line) !== null;
}

function pushNotice(groups: Map<string, ProgramNoticeGroup>, line: string) {
  const topic = noticeTopicOf(line) ?? NOTICE_FALLBACK;
  const group = groups.get(topic.id) ?? { id: topic.id, title: topic.title, lines: [] };
  if (!group.lines.some((existing) => existing.replace(/\s+/g, '') === line.replace(/\s+/g, ''))) {
    group.lines.push(line);
  }
  groups.set(topic.id, group);
}

export type StructureInput = {
  bodyText: string | null;
  noticeText: string | null;
  title: string;
  /** 기본정보 표에 이미 나온 값들. 본문에서 같은 내용이 반복되면 접는다. */
  basicInfoValues: Array<string | null>;
  /**
   * 교육계획표 셀 텍스트. 표는 표대로 그려지는데 bodyText에도 같은 내용이 평문으로
   * 들어 있어, 걸러내지 않으면 프로그램 소개에 표 전체가 한 번 더 나온다.
   */
  tableTexts?: string[];
};

export function structureProgramContent(input: StructureInput): ProgramBoardContent {
  const items = new Map<SectionId, Array<{ label: string; value: string }>>();
  const intro: string[] = [];
  const unmappedLabels: string[] = [];
  const noticeGroups = new Map<string, ProgramNoticeGroup>();

  const comparableBasics = [input.title, ...input.basicInfoValues]
    .filter(Boolean)
    .map((value) => comparableOf(String(value)));
  const compactTableText = (input.tableTexts ?? []).join('').replace(/\s+/g, '');
  const isInsideTable = (line: string) => {
    const compact = line.replace(/\s+/g, '');
    // 표 셀이 '수 강 / 정 보'처럼 두 줄로 쪼개져 오므로 짧은 조각까지 걸러야 한다.
    return compact.length >= 2 && compactTableText.includes(compact);
  };

  let current: { section: SectionId; label: string; value: string } | null = null;

  for (const original of String(input.bodyText ?? '').split(/\r?\n/)) {
    const line = original.trim();
    if (!line) continue;

    if (isInsideTable(line)) continue;

    const parsed = parseLabelLine(line);
    if (parsed) {
      const hit = lookupLabel(parsed.label);
      if (hit.status === 'mapped') {
        if (DUPLICATE_FIELDS.has(hit.field)) {
          current = null;
          continue;
        }
        const section = FIELD_TO_SECTION.get(hit.field);
        if (section) {
          // 항목명은 원문 표기를 그대로 쓴다. 사전의 필드명으로 바꾸면 원사이트가
          // 쓴 말('공연일시', '접수일시')이 사라져 원문과 대조하기 어려워진다.
          current = { section, label: parsed.rawLabel, value: parsed.value };
          const bucket = items.get(section) ?? [];
          bucket.push({ label: current.label, value: current.value });
          items.set(section, bucket);
          continue;
        }
      }
      if (hit.status === 'unknown') unmappedLabels.push(parsed.label);
    }

    // 라벨 값이 다음 줄로 이어지는 경우(괄호나 하이픈으로 시작)만 앞 항목에 붙인다.
    // 안내 문장도 '- 신청자명은 …'처럼 하이픈으로 시작하므로, 안내로 갈 줄은 빼야
    // 준비물 값 뒤에 신청·폐강 안내가 통째로 딸려 붙지 않는다.
    if (current && /^[（(\-–—→]/.test(line) && !isRoutableNotice(line)) {
      const bucket = items.get(current.section);
      const last = bucket?.[bucket.length - 1];
      if (last) last.value = `${last.value} ${line}`.trim();
      continue;
    }
    current = null;

    if (comparableBasics.includes(comparableOf(line))) continue;
    if (isRoutableNotice(line)) {
      pushNotice(noticeGroups, line);
      continue;
    }
    intro.push(line);
  }

  // 원사이트가 <안내 사항>으로 구분해 둔 부분은 통째로 안내다.
  for (const original of String(input.noticeText ?? '').split(/\r?\n/)) {
    const line = original.trim();
    if (line) pushNotice(noticeGroups, line);
  }

  const sections = SECTION_ORDER.flatMap((id) => {
    const bucket = items.get(id);
    return bucket?.length ? [{ id, title: SECTIONS[id].title, items: bucket }] : [];
  });

  const orderedNotices = [...NOTICE_TOPICS.map((topic) => topic.id), NOTICE_FALLBACK.id]
    .flatMap((id) => (noticeGroups.has(id) ? [noticeGroups.get(id)!] : []));

  return { sections, intro, notices: orderedNotices, unmappedLabels };
}
