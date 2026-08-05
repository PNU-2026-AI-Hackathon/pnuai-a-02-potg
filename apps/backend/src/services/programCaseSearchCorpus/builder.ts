import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  Confidence,
  CORPUS_BUILDER_VERSION,
  CORPUS_SCHEMA_VERSION,
  GROUPING_BUILDER_VERSION,
  ProgramGroup,
  SearchCorpusRecord,
  SectionSafetyDecision,
  TitleSignals,
} from './types';

type Json = Record<string, any>;
type BuildInputs = {
  programCases: Json[];
  sections: Json[];
  candidates: Json[];
  relationships: Json[];
  exceptions: Json[];
  units: Json[];
  sourceDatasetHash: string;
  representationDatasetHash: string;
};

const FATAL_EXCEPTION_CODES = new Set(['READING_ORDER_UNRESOLVED', 'UNDER_SEGMENTATION_RISK', 'POSSIBLE_FALSE_ATTACHMENT_LINK']);
const CONTACT_PATTERNS = [
  /(?:전화|문의|연락처|담당자|강사)\s*[:：]?\s*[^\n]{0,60}/gi,
  /(?:0\d{1,2}[-.)\s]?\d{3,4}[-.\s]?\d{4})/g,
  /(?:01[016789][-.)\s]?\d{3,4}[-.\s]?\d{4})/g,
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,
  /https?:\/\/\S+/g,
];
const MAX_LEXICAL = 6000;
const MAX_DENSE = 4000;
const MAX_ATTACHMENT = 3000;

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hash(value: unknown): string {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex');
}

export function sanitizeSearchText(value: unknown): string {
  let text = typeof value === 'string' ? value : '';
  for (const pattern of CONTACT_PATTERNS) text = text.replace(pattern, ' ');
  return text.replace(/\[[^\]]*https?[^\]]*\]/gi, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizeTitle(title: string): TitleSignals {
  const occurrenceDateCandidate = title.match(/(?:\d{4}[.-]\s*)?\d{1,2}[./-]\s*\d{1,2}(?:\s*\([^)]*\))?/)?.[0]?.trim() ?? null;
  const timeCandidate = title.match(/(?:오전|오후)?\s*\d{1,2}\s*:\s*\d{2}\s*(?:~|〜|-)\s*(?:오전|오후)?\s*\d{1,2}\s*:\s*\d{2}/)?.[0]?.replace(/\s+/g, '') ?? null;
  const roundMatch = title.match(/(?:^|\s|\()(?<round>\d{1,2})\s*(?:차|회차|타임)(?=\s|\(|\)|$)/);
  const institutionPrefix = title.match(/^\s*\[([^\]]+)\]/)?.[1]?.trim() ?? null;
  const baseTitle = title
    .replace(/^\s*\[[^\]]+\]\s*/, '')
    .replace(/(?:\d{4}[.-]\s*)?\d{1,2}[./-]\s*\d{1,2}(?:\s*\([^)]*\))?/g, ' ')
    .replace(/(?:오전|오후)?\s*\d{1,2}\s*:\s*\d{2}\s*(?:~|〜|-)\s*(?:오전|오후)?\s*\d{1,2}\s*:\s*\d{2}(?:\s*\([^)]*\))?/g, ' ')
    .replace(/(?:^|\s|\()\d{1,2}\s*(?:차|회차|타임)(?=\s|\(|\)|$)/g, ' ')
    .replace(/[\[\](){}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    originalTitle: title,
    baseTitle: baseTitle || title.trim(),
    normalizedBaseTitle: (baseTitle || title).normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]+/g, ''),
    occurrenceDateCandidate,
    timeCandidate,
    roundCandidate: roundMatch?.groups?.round ? Number(roundMatch.groups.round) : null,
    institutionPrefix,
  };
}

function readJsonl(file: string): Json[] {
  if (!fs.existsSync(file)) return [];
  const content = fs.readFileSync(file, 'utf8').trim();
  return content ? content.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)) : [];
}

