export type StudioAgendaInput = {
  title: string;
  content: string;
  tags: string[];
};

export type StudioGenerateRequest = {
  prompt: string;
  conditions: Record<string, string[]>;
  agenda?: StudioAgendaInput | null;
  referencesMarkdown?: string;
  model?: string;
};

export type StudioReviseRequest = {
  documentId: string;
  selectedText: string;
  instruction: string;
  context?: {
    title?: string;
    before?: string;
    after?: string;
  };
};

export const studioDocumentStages = ['기획 중', '수요조사 중', '수요조사 완료', '기획서 확정'] as const;

export type StudioDocumentStage = (typeof studioDocumentStages)[number];

export type StudioSavedDocument = {
  id: string;
  title: string;
  content: string;
  preview: string;
  stage: StudioDocumentStage;
  category?: string;
  audience?: string;
  period?: string;
  conditions?: Record<string, string[]>;
  agenda?: StudioAgendaInput | null;
  /** 기획서의 항목 구조. 항목 단위로 고치려면 본문 말고 이것이 있어야 한다. */
  plan?: unknown;
  surveyResult?: unknown;
  createdAt: string;
  updatedAt: string;
};

export type StudioDraft = {
  id?: string;
  title: string;
  summary: string;
  target: string;
  duration: string;
  details: string[];
  expectedEffects: string;
  notes: string[];
  content: string;
};

export const studioDraftStorageKey = 'moira-studio-generated-draft';
export const studioGenerateRequestStorageKey = 'moira-studio-generate-request';

export function formatStudioDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const formatter = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return formatter.format(date).replace(/\.$/, '');
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function toBulletText(items: string[], emptyLabel: string) {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : `- ${emptyLabel}`;
}

export function buildStudioDraftContent(draft: Pick<StudioDraft, 'summary' | 'target' | 'duration' | 'details' | 'expectedEffects' | 'notes'>) {
  return [
    '기획 개요',
    draft.summary,
    '',
    '운영 대상',
    draft.target,
    '',
    '운영 기간',
    draft.duration,
    '',
    '세부 운영 내용',
    toBulletText(draft.details, '세부 운영 내용이 없습니다.'),
    '',
    '기대 효과',
    draft.expectedEffects,
    '',
    '참고 사항',
    toBulletText(draft.notes, '추가 참고 사항이 없습니다.'),
  ].join('\n');
}

function getTextValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

export function parseStudioDraft(value: unknown): StudioDraft | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = getTextValue(record.title);
  const summary = getTextValue(record.summary);
  const target = getTextValue(record.target);
  const duration = getTextValue(record.duration);
  const expectedEffects = getTextValue(record.expectedEffects);
  const details = normalizeStringArray(record.details);
  const notes = normalizeStringArray(record.notes);

  if (!title || !summary || !target || !duration || !expectedEffects) {
    return null;
  }

  return {
    title,
    summary,
    target,
    duration,
    details,
    expectedEffects,
    notes,
    content: buildStudioDraftContent({
      summary,
      target,
      duration,
      details,
      expectedEffects,
      notes,
    }),
  };
}

export function parseStudioRevision(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const revisedText = getTextValue(record.revisedText);

  if (!revisedText) {
    return null;
  }

  return {
    revisedText,
  };
}

function formatConditionList(conditions: Record<string, string[]>) {
  const entries = Object.entries(conditions)
    .map(([key, values]) => {
      const cleanedValues = values.map((value) => value.trim()).filter((value) => value.length > 0);

      return cleanedValues.length > 0 ? `- ${key}: ${cleanedValues.join(', ')}` : null;
    })
    .filter((entry): entry is string => entry !== null);

  return entries.length > 0 ? entries.join('\n') : '- 선택된 조건 없음';
}

