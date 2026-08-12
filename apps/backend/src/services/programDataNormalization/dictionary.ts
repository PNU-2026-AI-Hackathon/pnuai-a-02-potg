import labelDictionary from './dictionaries/labels.json';
import libraryDictionary from './dictionaries/libraries.json';

export type LibraryEntry = {
  canonical: string;
  contains: string[];
  segmentEquals: string[];
};

export type LabelField = string;

export const LIBRARY_DICTIONARY_VERSION = libraryDictionary.version;
export const LABEL_DICTIONARY_VERSION = labelDictionary.version;

const LIBRARY_ENTRIES = libraryDictionary.entries as LibraryEntry[];
const NON_LIBRARY_TAGS = new Set(
  (libraryDictionary.nonLibraryTags ?? []).map((item) => normalizeTagText(item.tag)),
);
const LABEL_MAPPINGS = labelDictionary.mappings as Record<string, LabelField>;
const IGNORED_LABELS = new Set((labelDictionary.ignored ?? []).map((item) => item.label));

/**
 * 태그 비교용 정규화.
 * 괄호와 그 안의 내용, 운영 방식('비대면-'), 설립 구분('사립'/'공립')은 도서관 이름이 아니라
 * 수식어이므로 걷어낸다. '금샘마을(사립)'과 '사립 우지'가 같은 규칙으로 처리된다.
 */
export function normalizeTagText(value: string) {
  return String(value ?? '')
    .replace(/\([^)]*\)/g, '')
    .replace(/비대면\s*-\s*/g, '')
    .replace(/(?:^|[/\s])(?:사립|공립)(?=[/\s]|$)/g, ' ')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export type LibraryLookup = {
  canonical: string | null;
  matchedText: string | null;
  /** 도서관이 아니라고 사전에 명시된 태그. 미해결(unknown)과 구분해야 커버리지 보고가 정확해진다. */
  knownNonLibrary: boolean;
};

export function lookupLibrary(tags: string[]): LibraryLookup {
  const joined = normalizeTagText(tags.join('/'));
  if (!joined) return { canonical: null, matchedText: null, knownNonLibrary: false };

  const segments = joined.split('/').filter(Boolean);
  for (const entry of LIBRARY_ENTRIES) {
    if (entry.contains.some((alias) => joined.includes(normalizeTagText(alias)))) {
      return { canonical: entry.canonical, matchedText: joined, knownNonLibrary: false };
    }
    if (entry.segmentEquals.some((alias) => segments.includes(normalizeTagText(alias)))) {
      return { canonical: entry.canonical, matchedText: joined, knownNonLibrary: false };
    }
  }
  return { canonical: null, matchedText: null, knownNonLibrary: NON_LIBRARY_TAGS.has(joined) };
}

/** 라벨 내부 공백 제거. '수 강 료' 처럼 띄어 쓴 표기를 같은 항목으로 본다. */
export function normalizeLabel(value: string) {
  return String(value ?? '').replace(/\s+/g, '');
}

export type LabelLookup =
  | { status: 'mapped'; field: LabelField }
  | { status: 'ignored' }
  | { status: 'unknown' };

export function lookupLabel(rawLabel: string): LabelLookup {
  const label = normalizeLabel(rawLabel);
  if (IGNORED_LABELS.has(label)) return { status: 'ignored' };
  const field = LABEL_MAPPINGS[label];
  return field ? { status: 'mapped', field } : { status: 'unknown' };
}

/**
 * 글머리표를 문자 목록으로 나열하지 않고 '글자가 시작되기 전까지'를 걷어낸다.
 * 원문에는 심볼 폰트용 사설영역(U+F06D 등) 글머리표가 섞여 있어 목록으로는 감당되지 않고,
 * trim()으로도 지워지지 않아 그 줄이 통째로 파싱에서 빠진다.
 */
const LEADING_ORNAMENT = /^[^\p{L}]+/u;
const LABEL_LINE = /^([가-힣A-Za-z][가-힣A-Za-z\s]{0,12}?)\s*[:：]\s*(.*)$/;

/** label은 사전 조회용(공백 제거), rawLabel은 화면에 그대로 쓸 원문 표기. */
export type ParsedLine = { label: string; rawLabel: string; value: string } | null;

export function parseLabelLine(line: string): ParsedLine {
  const match = String(line ?? '').trim().replace(LEADING_ORNAMENT, '').match(LABEL_LINE);
  if (!match) return null;
  return { label: normalizeLabel(match[1]), rawLabel: match[1].trim(), value: match[2].trim() };
}
