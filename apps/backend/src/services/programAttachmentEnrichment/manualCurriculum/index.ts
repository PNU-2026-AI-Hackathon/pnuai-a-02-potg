import type { ManualCurriculumEntry } from './types';
import { ENGLISH_PLAY_ENTRIES } from './englishPlay';
import { LIBRARY_COURSE_ENTRIES } from './libraryCourses';
import { SINGLE_SESSION_ENTRIES } from './singleSessionPlans';

export type { ManualCurriculumEntry, ManualCurriculumRow } from './types';

export const MANUAL_CURRICULUM: Record<number, ManualCurriculumEntry> = {
  ...ENGLISH_PLAY_ENTRIES,
  ...LIBRARY_COURSE_ENTRIES,
  ...SINGLE_SESSION_ENTRIES,
};

/** 사람이 채운 회차가 있으면 그것을 쓴다. 없으면 `null`을 돌려 자동 추출을 그대로 둔다. */
export function manualCurriculumFor(sourceId: number): ManualCurriculumEntry | null {
  return MANUAL_CURRICULUM[sourceId] ?? null;
}
