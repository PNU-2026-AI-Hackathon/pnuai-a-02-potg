import { LIBRARY_DICTIONARY_VERSION, lookupLabel, lookupLibrary, parseLabelLine } from './dictionary';
import {
  PROGRAM_NORMALIZATION_VERSION,
  type NormalizedProgram,
  type RawProgram,
  type TargetGroup,
} from './types';

const TARGET_GROUPS = new Set<TargetGroup>(['어린이', '초등학생', '중학생', '일반인', '어르신']);

/**
 * 제외 대상 판정. 특정 idx를 하드코딩하지 않고 조건으로 판별해야
 * 앞으로 들어오는 테스트 레코드도 같은 규칙에 걸린다.
 * 351건 실측에서 두 규칙 모두 idx 4201만 잡았고 오탐은 없었다.
 */
const EXCLUSION_RULES: Array<{ reason: string; matches: (raw: RawProgram) => boolean }> = [
  { reason: 'TEST_TITLE', matches: (raw) => /^(?:테스트|test)\s*\d*$/i.test(raw.title.trim()) },
  { reason: 'SCHEDULE_WITHOUT_ANY_DIGIT', matches: (raw) => !/\d/.test(String(raw.basicInfo['교육시간'] ?? '')) },
];

function detectExclusion(raw: RawProgram) {
  const rule = EXCLUSION_RULES.find((candidate) => candidate.matches(raw));
  return { isExcluded: Boolean(rule), exclusionReason: rule?.reason ?? null };
}

/**
 * 제목에 태그가 없을 때의 폴백. 본문의 '장소' 항목에 적힌 도서관명을 사전으로 조회한다.
 * 추측이 아니라 원문에 적힌 이름을 그대로 대조하는 것이므로 정제 원칙에 어긋나지 않는다.
 * 351건 중 태그 없는 22건 가운데 17건이 이 경로로 식별된다.
 */
function libraryFromBody(text: string) {
  for (const line of text.split('\n')) {
    const parsed = parseLabelLine(line);
    if (!parsed) continue;
    const label = lookupLabel(parsed.label);
    if (label.status !== 'mapped' || label.field !== 'location') continue;
    const hit = lookupLibrary([parsed.value]);
    if (hit.canonical) return { canonical: hit.canonical, matchedText: parsed.value };
  }
  return null;
}

function leadingTags(title: string) {
  const tags: string[] = [];
  let remainder = title.trim();
  while (remainder.startsWith('[')) {
    const match = remainder.match(/^\[([^\]]+)\]\s*/);
    if (!match) break;
    tags.push(match[1].trim());
    remainder = remainder.slice(match[0].length);
  }
  return { tags, title: remainder || title.trim() };
}

function targetFromText(value: string | undefined) {
  const text = String(value ?? '').trim();
  const [first, ...rest] = text.split(/\s+/);
  return {
    group: TARGET_GROUPS.has(first as TargetGroup) ? first as TargetGroup : null,
    detail: rest.join(' ') || null,
  };
}

function dateRange(value: string | undefined) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})$/);
  return match ? { start: match[1], end: match[2] } : { start: null, end: null };
}

function feeInformation(detailText: string) {
  const feeLines = detailText.split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /수\s*강\s*료|재\s*료\s*비|교\s*재\s*비|참\s*가\s*비|교육비/.test(line));
  const compactFee = feeLines.join(' ').replace(/\s+/g, '');
  let isFree: boolean | null = null;
  if (/(?:수강료|참가비|교육비)[^.!?。]*무료/.test(compactFee)) isFree = true;
  else if (/(?:수강료|참가비|교육비)[^.!?。]*\d[\d,]*원/.test(compactFee)) isFree = false;

  const materialAmounts = [...compactFee.matchAll(/재료비[^.!?。\d]{0,20}([\d,]+)원/g)]
    .map((match) => Number(match[1].replace(/,/g, '')))
    .filter(Number.isFinite);
  const uniqueAmounts = [...new Set(materialAmounts)];
  return {
    isFree,
    feeText: feeLines.length > 0 ? feeLines.join('\n') : null,
    materialFeeAmount: uniqueAmounts.length === 1 ? uniqueAmounts[0] : null,
    feeLines,
    ambiguousMaterialFee: uniqueAmounts.length > 1,
  };
}

function statusFrom(warnings: string[], excluded: boolean) {
  if (excluded) return 'excluded' as const;
  if (warnings.includes('INVALID_CORE_FIELD') || warnings.includes('CAPACITY_DETAIL_AMBIGUOUS')) return 'needs_review' as const;
  if (warnings.length > 0) return 'partial' as const;
  return 'normalized' as const;
}

