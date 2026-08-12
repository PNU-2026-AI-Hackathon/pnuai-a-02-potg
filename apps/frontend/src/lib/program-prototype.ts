import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type ProgramPrototype = {
  sourceId: number;
  sourceUrl: string;
  title: string;
  libraryName: string | null;
  targetGroup: string | null;
  targetDetail: string | null;
  instructor: string | null;
  capacity: number | null;
  programStartDate: string | null;
  programEndDate: string | null;
  applyStartDate: string | null;
  applyEndDate: string | null;
  scheduleText: string | null;
  description: string | null;
  onlineApplicationStatus: string | null;
  programContent: {
    kind: 'table' | 'image' | 'text' | 'attachment_only' | 'empty';
    text: string;
    tables: Array<{ rows: Array<{ cells: Array<{ text: string; header: boolean; colSpan: number; rowSpan: number }> }> }>;
    images: Array<{ url: string; alt: string }>;
  };
  noticeText: string | null;
  isFree: boolean | null;
  feeText: string | null;
  materialFeeAmount: number | null;
  attachments: Array<{ name: string; url: string }>;
  isExcluded: boolean;
  exclusionReason: string | null;
  normalizationStatus: 'normalized' | 'partial' | 'needs_review' | 'excluded';
  warnings: string[];
  evidence: {
    capacityText: string | null;
    capacityDetailCandidates?: number[];
  };
};

type ReviewFile = {
  sourceVerification?: {
    results: Array<{ sourceId: number; liveUrl: string }>;
  };
  items: Array<{
    selectionReason: string;
    normalized: ProgramPrototype;
  }>;
};

function reviewFileCandidates() {
  const relative = path.join(
    'apps',
    'backend',
    '.local',
    'program-data-normalization',
    'representative-20',
    'representative-20.review.json',
  );

  return [
    path.resolve(process.cwd(), relative),
    path.resolve(process.cwd(), '..', 'backend', '.local', 'program-data-normalization', 'representative-20', 'representative-20.review.json'),
  ];
}

