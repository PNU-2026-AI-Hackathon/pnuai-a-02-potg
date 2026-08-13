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
    const kind = LABEL_KIND[item.label];
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
        addItem(board, 'operation', '운영 정보', item.label, item.value);
        added.push({ section: 'operation', ...item });
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

  return {
    schemaVersion: 'program-board-attachment-merge/v1',
    sourceId: input.program.sourceId,
    title: input.program.title,
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
    mergeAudit: { added, skippedDuplicates, discardedNoise, warnings },
    reviewStatus: warnings.length ? 'MANUAL_REVIEW_REQUIRED' : 'AUTO_REVIEW_CANDIDATE',
  };
}
