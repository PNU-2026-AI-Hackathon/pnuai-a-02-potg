import {
  UNDECIDED,
  emptyStudioPlan,
  generatedStudioPlanFields,
  studioPlanFieldMap,
  type StudioPlan,
  type StudioPlanField,
  type StudioPlanFieldKey,
  type StudioPlanSession,
} from './studio-plan';

/**
 * 기획서를 만들고 고칠 때 LLM에게 보낼 말과, 돌아온 답을 읽는 규칙.
 *
 * 요구하는 JSON 스키마를 손으로 적지 않고 `studioPlanFields`에서 만든다.
 * 항목을 하나 늘렸는데 프롬프트만 그대로면 LLM이 그 항목을 비워 보내고,
 * 그러면 항목 단위 수정이 곧바로 깨진다.
 */

function schemaLineOf(field: StudioPlanField) {
  if (field.kind === 'sessions') {
    return `  "${field.key}": [{ "session": 1, "date": "", "activity": "", "materials": "", "notes": "" }]`;
  }
  return field.kind === 'lines' ? `  "${field.key}": [""]` : `  "${field.key}": ""`;
}

function schemaBlock(fields: StudioPlanField[]) {
  return ['{', fields.map(schemaLineOf).join(',\n'), '}'].join('\n');
}

function fieldGuide(fields: StudioPlanField[]) {
  return fields.map((field) => {
    const factual = field.factual ? ` 근거가 없으면 "${UNDECIDED}"로 적는다.` : '';
    return `- ${field.key} (${field.label}): ${field.hint}.${factual}`;
  }).join('\n');
}

const SHARED_RULES = [
  '- 참고 자료의 문장을 그대로 옮기지 마세요.',
  '- 참고 프로그램의 회차 제목과 만들기 결과물을 그대로 쓰지 말고 요청에 맞게 새로 구성하세요.',
  '- 여러 참고 자료가 있으면 공통 구조만 종합하고 한 프로그램을 복제하지 마세요.',
  '- 참고 프로그램의 날짜와 모집 인원을 그대로 가져오지 마세요.',
  '- 회차 일자는 사서가 정한 기간이 있을 때만 적고, 없으면 비워 두세요.',
];

export type StudioPlanGenerateInput = {
  memo: string;
  conditions: Record<string, string[]>;
  referencesMarkdown?: string;
};

export function buildStudioPlanPrompt(input: StudioPlanGenerateInput) {
  const conditions = Object.entries(input.conditions)
    .filter(([, values]) => values.length)
    .map(([key, values]) => `- ${key}: ${values.join(', ')}`)
    .join('\n') || '- 없음';
  return [
    '당신은 도서관 프로그램 기획서를 쓰는 한국어 보조 AI입니다.',
    '아래 JSON만 반환하세요. 설명 문장이나 코드 블록은 넣지 마세요.',
    '',
    '항목 설명',
    fieldGuide(generatedStudioPlanFields),
    '',
    '작성 규칙',
    ...SHARED_RULES,
    '',
    '기획 메모',
    input.memo.trim() || '- 없음',
    '',
    '사서가 고른 조건',
    conditions,
    '',
    '유사 프로그램 참고 자료',
    input.referencesMarkdown?.trim() || '- 없음',
    '',
    '반환할 JSON 형식',
    schemaBlock(generatedStudioPlanFields),
  ].join('\n');
}

export type StudioPlanReviseInput = {
  /** 고칠 항목 하나. 다른 항목은 보내지 않는다. */
  fieldKey: StudioPlanFieldKey;
  currentValue: unknown;
  instruction: string;
  /**
   * 항목 전체가 아니라 그 안의 일부만 고칠 때 무엇을 고르는지.
   * 사서가 문장을 끌어 고르거나 회차 한 줄을 누른 경우다.
   * 이때는 항목의 원래 모양이 아니라 고른 부분과 같은 모양으로 돌려받아야
   * 제자리에 다시 끼울 수 있다.
   */
  scope?: { label: string };
  /**
   * 이 항목이 어느 프로그램의 것인지 알려 주는 최소한의 말.
   * 참고 사례 Markdown은 다시 보내지 않는다. 이 기능을 둔 목적이 호출 비용을 줄이는 것이다.
   */
  planTitle: string;
  planTarget: string;
};

