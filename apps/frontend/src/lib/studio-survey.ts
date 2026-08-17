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
  comments: string[];
  actionPoints: string[];
};

export const defaultSurveyResult: StudioSurveyResult = {
  respondents: 96,
  totalTarget: 120,
  satisfaction: 92,
  topChoices: [
    { label: '생활 밀착형 디지털 교육', ratio: 44, count: 42 },
    { label: '주민 참여형 프로그램', ratio: 31, count: 30 },
    { label: '주말/오후 시간대 운영', ratio: 25, count: 24 },
    { label: '혼합형 소그룹 수업', ratio: 18, count: 17 },
  ],
  comments: [
    '기초부터 천천히 배우는 구조가 가장 편안해 보여요.',
    '주말이나 오후 시간대가 참여하기 더 쉬울 것 같아요.',
    '실생활 문제를 함께 해결하는 방식이 실용적입니다.',
  ],
  actionPoints: [
    '기초 디지털 활용 중심의 프로그램 구성 우선 유지',
    '주말 또는 오후 시간대 운영을 우선 검토',
    '소그룹 실습과 주민 참여형 활동 비중 확대',
  ],
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
  const comments = toStringArray(record.comments);
  const actionPoints = toStringArray(record.actionPoints);

  if (respondents <= 0 && totalTarget <= 0 && satisfaction <= 0 && topChoices.length === 0) {
    return null;
  }

  return {
    respondents,
    totalTarget,
    satisfaction,
    topChoices: topChoices.length > 0 ? topChoices : defaultSurveyResult.topChoices,
    comments: comments.length > 0 ? comments : defaultSurveyResult.comments,
    actionPoints: actionPoints.length > 0 ? actionPoints : defaultSurveyResult.actionPoints,
  };
}