export function loadBuildInputs(root: string): BuildInputs {
  const sources = path.join(root, 'sources');
  const representation = path.join(root, 'representation');
  const sourceManifest = JSON.parse(fs.readFileSync(path.join(sources, 'manifest.json'), 'utf8'));
  const representationManifest = JSON.parse(fs.readFileSync(path.join(representation, 'manifest.json'), 'utf8'));
  const unitFiles = ['pdf-pages.jsonl', 'pdf-text-items.jsonl', 'ocr-lines.jsonl', 'ocr-blocks.jsonl', 'hwp-structural-units.jsonl'];
  return {
    programCases: readJsonl(path.join(sources, 'program-cases.jsonl')),
    sections: readJsonl(path.join(representation, 'attachment-sections.jsonl')),
    candidates: readJsonl(path.join(representation, 'program-case-candidates.jsonl')),
    relationships: readJsonl(path.join(representation, 'shared-binary-relationships.jsonl')),
    exceptions: readJsonl(path.join(representation, 'representation-exceptions.jsonl')),
    units: unitFiles.flatMap((name) => readJsonl(path.join(representation, name))),
    sourceDatasetHash: sourceManifest.datasetSnapshotHash,
    representationDatasetHash: representationManifest.datasetHash,
  };
}

function coreOf(pc: Json): Json { return pc.core ?? {}; }
function titleOf(pc: Json): string { return String(coreOf(pc).title ?? ''); }

function buildSafety(inputs: BuildInputs): SectionSafetyDecision[] {
  const exceptions = new Map<string, string[]>();
  for (const item of inputs.exceptions) exceptions.set(item.sourceSha256, [...(exceptions.get(item.sourceSha256) ?? []), item.code]);
  const sections = new Map(inputs.sections.map((section) => [section.sectionId, section]));
  return inputs.candidates.map((candidate) => {
    const section = sections.get(candidate.sectionId);
    const sourceExceptions = exceptions.get(candidate.sourceSha256) ?? [];
    const fatal = sourceExceptions.filter((code) => FATAL_EXCEPTION_CODES.has(code));
    let safetyStatus: SectionSafetyDecision['safetyStatus'] = 'CORE_ONLY';
    const reasons: string[] = [];
    if (candidate.status === 'AMBIGUOUS') { safetyStatus = 'MANUAL_REVIEW'; reasons.push('AMBIGUOUS_CANDIDATE'); }
    else if (candidate.status === 'NO_RELIABLE_MATCH' || !candidate.programCaseId) reasons.push('NO_RELIABLE_PROGRAM_CASE_MATCH');
    else if (!section) reasons.push('SECTION_NOT_FOUND');
    else if (candidate.conflicts?.length) { safetyStatus = 'MANUAL_REVIEW'; reasons.push('EVIDENCE_CONFLICT'); }
    else if (fatal.length) { safetyStatus = 'MANUAL_REVIEW'; reasons.push(...fatal); }
    else if (!candidate.titleEvidence?.matched) reasons.push('TITLE_EVIDENCE_INSUFFICIENT');
    else {
      safetyStatus = 'SAFE_FOR_CORPUS';
      reasons.push('CANDIDATE_WITH_TITLE_EVIDENCE', 'NO_FATAL_REPRESENTATION_EXCEPTION');
    }
    const content = {
      sectionId: candidate.sectionId,
      sourceSha256: candidate.sourceSha256,
      programCaseId: candidate.programCaseId ?? null,
      candidateStatus: candidate.status,
      safetyStatus,
      reasons: [...new Set(reasons)].sort(),
      excludedPeripheralBlockRefs: section?.excludedPeripheralBlockRefs ?? [],
      includedUnitRefs: section?.orderedUnitRefs ?? [],
    };
    return { ...content, contentHash: hash(content) };
  }).sort((a, b) => a.sectionId.localeCompare(b.sectionId) || String(a.programCaseId).localeCompare(String(b.programCaseId)));
}

function representativeScore(pc: Json, safeProgramCaseIds: Set<string>): number {
  const core = coreOf(pc);
  return [core.title, core.targetAudience, core.location, core.educationStartDateText, core.educationEndDateText, sanitizeSearchText(core.notices)]
    .filter((v) => typeof v === 'string' && v.trim()).length + (pc.sessions?.length ?? 0) * 2 + (safeProgramCaseIds.has(pc.programCaseId) ? 4 : 0);
}