export function normalizeProgram(raw: RawProgram): NormalizedProgram {
  const warnings: string[] = [];
  const parsedTitle = leadingTags(raw.title);
  let library = lookupLibrary(parsedTitle.tags);
  let libraryNameSource: 'title_tag' | 'body_location' | null = library.canonical ? 'title_tag' : null;
  if (!library.canonical) {
    const fromBody = libraryFromBody(raw.programContent?.text ?? raw.detailText ?? '');
    if (fromBody) {
      library = { canonical: fromBody.canonical, matchedText: fromBody.matchedText, knownNonLibrary: false };
      libraryNameSource = 'body_location';
    }
  }
  const targetText = raw.basicInfo['대상'];
  const target = targetFromText(targetText);
  const capacityText = raw.basicInfo['모집인원'];
  let capacity = /^\d+$/.test(String(capacityText ?? '').trim()) ? Number(capacityText) : null;
  const capacityDetailCandidates = [...raw.detailText.matchAll(/(?:해당\s*강좌는\s*)?(\d+)명(?:이|을)?\s*(?:수업\s*가능|추첨)|정원\s*(\d+)명/g)]
    .map((match) => Number(match[1] ?? match[2]))
    .filter(Number.isFinite);
  const uniqueDetailCapacities = [...new Set(capacityDetailCandidates)];
  const capacityConflict = capacity !== null && uniqueDetailCapacities.some((candidate) => candidate !== capacity);
  const capacityDetailAmbiguous = uniqueDetailCapacities.length > 1;
  if (capacityConflict && !capacityDetailAmbiguous) capacity = uniqueDetailCapacities[0];
  const programPeriodText = raw.basicInfo['교육기간'];
  const applyPeriodText = raw.basicInfo['신청기간'];
  const programPeriod = dateRange(programPeriodText);
  const applyPeriod = dateRange(applyPeriodText);
  const schedule = String(raw.basicInfo['교육시간'] ?? '').trim();
  const invalidSchedule = !schedule || !/\d/.test(schedule);
  const fees = feeInformation(raw.detailText);
  const { isExcluded, exclusionReason } = detectExclusion(raw);

  // 사전이 '도서관 아님'이라고 명시한 태그는 미해결로 세지 않는다.
  // 그래야 커버리지 보고서의 미해결 목록에 진짜 새로운 태그만 남는다.
  if (!library.canonical && !library.knownNonLibrary) warnings.push('LIBRARY_NAME_UNRESOLVED');
  if (!target.group || !target.detail || capacity === null || !programPeriod.start || !applyPeriod.start || invalidSchedule) warnings.push('INVALID_CORE_FIELD');
  if (capacityConflict && !capacityDetailAmbiguous) warnings.push('CAPACITY_OVERRIDDEN_BY_DETAIL');
  if (capacityDetailAmbiguous) warnings.push('CAPACITY_DETAIL_AMBIGUOUS');
  if (!raw.detailText.trim()) warnings.push('DESCRIPTION_MISSING');
  if (fees.ambiguousMaterialFee) warnings.push('MATERIAL_FEE_AMBIGUOUS');
  if (fees.feeText && fees.isFree === null) warnings.push('TUITION_STATUS_UNKNOWN');

  return {
    normalizationVersion: PROGRAM_NORMALIZATION_VERSION,
    libraryDictionaryVersion: LIBRARY_DICTIONARY_VERSION,
    sourceId: raw.idx,
    sourceUrl: raw.url,
    title: parsedTitle.title,
    libraryName: library.canonical,
    targetGroup: target.group,
    targetDetail: target.detail,
    instructor: String(raw.basicInfo['강사'] ?? '').trim() || null,
    capacity,
    programStartDate: programPeriod.start,
    programEndDate: programPeriod.end,
    applyStartDate: applyPeriod.start,
    applyEndDate: applyPeriod.end,
    scheduleText: invalidSchedule ? null : schedule,
    description: raw.detailText.trim() || null,
    onlineApplicationStatus: raw.onlineApplicationStatus ?? null,
    programContent: raw.programContent ?? {
      kind: raw.detailText.trim() ? 'text' : raw.attachments.length ? 'attachment_only' : 'empty',
      text: raw.detailText.trim(),
      tables: [],
      images: [],
    },
    noticeText: raw.noticeText?.trim() || null,
    isFree: fees.isFree,
    feeText: fees.feeText,
    materialFeeAmount: fees.materialFeeAmount,
    attachments: raw.attachments,
    isExcluded,
    exclusionReason,
    normalizationStatus: statusFrom(warnings, isExcluded),
    warnings,
    evidence: {
      titleTags: parsedTitle.tags,
      libraryMatchedText: library.matchedText,
      libraryNameSource,
      knownNonLibraryTag: library.knownNonLibrary,
      targetText: targetText ?? null,
      capacityText: capacityText ?? null,
      capacityDetailCandidates,
      programPeriodText: programPeriodText ?? null,
      applyPeriodText: applyPeriodText ?? null,
      feeLines: fees.feeLines,
    },
  };
}
