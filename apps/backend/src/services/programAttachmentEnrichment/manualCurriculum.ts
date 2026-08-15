/**
 * 사람이 원본을 보고 직접 채운 회차.
 *
 * 계획서 형태가 제각각이라 규칙으로 읽지 못하는 표가 남는다.
 * 그런 몇 건 때문에 규칙을 계속 늘리면 다른 문서가 깨지므로,
 * 읽지 못한 건만 여기에 손으로 적어 둔다.
 *
 * 자동 추출보다 이 값이 우선한다. 사람이 원본을 보고 넣은 것이므로
 * 추출 결과와 다르면 이쪽이 맞다.
 *
 * 채울 때 지키는 것
 * - `session`은 원본 표의 회차 번호를 그대로 쓴다.
 * - `date`는 원본에 적힌 형태를 그대로 옮긴다. 없으면 `null`로 둔다.
 * - `activity`는 줄바꿈을 살려 원본 칸의 줄 구조를 유지한다.
 * - 원본에 없는 내용을 지어내지 않는다.
 */

export type ManualCurriculumRow = {
  session: number;
  date?: string | null;
  activity: string;
  /** 원본 표에 교수방법·준비물·비고 칸이 따로 있으면 그대로 옮긴다. */
  teachingMethod?: string | null;
  materials?: string | null;
  notes?: string | null;
};

export type ManualCurriculumEntry = {
  /** 어느 원본을 보고 넣었는지. 나중에 다시 대조할 때 쓴다. */
  source: string;
  rows: ManualCurriculumRow[];
};

export const MANUAL_CURRICULUM: Record<number, ManualCurriculumEntry> = {
  // 예시. 실제로 채울 때 이 형태로 적는다.
  //
  // 3740: {
  //   source: '제9기 금정 시민 인문 아카데미 포스터 (강의일정 표)',
  //   rows: [
  //     { session: 1, date: '10. 8.(화)', activity: '경제학의 핵심개념과 통화정책 매커니즘\n김영재 교수 (경제학부)' },
  //   ],
  // },
};

/** 사람이 채운 회차가 있으면 그것을 쓴다. 없으면 `null`을 돌려 자동 추출을 그대로 둔다. */
export function manualCurriculumFor(sourceId: number): ManualCurriculumEntry | null {
  return MANUAL_CURRICULUM[sourceId] ?? null;
}