function buildGroups(inputs: BuildInputs, safety: SectionSafetyDecision[]): ProgramGroup[] {
  const safeIds = new Set(safety.filter((d) => d.safetyStatus === 'SAFE_FOR_CORPUS' && d.programCaseId).map((d) => d.programCaseId!));
  const relationshipByPair = new Map<string, string[]>();
  const relationForId = new Map<string, string[]>();
  for (const rel of inputs.relationships) {
    for (const id of rel.linkedProgramCaseIds ?? []) relationForId.set(id, [...(relationForId.get(id) ?? []), rel.relationshipType]);
    const ids = [...(rel.linkedProgramCaseIds ?? [])].sort();
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) relationshipByPair.set(`${ids[i]}:${ids[j]}`, [rel.relationshipType]);
  }
  const buckets = new Map<string, Json[]>();
  for (const pc of inputs.programCases) {
    const signal = normalizeTitle(titleOf(pc));
    const key = signal.normalizedBaseTitle || `single:${pc.programCaseId}`;
    buckets.set(key, [...(buckets.get(key) ?? []), pc]);
  }
  const result: ProgramGroup[] = [];
  for (const members of buckets.values()) {
    const sorted = [...members].sort((a, b) => a.programCaseId.localeCompare(b.programCaseId));
    const compatible: Json[][] = [];
    for (const pc of sorted) {
      const signals = normalizeTitle(titleOf(pc));
      const current = compatible.find((set) => set.every((member) => {
        if (member.dbIdentity?.sourceType !== pc.dbIdentity?.sourceType) return false;
        const pair = [member.programCaseId, pc.programCaseId].sort().join(':');
        const relation = relationshipByPair.get(pair) ?? [];
        return !relation.some((type) => ['MULTI_PROGRAM_SHARED_DOCUMENT', 'EVENT_OVERVIEW_WITH_ACTIVITY_SLOTS', 'POSSIBLE_FALSE_ATTACHMENT_LINK', 'UNRESOLVED', 'SAME_PROGRAM_DIFFERENT_TARGET'].includes(type))
          && signals.normalizedBaseTitle === normalizeTitle(titleOf(member)).normalizedBaseTitle;
      }));
      if (current) current.push(pc); else compatible.push([pc]);
    }
    for (const set of compatible) {
      const ranked = [...set].sort((a, b) => representativeScore(b, safeIds) - representativeScore(a, safeIds) || a.programCaseId.localeCompare(b.programCaseId));
      const representative = ranked[0];
      const memberIds = set.map((pc) => pc.programCaseId).sort();
      const relationTypes = [...new Set(memberIds.flatMap((id) => relationForId.get(id) ?? []))].sort();
      const audiences = new Map<string, string[]>();
      for (const pc of set) {
        const target = sanitizeSearchText(coreOf(pc).targetAudience) || 'UNKNOWN';
        audiences.set(target, [...(audiences.get(target) ?? []), pc.programCaseId]);
      }
      const groupBase = {
        canonicalTitle: normalizeTitle(titleOf(representative)).baseTitle,
        memberProgramCaseIds: memberIds,
        representativeProgramCaseId: representative.programCaseId,
        representativeReasons: ['MOST_COMPLETE_CORE_FIELDS', ...(safeIds.has(representative.programCaseId) ? ['HAS_SAFE_ATTACHMENT_SECTION'] : []), 'PROGRAM_CASE_ID_TIE_BREAK'],
        relationshipTypes: relationTypes,
        variantCandidates: audiences.size > 1 ? [...audiences.entries()].map(([targetAudience, ids]) => ({ variantKey: hash(targetAudience).slice(0, 16), targetAudience, memberProgramCaseIds: ids.sort() })).sort((a, b) => a.variantKey.localeCompare(b.variantKey)) : [],
        groupConfidence: (set.length > 1 ? 'HIGH' : 'MEDIUM') as Confidence,
        groupReasons: set.length > 1 ? ['NORMALIZED_BASE_TITLE_MATCH', 'DATE_TIME_ROUND_DIFFERENCE_ONLY'] : ['SINGLETON_SAFE_DEFAULT'],
        unresolvedReasons: relationTypes.filter((type) => ['UNRESOLVED', 'POSSIBLE_FALSE_ATTACHMENT_LINK'].includes(type)),
        builderVersion: GROUPING_BUILDER_VERSION,
      };
      const groupId = hash({ memberIds, canonicalTitle: groupBase.canonicalTitle }).slice(0, 32);
      result.push({ groupId, ...groupBase, contentHash: hash({ groupId, ...groupBase }) });
    }
  }
  return result.sort((a, b) => a.groupId.localeCompare(b.groupId));
}