export function buildStudioPlanRevisePrompt(input: StudioPlanReviseInput) {
  const field = studioPlanFieldMap.get(input.fieldKey);
  if (!field) throw new Error(`unknown studio plan field: ${input.fieldKey}`);
  const partial = Boolean(input.scope);
  return [
    partial
      ? '당신은 도서관 프로그램 기획서의 한 부분만 고치는 한국어 보조 AI입니다.'
      : '당신은 도서관 프로그램 기획서의 한 항목만 고치는 한국어 보조 AI입니다.',
    '아래 JSON만 반환하세요. 요청한 것 하나만 담고 다른 것은 넣지 마세요.',
    '',
    partial
      ? `고칠 곳: ${input.scope?.label} (${field.label} 안)`
      : `고칠 항목: ${field.key} (${field.label}) — ${field.hint}`,
    !partial && field.factual ? `근거가 없으면 "${UNDECIDED}"로 적으세요.` : '',
    partial ? '고른 부분만 고치고 길이와 형식은 크게 바꾸지 마세요.' : '',
    '',
    '이 기획서가 무엇인지',
    `- 프로그램명: ${input.planTitle || '미정'}`,
    `- 대상: ${input.planTarget || '미정'}`,
    '',
    '지금 값',
    typeof input.currentValue === 'string' ? input.currentValue : JSON.stringify(input.currentValue, null, 2),
    '',
    '사서의 수정 요청',
    input.instruction.trim(),
    '',
    '반환할 JSON 형식',
    // 일부만 고칠 때는 고친 글 하나만 돌려받아야 제자리에 다시 끼울 수 있다.
    partial ? '{\n  "value": ""\n}' : schemaBlock([field]),
  ].filter(Boolean).join('\n');
}

// --- 돌아온 답 읽기 ---------------------------------------------------------

function textOf(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function linesOf(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(textOf).filter(Boolean);
}

function sessionsOf(value: unknown): StudioPlanSession[] {
  if (!Array.isArray(value)) return [];
  const rows: StudioPlanSession[] = [];
  for (const [index, row] of value.entries()) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    const activity = textOf(record.activity);
    if (!activity) continue;
    const session = Number(record.session);
    rows.push({
      // 회차 번호가 빠져 오면 순서대로 매긴다. 번호가 없으면 어느 회차를 고칠지 지목할 수 없다.
      session: Number.isInteger(session) && session > 0 ? session : index + 1,
      date: textOf(record.date) || null,
      activity,
      materials: textOf(record.materials) || null,
      notes: textOf(record.notes) || null,
    });
  }
  return rows;
}

export function readPlanField(field: StudioPlanField, value: unknown) {
  if (field.kind === 'sessions') return sessionsOf(value);
  if (field.kind === 'lines') return linesOf(value);
  return textOf(value);
}

/** 생성 결과를 기획서로 읽는다. 못 읽은 항목은 빈 값으로 두고 무엇이 비었는지 함께 돌려준다. */
export function parseStudioPlan(value: unknown): { plan: StudioPlan; missing: StudioPlanFieldKey[] } {
  const plan = emptyStudioPlan();
  const missing: StudioPlanFieldKey[] = [];
  const record = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  for (const field of generatedStudioPlanFields) {
    const read = readPlanField(field, record[field.key]);
    (plan as Record<string, unknown>)[field.key] = read;
    const empty = Array.isArray(read) ? read.length === 0 : !read;
    if (empty) missing.push(field.key);
  }
  return { plan, missing };
}

/** 항목 하나만 고친 결과를 읽는다. */
export function parseStudioPlanField(fieldKey: StudioPlanFieldKey, value: unknown) {
  const field = studioPlanFieldMap.get(fieldKey);
  if (!field) return null;
  const record = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const read = readPlanField(field, record[fieldKey]);
  const empty = Array.isArray(read) ? read.length === 0 : !read;
  return empty ? null : read;
}
