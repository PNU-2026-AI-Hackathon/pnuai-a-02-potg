/**
 * 사람이 원본을 보고 직접 채운 회차의 자료형.
 *
 * 계획서 형태가 제각각이라 규칙으로 읽지 못하는 표가 남는다.
 * 그런 몇 건 때문에 규칙을 계속 늘리면 다른 문서가 깨지므로,
 * 읽지 못한 건만 손으로 적어 둔다.
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
  /** 원본 표에 교재·단원처럼 회차를 묶는 칸이 있으면 그대로 옮긴다. */
  category?: string | null;
  /** 원본 표에 교수방법·준비물·비고 칸이 따로 있으면 그대로 옮긴다. */
  teachingMethod?: string | null;
  materials?: string | null;
  notes?: string | null;
};

export type ManualCurriculumEntry = {
  /** 어느 원본을 보고 넣었는지. 나중에 다시 대조할 때 쓴다. */
  source: string;
  rows: ManualCurriculumRow[];
  /**
   * 회차표가 정말로 없는 문서다. 사람이 원본을 보고 확인했다.
   * 모집 포스터처럼 회차별 내용이 애초에 실리지 않은 건에 쓴다.
   */
  noCurriculum?: boolean;
  /**
   * 자동으로 읽은 회차는 맞으니 그대로 두고 기본정보·소개만 고친다.
   * 회차 말고 다른 칸이 오염된 건에 쓴다.
   */
  keepCurriculum?: boolean;
  /**
   * 자동 추출이 엉뚱한 값을 넣은 기본정보를 바로잡는다.
   * 표가 통째로 장소 칸에 들어가는 것처럼 값이 명백히 틀렸을 때만 쓴다.
   * 값을 빈 문자열로 두면 그 항목을 지운다. 옆 프로그램에서 딸려 온 값을 뺄 때 쓴다.
   */
  basicInfo?: Array<{ label: string; value: string }>;
  /** 프로그램 내용에 넣을 항목. 목표처럼 자동으로 읽지 못한 것을 채운다. */
  content?: Array<{ label: string; value: string }>;
  /** 준비 사항에 넣거나 뺄 항목. 규칙은 `basicInfo`와 같다. */
  operation?: Array<{ label: string; value: string }>;
};

/**
 * 원본 표의 칸 순서 그대로 적은 줄을 회차로 옮긴다.
 * `[회차, 일자, 묶음, 교수방법, 활동, 비고]` 순서이며 빈 칸은 빈 문자열로 둔다.
 */
export type PlanTuple = [number, string, string, string, string, string];

export function rowsFromTuples(tuples: PlanTuple[]): ManualCurriculumRow[] {
  return tuples.map(([session, date, category, teachingMethod, activity, notes]) => ({
    session,
    date: date || null,
    category: category || null,
    teachingMethod: teachingMethod || null,
    activity,
    notes: notes || null,
  }));
}