function normalizeMetadata(pc: Json, groupId: string): Record<string, unknown> {
  const core = coreOf(pc);
  const target = sanitizeSearchText(core.targetAudience);
  const age = target.match(/(\d{1,2})\s*(?:~|〜|-)\s*(\d{1,2})\s*세/);
  const grade = target.match(/(\d)\s*(?:~|〜|-)\s*(\d)\s*학년/);
  const groups = [...new Set([/유아/.test(target) ? 'INFANT' : '', /초등|어린이/.test(target) ? 'CHILD' : '', /청소년|중학생|고등학생/.test(target) ? 'YOUTH' : '', /성인|일반/.test(target) ? 'ADULT' : ''].filter(Boolean))];
  return {
    targetAudience: target || null,
    targetAgeGroups: groups,
    ageRangeCandidate: age ? { min: Number(age[1]), max: Number(age[2]) } : null,
    gradeRangeCandidate: grade ? { min: Number(grade[1]), max: Number(grade[2]) } : null,
    familyParticipation: /가족|부모|보호자/.test(target) ? true : null,
    libraryOrInstitution: normalizeTitle(titleOf(pc)).institutionPrefix,
    location: sanitizeSearchText(core.location) || null,
    sessionCount: pc.sessions?.length ? pc.sessions.length : null,
    sessionCountConfidence: pc.sessions?.length ? 'HIGH' : 'UNKNOWN',
    operationTypeCandidates: [],
    sourceConfidence: pc.dbIdentity?.requestSucceeded ? 'HIGH' : 'LOW',
    groupId,
    variantKey: null,
  };
}

function truncate(text: string, limit: number): [string, boolean] { return text.length > limit ? [text.slice(0, limit).trimEnd(), true] : [text, false]; }

function buildCorpus(inputs: BuildInputs, groups: ProgramGroup[], safety: SectionSafetyDecision[], includeAttachments: boolean): SearchCorpusRecord[] {
  const pcById = new Map(inputs.programCases.map((pc) => [pc.programCaseId, pc]));
  const unitText = new Map(inputs.units.map((unit) => [unit.recordId, sanitizeSearchText(unit.text)]));
  const safeByPc = new Map<string, SectionSafetyDecision[]>();
  for (const decision of safety.filter((d) => d.safetyStatus === 'SAFE_FOR_CORPUS' && d.programCaseId)) safeByPc.set(decision.programCaseId!, [...(safeByPc.get(decision.programCaseId!) ?? []), decision]);
  return groups.map((group) => {
    const pc = pcById.get(group.representativeProgramCaseId)!;
    const core = coreOf(pc);
    const metadata = normalizeMetadata(pc, group.groupId);
    const originalTitles = group.memberProgramCaseIds.map((id) => titleOf(pcById.get(id)!)).filter(Boolean).sort();
    const attachmentSections = includeAttachments ? group.memberProgramCaseIds.flatMap((id) => (safeByPc.get(id) ?? []).map((decision) => {
      const raw = decision.includedUnitRefs.map((ref) => unitText.get(ref)).filter(Boolean).join('\n');
      const [text] = truncate(raw, MAX_ATTACHMENT);
      return { sectionId: decision.sectionId, sourceSha256: decision.sourceSha256, text, unitRefs: decision.includedUnitRefs };
    })).filter((item) => item.text) : [];
    const coreDescription = sanitizeSearchText(core.notices);
    const target = String(metadata.targetAudience ?? '');
    const location = String(metadata.location ?? '');
    const attachmentText = attachmentSections.map((s) => s.text).join('\n');
    const lexicalRaw = [
      `프로그램명: ${group.canonicalTitle}`,
      originalTitles.length > 1 ? `원본 제목: ${[...new Set(originalTitles)].join(' / ')}` : '',
      target ? `대상: ${target}` : '',
      metadata.libraryOrInstitution ? `기관: ${metadata.libraryOrInstitution}` : '',
      location ? `장소: ${location}` : '',
      coreDescription ? `핵심 내용: ${coreDescription}` : '',
      attachmentText ? `활동: ${attachmentText}` : '',
      core.educationStartDateText ? `운영 정보: ${core.educationStartDateText}${core.educationEndDateText && core.educationEndDateText !== core.educationStartDateText ? ` ~ ${core.educationEndDateText}` : ''}` : '',
    ].filter(Boolean).join('\n');
    const denseRaw = `${target ? `${target}을 대상으로 하는 ` : ''}${group.canonicalTitle} 프로그램이다.${location ? ` ${location}에서 운영된다.` : ''}${coreDescription ? ` ${coreDescription}` : ''}${attachmentText ? ` 주요 활동은 ${attachmentText}` : ''}`.replace(/\s+/g, ' ').trim();
    const [lexicalText, lexicalTruncated] = truncate(lexicalRaw, MAX_LEXICAL);
    const [denseText, denseTruncated] = truncate(denseRaw, MAX_DENSE);
    const attachmentTruncated = attachmentSections.some((s) => s.text.length >= MAX_ATTACHMENT);
    const base = {
      schemaVersion: CORPUS_SCHEMA_VERSION,
      groupId: group.groupId,
      variantKey: null,
      representativeProgramCaseId: group.representativeProgramCaseId,
      memberProgramCaseIds: group.memberProgramCaseIds,
      canonicalTitle: group.canonicalTitle,
      originalTitles,
      metadata,
      coreFields: {
        targetAudience: target || null,
        location: location || null,
        educationStartDateText: core.educationStartDateText ?? null,
        educationEndDateText: core.educationEndDateText ?? null,
        sessionCount: metadata.sessionCount,
      },
      safeAttachmentSections: attachmentSections,
      lexicalText,
      denseText,
      sourceRefs: group.memberProgramCaseIds.map((id) => `program-case:${id}`),
      provenance: {
        sourceDatasetHash: inputs.sourceDatasetHash,
        representationDatasetHash: inputs.representationDatasetHash,
        attachmentMode: includeAttachments ? 'SAFE_ONLY' : 'CORE_ONLY',
      },
      confidence: group.groupConfidence,
      unresolvedReasons: group.unresolvedReasons,
      truncation: { lexical: lexicalTruncated, dense: denseTruncated, attachment: attachmentTruncated },
      builderVersion: CORPUS_BUILDER_VERSION,
    };
    const corpusId = hash({ groupId: group.groupId, mode: includeAttachments ? 'safe' : 'core' }).slice(0, 32);
    return { corpusId, ...base, contentHash: hash({ corpusId, ...base }) };
  }).sort((a, b) => a.corpusId.localeCompare(b.corpusId));
}

