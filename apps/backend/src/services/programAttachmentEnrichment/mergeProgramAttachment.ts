import type { NormalizedProgram } from '../programDataNormalization/types';
import type { ProgramBoardContent, ProgramSection } from '../programDataNormalization/contentStructure';

export type AttachmentStructuredContent = {
  labeled: Array<{ label: string; value: string }>;
  curriculum: Array<{ session: number; date: string | null; content: string; note: string | null }>;
};

type MergeInput = {
  program: NormalizedProgram;
  attachment: { name: string; url: string };
  match: { status: string; selectedPages: number[]; score: number; reason: string };
  structured: AttachmentStructuredContent;
};

const LABEL_KIND: Record<string, 'title' | 'target' | 'capacity' | 'instructor' | 'schedule' | 'location' | 'fee' | 'materials' | 'content'> = {
  프로그램명: 'title', 강좌명: 'title', 교육대상: 'target', 대상: 'target', 강사명: 'instructor', '강사 성명': 'instructor', 담당강사: 'instructor',
  교육기간: 'schedule', 운영기간: 'schedule', 교육일시: 'schedule', 교육시간: 'schedule', 운영횟수: 'schedule',
  교육장소: 'location', 재료비: 'fee', 교재비: 'fee', 수강인원: 'capacity', 참여인원: 'capacity',
  교재: 'materials', 준비물: 'materials', '학습자 준비물': 'materials', '강의실 준비': 'materials',
  학습자준비물: 'materials', 강의실준비: 'materials', 프로그램소개: 'content', 강사성명: 'instructor',
  '프로그램 소개': 'content', 교육내용: 'content', 강의목표: 'content', 목표: 'content',
};

function comparable(value: unknown) {
  return String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

function equivalentOrContained(left: unknown, right: unknown) {
  const a = comparable(left);
  const b = comparable(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
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

function standardBasicInfo(program: NormalizedProgram) {
  const period = [program.programStartDate, program.programEndDate].filter(Boolean).join(' ~ ');
  const application = [program.applyStartDate, program.applyEndDate].filter(Boolean).join(' ~ ');
  return [
    { label: '운영 도서관', value: program.libraryName },
    { label: '대상', value: program.targetDetail ?? program.targetGroup },
    { label: '강사', value: program.instructor },
    { label: '모집인원', value: program.capacity == null ? null : `${program.capacity}명` },
    { label: '교육기간', value: period || null },
    { label: '교육시간', value: program.scheduleText },
    { label: '신청기간', value: application || null },
    { label: '온라인 접수 여부', value: program.onlineApplicationStatus },
    { label: '비용', value: program.feeText ?? (program.isFree === true ? '무료' : null) },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));
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
    if (/(?:개관|휴강|변경|취소|환불|신청)/.test(line)) {
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
    target: input.program.targetDetail ?? input.program.targetGroup,
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
    if (kind === 'fee' && /^(?:없음|0원|무료|[-ㅡ—])$/i.test(comparable(item.value))) {
      skippedDuplicates.push(item);
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
      if (equivalentOrContained(basicValue, item.value)) skippedDuplicates.push(item);
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
    addItem(board, sectionId, sectionTitle, item.label, item.value);
    added.push({ section: sectionId, ...item });
  }

  cleanIntro(input.program, board, basicInfoSupplement, discardedNoise, skippedDuplicates);
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

  return {
    schemaVersion: 'program-board-attachment-merge/v1',
    sourceId: input.program.sourceId,
    title: input.program.title,
    basicInfo: [...standardBasicInfo(input.program), ...basicInfoSupplement],
    board,
    curriculum: input.structured.curriculum.map((session) => ({
      session: session.session,
      date: session.date,
      activity: session.content,
      materialsOrNotes: session.note,
    })),
    attachmentEvidence: {
      name: input.attachment.name,
      url: input.attachment.url,
      matchStatus: input.match.status,
      selectedPages: input.match.selectedPages,
      confidence: input.match.score,
      reason: input.match.reason,
    },
    attachments: input.program.attachments,
    mergeAudit: { added, skippedDuplicates, discardedNoise, warnings },
    reviewStatus: warnings.length ? 'MANUAL_REVIEW_REQUIRED' : 'AUTO_REVIEW_CANDIDATE',
  };
}
