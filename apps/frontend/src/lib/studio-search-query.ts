import { studioFields, type StudioConditionKey } from '@/components/studio/studio-options';

/**
 * 스튜디오 조건을 검색과 생성에 나눠 넘긴다.
 *
 * 조건 셋은 쓰이는 곳이 다르다. 대상만 후보를 좁히는 필터로 쓰고, 분야는 사례에
 * 해당 항목이 없어 질의문에 엮어 벡터가 판단하게 한다. 운영 기간은 만들 프로그램의
 * 조건이지 찾을 사례의 조건이 아니라 검색에 넣지 않고 기획안을 생성할 때만 넘긴다.
 *
 * 파일럿 화면과 스튜디오가 같은 함수를 쓰게 두어야, 파일럿에서 확인한 결과가
 * 스튜디오에서도 같게 나온다.
 */

export type StudioConditions = Partial<Record<StudioConditionKey, string[]>>;

function labelOf(key: StudioConditionKey, value: string | undefined) {
  if (!value) return null;
  return studioFields.find((field) => field.key === key)?.options.find((option) => option.value === value)?.label ?? null;
}

/**
 * 기획 메모와 조건을 한 문장으로 엮는다.
 *
 * 대상은 필터로도 쓰지만 질의문에도 넣는다. 벡터가 대상을 함께 보고 순위를 매기면
 * 같은 분야 안에서도 그 대상에 맞는 사례가 위로 온다.
 */
export function buildSearchQuery(memo: string, conditions: StudioConditions) {
  const audience = labelOf('audience', conditions.audience?.[0]);
  const category = labelOf('category', conditions.category?.[0]);
  const prefix = [audience && `${audience} 대상`, category && `${category} 분야`].filter(Boolean).join(' ');
  const body = memo.trim();
  if (!prefix) return body;
  return body ? `${prefix}. ${body}` : prefix;
}

/** 후보를 좁히는 1차 필터 값. 고르지 않았으면 필터를 걸지 않는다. */
export function audienceFilter(conditions: StudioConditions) {
  return conditions.audience?.[0];
}

/** 기획안을 만들 때 LLM이 지켜야 할 조건. 검색에는 쓰지 않는다. */
export function generationConditions(conditions: StudioConditions) {
  return Object.fromEntries(
    (Object.keys(conditions) as StudioConditionKey[])
      .map((key) => [key, (conditions[key] ?? []).map((value) => labelOf(key, value) ?? value)])
      .filter(([, values]) => (values as string[]).length),
  ) as Record<string, string[]>;
}