export function buildAll(inputs: BuildInputs) {
  const safety = buildSafety(inputs);
  const groups = buildGroups(inputs, safety);
  const coreCorpus = buildCorpus(inputs, groups, safety, false);
  const safeCorpus = buildCorpus(inputs, groups, safety, true);
  return { groups, safety, coreCorpus, safeCorpus };
}

export function summarize(inputs: BuildInputs, result: ReturnType<typeof buildAll>) {
  const countBy = (values: string[]) => Object.fromEntries([...new Set(values)].sort().map((key) => [key, values.filter((value) => value === key).length]));
  const lengths = (records: SearchCorpusRecord[], field: 'lexicalText' | 'denseText') => {
    const values = records.map((record) => record[field].length).sort((a, b) => a - b);
    return { min: values[0] ?? 0, max: values[values.length - 1] ?? 0, average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0 };
  };
  const deterministic = {
    programGroupsHash: hash(result.groups),
    sectionSafetyDecisionsHash: hash(result.safety),
    coreCorpusHash: hash(result.coreCorpus),
    safeCorpusHash: hash(result.safeCorpus),
  };
  return {
    valid: result.groups.length > 0 && result.coreCorpus.length === result.groups.length && result.safeCorpus.length === result.groups.length,
    databaseWriteCount: 0,
    input: { sourceDatasetHash: inputs.sourceDatasetHash, representationDatasetHash: inputs.representationDatasetHash, programCaseCount: inputs.programCases.length },
    counts: {
      programGroups: result.groups.length,
      singletonGroups: result.groups.filter((g) => g.memberProgramCaseIds.length === 1).length,
      multiMemberGroups: result.groups.filter((g) => g.memberProgramCaseIds.length > 1).length,
      variants: result.groups.reduce((sum, g) => sum + g.variantCandidates.length, 0),
      unresolvedGroups: result.groups.filter((g) => g.unresolvedReasons.length).length,
      coreCorpus: result.coreCorpus.length,
      safeCorpus: result.safeCorpus.length,
      safeAttachmentSections: result.safety.filter((d) => d.safetyStatus === 'SAFE_FOR_CORPUS').length,
    },
    relationshipTypes: countBy(inputs.relationships.map((r) => r.relationshipType)),
    safetyStatuses: countBy(result.safety.map((d) => d.safetyStatus)),
    candidateStatuses: countBy(result.safety.map((d) => d.candidateStatus)),
    documentLengths: { coreLexical: lengths(result.coreCorpus, 'lexicalText'), coreDense: lengths(result.coreCorpus, 'denseText'), safeLexical: lengths(result.safeCorpus, 'lexicalText'), safeDense: lengths(result.safeCorpus, 'denseText') },
    privacyScan: { matches: [...result.coreCorpus, ...result.safeCorpus].filter((r) => CONTACT_PATTERNS.some((p) => { p.lastIndex = 0; return p.test(`${r.lexicalText}\n${r.denseText}`); })).length },
    deterministic,
    datasetHash: hash({ input: { source: inputs.sourceDatasetHash, representation: inputs.representationDatasetHash }, versions: [GROUPING_BUILDER_VERSION, CORPUS_BUILDER_VERSION], deterministic }),
  };
}
