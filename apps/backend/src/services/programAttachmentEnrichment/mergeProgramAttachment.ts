import type { NormalizedProgram } from '../programDataNormalization/types';
import type { ProgramBoardContent, ProgramSection } from '../programDataNormalization/contentStructure';

export type AttachmentStructuredContent = {
  labeled: Array<{ label: string; value: string }>;
  curriculum: Array<{ session: number; date: string | null; content: string; note: string | null; category?: string | null; teachingMethod?: string | null; materials?: string | null; referenceImages?: Array<{ filename: string; mimeType: string }> }>;
  embedded?: Array<{
    session: number;
    referenceBooks: string[];
    images: Array<{ filename: string; mimeType: string }>;
  }>;
  extractionWarnings?: Array<{ code: string; message: string }>;
  notices?: string[];
};

type MergeInput = {
  program: NormalizedProgram;
  attachment: { name: string; url: string };
  match: { status: string; selectedPages: number[]; score: number; reason: string };
  structured: AttachmentStructuredContent;
};

const LABEL_KIND: Record<string, 'title' | 'target' | 'capacity' | 'instructor' | 'schedule' | 'location' | 'fee' | 'materials' | 'content' | 'online'> = {
  프로그램명: 'title', 강좌명: 'title', 교육대상: 'target', 대상: 'target', 강사명: 'instructor', '강사 성명': 'instructor', 담당강사: 'instructor',
  교육기간: 'schedule', 운영기간: 'schedule', 교육일시: 'schedule', 교육시간: 'schedule', 운영횟수: 'schedule',
  교육장소: 'location', 재료비: 'fee', 교재비: 'fee', 수강인원: 'capacity', 참여인원: 'capacity',
  교재: 'materials', 준비물: 'materials', '학습자 준비물': 'materials', '강의실 준비': 'materials',
  학습자준비물: 'materials', 강의실준비: 'materials', 프로그램소개: 'content', 강사성명: 'instructor',
  '프로그램 소개': 'content', 교육내용: 'content', 강의목표: 'content', 목표: 'content', 참고자료: 'content',
  '온라인 가능 여부': 'online', 온라인가능여부: 'online',
  // 표가 아니라 번호 붙은 문단으로 적은 계획서에서 나오는 라벨
  '강의 개요': 'content', 강의개요: 'content', '강의 운영 방법': 'content', 강의운영방법: 'content',
  '강의 목표': 'content', '프로그램 개요': 'content', 프로그램개요: 'content',
  // 회차 표 없이 도입·전개·마무리를 한 덩어리로 적은 계획서
  '활동 계획': 'content', 활동계획: 'content',
  // 수강생 모집 홍보문이 글머리표 목록으로 적는 항목
  운영내용: 'content', 프로그램내용: 'content',
  기간: 'schedule', 시간: 'schedule', 운영시간: 'schedule',
  장소: 'location', 운영장소: 'location',
  모집대상: 'target', 신청대상: 'target',
  모집인원: 'capacity',
};

