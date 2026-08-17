export type StudioSurveyChoice = {
  label: string;
  ratio: number;
  count: number;
};

export type StudioSurveyResult = {
  respondents: number;
  totalTarget: number;
  satisfaction: number;
  topChoices: StudioSurveyChoice[];
  intentionBreakdown: StudioSurveyChoice[];
  timeSlotBreakdown: StudioSurveyChoice[];
  comments: string[];
  actionPoints: string[];
};

export const defaultSurveyResult: StudioSurveyResult = {
  respondents: 96,
  totalTarget: 120,
  satisfaction: 72,
  topChoices: [
    { label: '꼭 참여하고 싶어요', ratio: 42, count: 40 },
    { label: '일정이 맞으면 참여하고 싶어요', ratio: 31, count: 30 },
    { label: '관심은 있지만 참여는 어려워요', ratio: 18, count: 17 },
    { label: '관심이 없어요', ratio: 9, count: 9 },
  ],
  intentionBreakdown: [
    { label: '꼭 참여하고 싶어요', ratio: 42, count: 40 },
    { label: '일정이 맞으면 참여하고 싶어요', ratio: 31, count: 30 },
    { label: '관심은 있지만 참여는 어려워요', ratio: 18, count: 17 },
    { label: '관심이 없어요', ratio: 9, count: 9 },
  ],
  timeSlotBreakdown: [
    { label: '평일 오전', ratio: 26, count: 25 },
    { label: '평일 오후', ratio: 34, count: 33 },
    { label: '평일 저녁', ratio: 22, count: 21 },
    { label: '주말', ratio: 18, count: 17 },
  ],
  comments: [],
  actionPoints: [],
};

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
}

function toChoiceArray(value: unknown): StudioSurveyChoice[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const choice = item as Record<string, unknown>;
      const label = typeof choice.label === 'string' ? choice.label.trim() : '';

      if (!label) {
        return null;
      }

      return {
        label,
        ratio: toNumber(choice.ratio, 0),
        count: toNumber(choice.count, 0),
      };
    })
    .filter((item): item is StudioSurveyChoice => item !== null);
}

export function normalizeSurveyResult(value: unknown): StudioSurveyResult | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const respondents = toNumber(record.respondents, 0);
  const totalTarget = toNumber(record.totalTarget, 0);
  const satisfaction = toNumber(record.satisfaction, 0);
  const topChoices = toChoiceArray(record.topChoices);
  const intentionBreakdown = toChoiceArray(record.intentionBreakdown);
  const timeSlotBreakdown = toChoiceArray(record.timeSlotBreakdown);
  const comments = toStringArray(record.comments);
  const actionPoints = toStringArray(record.actionPoints);

  if (
    respondents <= 0 &&
    totalTarget <= 0 &&
    satisfaction <= 0 &&
    topChoices.length === 0 &&
    intentionBreakdown.length === 0 &&
    timeSlotBreakdown.length === 0
  ) {
    return null;
  }

  return {
    respondents,
    totalTarget,
    satisfaction,
    topChoices: topChoices.length > 0 ? topChoices : defaultSurveyResult.topChoices,
    intentionBreakdown:
      intentionBreakdown.length > 0 ? intentionBreakdown : defaultSurveyResult.intentionBreakdown,
    timeSlotBreakdown:
      timeSlotBreakdown.length > 0 ? timeSlotBreakdown : defaultSurveyResult.timeSlotBreakdown,
    comments: comments.length > 0 ? comments : defaultSurveyResult.comments,
    actionPoints: actionPoints.length > 0 ? actionPoints : defaultSurveyResult.actionPoints,
  };
}