export function buildStudioPrompt(input: StudioGenerateRequest) {
  const agendaBlock = input.agenda
    ? [
        '참고 의제',
        `- 제목: ${input.agenda.title}`,
        `- 내용: ${input.agenda.content}`,
        `- 태그: ${input.agenda.tags.join(', ') || '없음'}`,
      ].join('\n')
    : '참고 의제\n- 없음';

  return [
    '당신은 도서관 프로그램 기획서를 작성하는 한국어 보조 AI입니다.',
    '반드시 아래 JSON 형식만 반환하고, 설명 문장이나 코드 블록은 포함하지 마세요.',
    '필수 필드: title, summary, target, duration, details, expectedEffects, notes',
    'details와 notes는 문자열 배열이어야 합니다.',
    '내용은 간결하지만 실제 기획안처럼 구체적으로 작성하세요.',
    '기획 메모와 선택 조건, 참고 의제를 반영해 한 번에 쓸 수 있는 초안을 만드세요.',
    '',
    '입력값',
    `- 기획 메모: ${input.prompt}`,
    '선택 조건',
    formatConditionList(input.conditions),
    agendaBlock,
    '',
    '유사 프로그램 참고 자료',
    input.referencesMarkdown?.trim() || '- 없음',
    '',
    '참고 자료 사용 규칙',
    '- 참고 자료에 있는 프로그램 문장을 그대로 복사하지 마세요.',
    '- 참고 프로그램의 회차 제목, 활동명, 만들기 결과물을 그대로 재사용하지 말고 사용자 요청에 맞는 새로운 활동으로 재구성하세요.',
    '- 여러 참고 자료가 있으면 공통 구조만 종합하고 특정 프로그램 하나를 복제하지 마세요.',
    '- 참고 자료에 없는 회차별 내용은 신규 제안임을 notes에 명시하세요.',
    '- 상세도가 낮은 자료보다 회차별 원문이 있는 자료를 우선 참고하세요.',
    '- 사용자가 정하지 않은 모집 인원, 날짜, 예산, 재료비, 운영 지원 여부는 임의로 확정하지 말고 "미정(담당자 확정 필요)"로 작성하세요.',
    '- 참고 프로그램의 기존 날짜와 모집 인원을 새 기획서의 운영 조건으로 복사하지 마세요.',
    '',
    '출력 예시 JSON 스키마',
    '{',
    '  "title": "",',
    '  "summary": "",',
    '  "target": "",',
    '  "duration": "",',
    '  "details": [""],',
    '  "expectedEffects": "",',
    '  "notes": [""]',
    '}',
  ].join('\n');
}

export function buildStudioRevisionPrompt(input: StudioReviseRequest) {
  const title = input.context?.title?.trim() || '제목 없음';
  const before = input.context?.before?.trim() || '없음';
  const after = input.context?.after?.trim() || '없음';

  return [
    '당신은 도서관 프로그램 기획서를 다듬는 한국어 보조 AI입니다.',
    '사용자가 선택한 일부 문장만 수정하세요.',
    '기획서 전체를 다시 작성하지 말고, 선택 원문의 의미와 길이를 크게 벗어나지 않는 수정안을 작성하세요.',
    '사용자의 수정 요청을 반영하되 공공기관 문서에 어울리는 자연스러운 한국어 문장으로 정리하세요.',
    '반드시 아래 JSON 형식만 반환하고, 설명 문장이나 코드 블록은 포함하지 마세요.',
    '',
    '입력값',
    `- 문서 ID: ${input.documentId}`,
    `- 기획서 제목: ${title}`,
    `- 수정 요청: ${input.instruction}`,
    '',
    '선택 원문',
    input.selectedText,
    '',
    '선택 원문 앞 문맥',
    before,
    '',
    '선택 원문 뒤 문맥',
    after,
    '',
    '출력 예시 JSON 스키마',
    '{',
    '  "revisedText": ""',
    '}',
  ].join('\n');
}

export function extractStudioJson(text: string) {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  const startIndex = withoutFence.indexOf('{');
  const endIndex = withoutFence.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error('응답에서 JSON 객체를 찾지 못했습니다.');
  }

  return withoutFence.slice(startIndex, endIndex + 1);
}