function comparable(value: unknown) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function equivalentOrContained(left: unknown, right: unknown) {
  const a = comparable(left);
  const b = comparable(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function equivalentTarget(left: unknown, right: unknown) {
  return equivalentOrContained(
    String(left ?? '').replace(/초등학생/g, '초등').replace(/중학생/g, '중등').replace(/고등학생/g, '고등'),
    String(right ?? '').replace(/초등학생/g, '초등').replace(/중학생/g, '중등').replace(/고등학생/g, '고등'),
  );
}

function amountsOf(value: unknown) {
  return [...String(value ?? '').matchAll(/([\d,]+)\s*원/g)].map((match) => Number(match[1].replace(/,/g, '')));
}

function cloneBoard(board: ProgramBoardContent): ProgramBoardContent {
  return {
    intro: [...board.intro],
    sections: board.sections.map((section) => ({ ...section, items: section.items.map((item) => ({ ...item })) })),
    notices: board.notices.map((notice) => ({ ...notice, lines: [...notice.lines] })),
    unmappedLabels: [...board.unmappedLabels],
  };
}

function targetDisplay(program: NormalizedProgram) {
  const detail = program.targetDetail ?? '';
  const group = program.targetGroup ?? '';
  const raw = detail && /초등|중등|중학생|고등|고등학생/.test(group) && !/초등|중등|중학생|고등|고등학생/.test(detail)
    ? `${group} ${detail}`
    : detail || group;
  if (/초등/.test(raw)) return raw.replace(/어린이\s*/g, '').replace(/초등(?:학생)?\s*/g, '초등학생 ').replace(/\s+/g, ' ').trim();
  if (/중등|중학생/.test(raw)) return raw.replace(/청소년\s*/g, '').replace(/중등|중학생/g, '중학생').replace(/\s+/g, ' ').trim();
  if (/고등|고등학생/.test(raw)) return raw.replace(/청소년\s*/g, '').replace(/고등|고등학생/g, '고등학생').replace(/\s+/g, ' ').trim();
  return raw || null;
}

function standardBasicInfo(program: NormalizedProgram) {
  const period = [program.programStartDate, program.programEndDate].filter(Boolean).join(' ~ ');
  const application = [program.applyStartDate, program.applyEndDate].filter(Boolean).join(' ~ ');
  return [
    { label: '운영 도서관', value: program.libraryName },
    { label: '대상', value: targetDisplay(program) },
    { label: '강사', value: program.instructor },
    { label: '모집인원', value: program.capacity == null ? null : `${program.capacity}명` },
    { label: '교육기간', value: period || null },
    { label: '교육시간', value: program.scheduleText },
    { label: '신청기간', value: application || null },
    { label: '온라인 접수 여부', value: program.onlineApplicationStatus },
    { label: '비용', value: program.feeText ?? (program.isFree === true ? '무료' : null) },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));
}

/**
 * 첨부 없이 본문만으로 게시하는 레코드도 같은 기본정보 구조를 써야 하므로 내보낸다.
 * 첨부 보강이 없으면 `supplements`는 빈 배열이다.
 */
export function combinedBasicInfo(program: NormalizedProgram, supplements: Array<{ label: string; value: string }>) {
  const result = standardBasicInfo(program);
  for (const supplement of supplements) {
    const canonicalLabel = /^(?:교육기간|운영기간)$/.test(supplement.label) ? '교육기간' : supplement.label;
    const existingIndex = result.findIndex((item) => item.label === canonicalLabel);
    if (existingIndex >= 0) {
      if (supplement.value.length > result[existingIndex].value.length) result[existingIndex] = { label: canonicalLabel, value: supplement.value };
    } else result.push({ label: canonicalLabel, value: supplement.value });
  }
  return result;
}

function cleanIntro(
  program: NormalizedProgram,
  board: ProgramBoardContent,
  basicInfoSupplement: Array<{ label: string; value: string }>,
  discardedNoise: Array<{ label: string; value: string; reason: string }>,
  skippedDuplicates: Array<{ label: string; value: string }>,
) {
  board.intro = board.intro.filter((line) => {
    if (/첨부(?:된)?\s*(?:파일|계획서).*(?:참고|확인)/.test(line)) {
      discardedNoise.push({ label: '본문 안내', value: line, reason: '첨부 내용을 이미 정제했으므로 참고 문구 제거' });
      return false;
    }
    if (/재료비|교재비/.test(line)) {
      const lineAmounts = amountsOf(line);
      const basicAmounts = amountsOf(program.feeText);
      if (lineAmounts.length && lineAmounts.every((amount) => basicAmounts.includes(amount))) {
        skippedDuplicates.push({ label: '비용', value: line });
        return false;
      }
    }
    if (/작은도서관/.test(line) && /(?:운영|장소|센터|층)/.test(line)) {
      basicInfoSupplement.push({ label: '상세 운영장소', value: line.replace(/^[-*•○\s]+/, '') });
      return false;
    }
    if (/(?:개관|휴강|변경|취소|환불|신청|접수|장애인|비대면|대면으로\s*전환|코로나|배부|개별\s*안내)/.test(line)) {
      let notice = board.notices.find((candidate) => candidate.id === 'operation');
      if (!notice) {
        notice = { id: 'operation', title: '운영 안내', lines: [] };
        board.notices.push(notice);
      }
      if (!notice.lines.some((existing) => equivalentOrContained(existing, line))) notice.lines.push(line);
      return false;
    }
    return true;
  });
}

function checkedOnlineAvailability(value: string) {
  if (/[☑✓✔⍔]\s*가능/.test(value)) return '가능';
  if (/[☑✓✔⍔]\s*불가능/.test(value)) return '불가능';
  const compact = comparable(value);
  if (compact === '가능') return '가능';
  if (compact === '불가능') return '불가능';
  return null;
}

function deriveWeeklyDates(program: NormalizedProgram, count: number) {
  if (!program.programStartDate || !program.programEndDate || count < 1) return null;
  const start = new Date(`${program.programStartDate}T00:00:00+09:00`);
  const end = new Date(`${program.programEndDate}T00:00:00+09:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const dates: string[] = [];
  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 7)) {
    dates.push(`${current.getMonth() + 1}월 ${current.getDate()}일`);
  }
  return dates.length === count ? dates : null;
}

function addItem(board: ProgramBoardContent, sectionId: ProgramSection['id'], title: string, label: string, value: string) {
  let section = board.sections.find((candidate) => candidate.id === sectionId);
  if (!section) {
    section = { id: sectionId, title, items: [] };
    board.sections.push(section);
  }
  if (!section.items.some((item) => equivalentOrContained(item.value, value))) section.items.push({ label, value });
}

export function mergeProgramAttachment(input: MergeInput) {
  const board = cloneBoard(input.program.board);
  const warnings: Array<{ code: string; label: string; basicValue: string | null; attachmentValue: string }> = [];
  const skippedDuplicates: Array<{ label: string; value: string }> = [];
  const added: Array<{ section: string; label: string; value: string }> = [];
  const discardedNoise: Array<{ label: string; value: string; reason: string }> = [];
  const basicInfoSupplement: Array<{ label: string; value: string }> = [];
  const basics = {
    title: input.program.title,
    target: targetDisplay(input.program),
    capacity: input.program.capacity,
    instructor: input.program.instructor,
    schedule: [input.program.programStartDate, input.program.programEndDate, input.program.scheduleText].filter(Boolean).join(' '),
    location: input.program.libraryName,
    fee: input.program.feeText ?? (input.program.isFree === true ? '무료' : null),
  };

  for (const item of input.structured.labeled) {
    const kind = LABEL_KIND[item.label] ?? LABEL_KIND[item.label.replace(/\s+/g, '')];
    if (!kind || !item.value.trim()) continue;
    if ((kind === 'materials' && (/^(?:\/|및)\s*재\s*료\s*비/.test(item.value)
      || /^\d+\s/.test(item.value) || /차시\s*세부|강의실\s*준비/.test(item.value)))
      || /^(?:비고|교수방법|세부 교육내용)$/.test(item.value.trim())) {
      discardedNoise.push({ ...item, reason: 'PDF/HWP 표 머리글 또는 병합 셀 잡음' });
      continue;
    }
    if (kind === 'title') {
      if (equivalentOrContained(basics.title, item.value)) skippedDuplicates.push(item);
      else if (input.match.score >= 0.55) {
        addItem(board, 'content', '프로그램 소개', '첨부 표기명', item.value);
        added.push({ section: 'content', label: '첨부 표기명', value: item.value });
      } else warnings.push({ code: 'ATTACHMENT_TITLE_CONFLICT', label: item.label, basicValue: basics.title, attachmentValue: item.value });
      continue;
    }
    if (kind === 'online') {
      const availability = checkedOnlineAvailability(item.value);
      if (availability) {
        basicInfoSupplement.push({ label: '온라인 진행 가능', value: availability });
        added.push({ section: 'basicInfo', label: '온라인 진행 가능', value: availability });
      } else {
        warnings.push({ code: 'ATTACHMENT_ONLINE_STATUS_AMBIGUOUS', label: item.label, basicValue: null, attachmentValue: item.value });
      }
      continue;
    }
    // 줄표만 적힌 재료비·교재비는 `없음`을 뜻한다.
    // `comparable()`은 기호를 지우므로 줄표는 원문 값에서 직접 판정해야 한다.
    if (kind === 'fee' && (/^[-ㅡ—–]+$/.test(item.value.trim()) || /^(?:없음|0원|무료)$/i.test(comparable(item.value)))) {
      const value = /무료/.test(item.value) ? '무료' : '없음';
      if (!basicInfoSupplement.some((candidate) => candidate.label === item.label)) {
        basicInfoSupplement.push({ label: item.label, value });
        added.push({ section: 'basicInfo', label: item.label, value });
      }
      continue;
    }
    if (kind === 'fee') {
      const basicAmounts = amountsOf(basics.fee);
      const attachmentAmounts = amountsOf(item.value);
      if (attachmentAmounts.length && attachmentAmounts.every((amount) => basicAmounts.includes(amount))) skippedDuplicates.push(item);
      else if (!basicAmounts.length || !attachmentAmounts.length) {
        addItem(board, 'operation', '운영 정보', item.label, item.value);
        added.push({ section: 'operation', ...item });
      } else warnings.push({ code: 'ATTACHMENT_FEE_CONFLICT', label: item.label, basicValue: basics.fee, attachmentValue: item.value });
      continue;
    }
    if (kind === 'target' || kind === 'capacity' || kind === 'instructor' || kind === 'schedule' || kind === 'location') {
      const basicValue = basics[kind];
      const comparisonValue = kind === 'target' ? item.value.replace(/\s*\d+\s*명[\s\S]*$/, '').replace(/\s*온라인\s*가능\s*여부[\s\S]*$/, '').trim() : item.value;
      if (kind === 'target' ? equivalentTarget(basicValue, comparisonValue) : equivalentOrContained(basicValue, comparisonValue)) skippedDuplicates.push(item);
      else if (kind === 'schedule' || kind === 'location') {
        if (!basicInfoSupplement.some((candidate) => equivalentOrContained(candidate.value, item.value))) {
          basicInfoSupplement.push(item);
          added.push({ section: 'basicInfo', ...item });
        }
      } else {
        warnings.push({ code: `ATTACHMENT_${kind.toUpperCase()}_CONFLICT`, label: item.label, basicValue: basicValue == null ? null : String(basicValue), attachmentValue: item.value });
      }
      continue;
    }
    const sectionId = kind === 'content' ? 'content' : 'operation';
    const sectionTitle = kind === 'content' ? '프로그램 소개' : '운영 정보';
    const displayItem = item.label === '프로그램소개' ? { ...item, label: '프로그램 소개' } : item;
    addItem(board, sectionId, sectionTitle, displayItem.label, displayItem.value);
    added.push({ section: sectionId, ...displayItem });
  }

  cleanIntro(input.program, board, basicInfoSupplement, discardedNoise, skippedDuplicates);
  for (const line of input.structured.notices ?? []) {
    let notice = board.notices.find((candidate) => candidate.id === 'operation');
    if (!notice) {
      notice = { id: 'operation', title: '운영 안내', lines: [] };
      board.notices.push(notice);
    }
    if (!notice.lines.some((existing) => equivalentOrContained(existing, line))) notice.lines.push(line);
  }
  board.sections = board.sections.flatMap((section) => {
    if (section.id !== 'operation') return [section];
    const basicLabels = /^(?:교육기간|운영기간|교육일시|교육시간|교육장소|장소|운영횟수)$/;
    const remaining = section.items.filter((item) => {
      if (!basicLabels.test(item.label)) return true;
      if (!basicInfoSupplement.some((candidate) => equivalentOrContained(candidate.value, item.value))) {
        basicInfoSupplement.push(item);
      }
      return false;
    });
    return remaining.length ? [{ ...section, title: '준비 사항', items: remaining }] : [];
  });

  const derivedDates = input.structured.curriculum.every((session) => !session.date)
    ? deriveWeeklyDates(input.program, input.structured.curriculum.length)
    : null;
  const embeddedContentResolved = input.structured.embedded?.some((item) => item.referenceBooks.length > 0 || item.images.length > 0) ?? false;

  return {
    schemaVersion: 'program-board-attachment-merge/v1',
    sourceId: input.program.sourceId,
    title: input.program.title,
    basicInfo: combinedBasicInfo(input.program, basicInfoSupplement),
    board,
    curriculum: input.structured.curriculum.map((session, index) => {
      const embedded = input.structured.embedded?.find((candidate) => candidate.session === session.session);
      return {
        session: session.session,
        date: session.date ?? derivedDates?.[index] ?? null,
        activity: session.content,
        category: session.category ?? null,
        teachingMethod: session.teachingMethod ?? null,
        materials: session.materials ?? null,
        notes: session.note ?? null,
        materialsOrNotes: null,
        referenceBooks: embedded?.referenceBooks ?? [],
        referenceImages: [...(embedded?.images ?? []), ...(session.referenceImages ?? [])],
      };
    }),
    attachmentEvidence: {
      name: input.attachment.name,
      url: input.attachment.url,
      matchStatus: input.match.status,
      selectedPages: input.match.selectedPages,
      confidence: input.match.score,
      reason: input.match.reason,
    },
    attachments: input.program.attachments,
    extractionWarnings: (input.structured.extractionWarnings ?? []).filter((warning) => !embeddedContentResolved
      || !['REFERENCE_BOOK_NOT_EXTRACTED', 'HWP_EMBEDDED_CONTENT_REVIEW'].includes(warning.code)),
    mergeAudit: { added, skippedDuplicates, discardedNoise, warnings },
    reviewStatus: warnings.length ? 'MANUAL_REVIEW_REQUIRED' : 'AUTO_REVIEW_CANDIDATE',
  };
}
