export type StudioAgendaInput = {
  title: string;
  content: string;
  tags: string[];
};

export type StudioGenerateRequest = {
  prompt: string;
  conditions: Record<string, string[]>;
  agenda?: StudioAgendaInput | null;
};

export type StudioDocumentStage = '기획 중' | '수요조사 중' | '수요조사 완료' | '기획서 확정';

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