async function readReviewFile() {
  let lastError: unknown;
  for (const candidate of reviewFileCandidates()) {
    try {
      return JSON.parse(await readFile(candidate, 'utf8')) as ReviewFile;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

export async function getProgramPrototypes() {
  const review = await readReviewFile();
  const liveUrlById = new Map(review.sourceVerification?.results.map((result) => [result.sourceId, result.liveUrl]) ?? []);
  return review.items
    .map((item) => ({
      ...item.normalized,
      sourceUrl: liveUrlById.get(item.normalized.sourceId) ?? item.normalized.sourceUrl,
      selectionReason: item.selectionReason,
    }))
    .filter((program) => !program.isExcluded)
    .sort((left, right) => {
      const leftDate = left.programStartDate ?? '';
      const rightDate = right.programStartDate ?? '';
      return rightDate.localeCompare(leftDate) || right.sourceId - left.sourceId;
    });
}

export async function getProgramPrototype(sourceId: number) {
  const programs = await getProgramPrototypes();
  return programs.find((program) => program.sourceId === sourceId) ?? null;
}

export function formatProgramDate(value: string | null) {
  if (!value) return '확인 필요';
  return value.replace(/-/g, '.');
}

export function formatProgramPeriod(start: string | null, end: string | null) {
  if (!start && !end) return '확인 필요';
  if (start === end) return formatProgramDate(start);
  return `${formatProgramDate(start)} ~ ${formatProgramDate(end)}`;
}

export function programCapacityLabel(program: ProgramPrototype) {
  if (program.capacity !== null) return `${program.capacity}명`;
  const listed = program.evidence.capacityText;
  return listed ? `원사이트 ${listed}명 · 확인 필요` : '확인 필요';
}

export function programFeeLabel(program: ProgramPrototype) {
  if (program.isFree === true && program.materialFeeAmount) return `수강료 무료 · 재료비 ${program.materialFeeAmount.toLocaleString('ko-KR')}원`;
  if (program.isFree === true) return '수강료 무료';
  if (program.materialFeeAmount) return `재료비 ${program.materialFeeAmount.toLocaleString('ko-KR')}원`;
  if (program.feeText) return '비용 안내 있음';
  return '비용 정보 없음';
}

type StructuredDescription = {
  operationalDetails: Array<{ label: string; value: string }>;
  contentLines: string[];
  notices: string[];
};

export type ProgramTextSection = {
  id: 'content' | 'operation' | 'application' | 'contact';
  title: string;
  items: Array<{ label: string; value: string }>;
};

export type StructuredProgramText = {
  sections: ProgramTextSection[];
  remainingLines: string[];
  recognizedCount: number;
};

export type NoticeGroup = {
  id: 'location' | 'cost' | 'application' | 'policy' | 'privacy' | 'contact' | 'other';
  title: string;
  lines: string[];
};

const DETAIL_LABELS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^(?:운영)?장소|^강의장소/, label: '장소' },
  { pattern: /^운영방법/, label: '운영방법' },
  { pattern: /^신청방법/, label: '신청방법' },
  { pattern: /^신청일시/, label: '신청일시' },
  { pattern: /^추첨일시/, label: '추첨일시' },
  { pattern: /^추첨장소/, label: '추첨장소' },
  { pattern: /^추첨발표/, label: '추첨발표' },
  { pattern: /^(?:문의|문의사항)/, label: '문의' },
  { pattern: /^소요시간/, label: '소요시간' },
  { pattern: /^(?:선정도서|주제도서)/, label: '도서' },
  { pattern: /^교재/, label: '교재' },
];

const TEXT_FIELD_RULES: Array<{
  pattern: RegExp;
  label: string;
  section: ProgramTextSection['id'];
}> = [
  { pattern: /^(?:프로그램명|강좌명|수업명)$/, label: '프로그램', section: 'content' },
  { pattern: /^(?:선정도서|주제도서|도서명)$/, label: '선정도서', section: 'content' },
  { pattern: /^(?:주제|교육내용|수업내용|활동내용|내용)$/, label: '주요 내용', section: 'content' },
  { pattern: /^(?:준비물|학습자준비물)$/, label: '준비물', section: 'content' },
  { pattern: /^(?:운영기간|교육기간|강의기간|수업기간|운영일시|교육일시|강의일시|수업일시|일시)$/, label: '일시', section: 'operation' },
  { pattern: /^(?:소요시간|수업시간|강의시간)$/, label: '소요시간', section: 'operation' },
  { pattern: /^(?:운영장소|교육장소|강의장소|수업장소|장소)$/, label: '장소', section: 'operation' },
  { pattern: /^(?:운영방법|교육방법|진행방법)$/, label: '운영방법', section: 'operation' },
  { pattern: /^(?:신청|접수|신청일시|접수일시|신청기간|접수기간)$/, label: '신청일시', section: 'application' },
  { pattern: /^(?:신청방법|접수방법)$/, label: '신청방법', section: 'application' },
  { pattern: /^(?:추첨일시|추첨일자)$/, label: '추첨일시', section: 'application' },
  { pattern: /^(?:추첨발표|당첨발표|결과발표)$/, label: '결과발표', section: 'application' },
  { pattern: /^(?:문의|문의사항|문의전화|연락처)$/, label: '문의', section: 'contact' },
];

const SECTION_META: Record<ProgramTextSection['id'], string> = {
  content: '프로그램 소개',
  operation: '운영 정보',
  application: '신청 안내',
  contact: '문의',
};

const BASIC_DUPLICATE_LABEL = /^(?:대상|교육대상|강사|강사명|모집인원|모집정원|정원|수강료|교육비|참가비|재료비|온라인접수여부)$/;

function normalizeFieldLabel(value: string) {
  return value.replace(/[\s·ㆍ]/g, '').replace(/[()（）]/g, '');
}

export function structureProgramText(text: string | null, title: string, duplicateValues: Array<string | null> = []): StructuredProgramText {
  if (!text) return { sections: [], remainingLines: [], recognizedCount: 0 };
  const items: Array<{ section: ProgramTextSection['id']; label: string; value: string }> = [];
  const remainingLines: string[] = [];
  let currentItem: typeof items[number] | null = null;
  let skipContinuation = false;

  for (const original of text.split(/\r?\n/)) {
    const line = original.trim();
    if (!line) continue;
    if (skipContinuation && /^[（(]/.test(line)) continue;
    skipContinuation = false;
    const labeled = line.replace(/^[\s*※★○●■□▢❏◇◆▶▷]+/, '').match(/^(.{1,20}?)\s*[:：]\s*(.*)$/);
    if (labeled) {
      const normalizedLabel = normalizeFieldLabel(labeled[1]);
      if (BASIC_DUPLICATE_LABEL.test(normalizedLabel)) {
        currentItem = null;
        skipContinuation = true;
        continue;
      }
      const rule = TEXT_FIELD_RULES.find((candidate) => candidate.pattern.test(normalizedLabel));
      if (rule) {
        currentItem = { section: rule.section, label: rule.label, value: labeled[2].trim() };
        items.push(currentItem);
        continue;
      }
    }
    const cleaned = cleanDescriptionLine(line);
    if (currentItem && (/^[（(]/.test(cleaned) || /^[-–—→]/.test(cleaned))) {
      currentItem.value = `${currentItem.value} ${cleaned}`.trim();
      continue;
    }
    currentItem = null;
    const comparable = cleaned.replace(/\s+/g, '').replace(/^[-–—]|[-–—]$/g, '');
    const isDuplicate = [title, ...duplicateValues].filter(Boolean).some((value) => {
      const normalized = String(value).replace(/\s+/g, '');
      return comparable === normalized;
    });
    const isDuplicatedBasicField = /^(?:대상|강사|모집인원|교육시간|교육기간|신청기간|온라인접수여부)\s*[:：]/.test(cleaned);
    if (cleaned && !isDuplicate && !isDuplicatedBasicField) remainingLines.push(cleaned);
  }

  const sections = (Object.keys(SECTION_META) as ProgramTextSection['id'][]).flatMap((id) => {
    const sectionItems = items.filter((item) => item.section === id).map(({ label, value }) => ({ label, value }));
    return sectionItems.length ? [{ id, title: SECTION_META[id], items: sectionItems }] : [];
  });
  if (remainingLines.length) {
    const contentSection = sections.find((section) => section.id === 'content');
    const introduction = { label: '소개', value: remainingLines.join('\n') };
    if (contentSection) contentSection.items.push(introduction);
    else sections.unshift({ id: 'content', title: SECTION_META.content, items: [introduction] });
  }
  return { sections, remainingLines: [], recognizedCount: items.length };
}

const NOTICE_GROUP_RULES: Array<{ id: NoticeGroup['id']; title: string; pattern: RegExp }> = [
  { id: 'location', title: '장소·교통 안내', pattern: /장소|주소|주차|교통|도보|찾아오|강의실/ },
  { id: 'cost', title: '비용 안내', pattern: /수강료|재료비|교재비|참가비|입금|계좌|환불|비용/ },
  { id: 'application', title: '신청 유의사항', pattern: /신청자|신청 시|신청시|본인인증|법정대리인|연령|대상 이외|중복신청|휴대폰/ },
  { id: 'policy', title: '취소·운영 안내', pattern: /취소|폐강|대기자|정원|변경|불참|결석|운영될|운영되지/ },
  { id: 'privacy', title: '개인정보·촬영 안내', pattern: /개인정보|사진|촬영|초상권|활용될/ },
  { id: 'contact', title: '문의', pattern: /문의|연락처|☎|\d{2,4}[)-]\d{3,4}-?\d{4}/ },
];

export function groupNoticeLines(text: string | null): NoticeGroup[] {
  if (!text) return [];
  const grouped = new Map<NoticeGroup['id'], NoticeGroup>();
  for (const original of text.split(/\r?\n/)) {
    const line = cleanDescriptionLine(original);
    if (!line) continue;
    const rule = NOTICE_GROUP_RULES.find((candidate) => candidate.pattern.test(line));
    const meta = rule ?? { id: 'other' as const, title: '기타 안내' };
    const group = grouped.get(meta.id) ?? { id: meta.id, title: meta.title, lines: [] };
    group.lines.push(line);
    grouped.set(meta.id, group);
  }
  const order: NoticeGroup['id'][] = ['location', 'cost', 'application', 'policy', 'privacy', 'contact', 'other'];
  return order.flatMap((id) => grouped.has(id) ? [grouped.get(id)!] : []);
}

const DUPLICATED_BASIC_LABELS = /^(?:운영기간|교육기간|접수기간|대상|수강료|재료비)$/;
const NOTICE_PATTERN = /(?:유의|참고|주의|취소|폐강|환불|변경|준비물|주차|개인정보|신청자명|입금|촬영|마스크|중복신청|대기자|반드시|꼭|확인하시어)/;

function cleanDescriptionLine(line: string) {
  return line
    .replace(/^[\s*※★○●■□▢❏]+/, '')
    .replace(/^[-–—]\s*/, '')
    .replace(/\s*[-–—]\s*$/, '')
    .trim();
}

export function structureProgramDescription(description: string | null): StructuredDescription {
  if (!description) return { operationalDetails: [], contentLines: [], notices: [] };

  const operationalDetails: StructuredDescription['operationalDetails'] = [];
  const contentLines: string[] = [];
  const notices: string[] = [];
  let isNoticeSection = false;

  for (const originalLine of description.split(/\r?\n/)) {
    const line = cleanDescriptionLine(originalLine);
    if (!line) continue;
    if (/^<?안내\s*사항>?$/.test(line)) {
      isNoticeSection = true;
      continue;
    }

    const labeled = line.match(/^(.{1,18}?)\s*[:：]\s*(.+)$/);
    if (labeled) {
      const rawLabel = labeled[1].replace(/\s+/g, '');
      const value = labeled[2].trim();
      const known = DETAIL_LABELS.find((item) => item.pattern.test(rawLabel));
      if (known) {
        operationalDetails.push({ label: known.label, value });
        continue;
      }
      if (DUPLICATED_BASIC_LABELS.test(rawLabel)) continue;
    }

    if (isNoticeSection || NOTICE_PATTERN.test(line)) notices.push(line);
    else contentLines.push(line);
  }

  return {
    operationalDetails: operationalDetails.filter((item, index, values) =>
      values.findIndex((candidate) => candidate.label === item.label && candidate.value === item.value) === index),
    contentLines,
    notices,
  };
}
