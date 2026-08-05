const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const backend = path.resolve(__dirname, '..');
const sourceRoot = path.join(backend, '.local/program-case-search-v2/sources');
const outputRoot = path.join(backend, '.local/program-case-search-v2/representation');
const stable = (value) => JSON.stringify(value, Object.keys(value).sort());
const hash = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const readJsonl = (name) => fs.readFileSync(path.join(outputRoot, name), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const writeJson = (name, value) => fs.writeFileSync(path.join(outputRoot, name), `${JSON.stringify(value, null, 2)}\n`);
const writeJsonl = (name, values) => fs.writeFileSync(path.join(outputRoot, name), values.map((value) => JSON.stringify(value)).join('\n') + '\n');

const programCases = new Map(fs.readFileSync(path.join(sourceRoot, 'program-cases.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean)
  .map((line) => { const value = JSON.parse(line); return [value.programCaseId, value]; }));
const sources = fs.readdirSync(path.join(sourceRoot, 'sha256')).sort().map((sourceSha256) =>
  JSON.parse(fs.readFileSync(path.join(sourceRoot, 'sha256', sourceSha256, 'manifest.json'), 'utf8')));
const pages = readJsonl('pdf-pages.jsonl'); const fields = readJsonl('ocr-fields.jsonl'); const lines = readJsonl('ocr-lines.jsonl');
const blocks = readJsonl('ocr-blocks.jsonl'); const hwp = readJsonl('hwp-structural-units.jsonl');
const sections = readJsonl('attachment-sections.jsonl'); const candidates = readJsonl('program-case-candidates.jsonl');

function titles(source) { return source.linkedProgramCaseIds.map((id) => programCases.get(id)?.core?.title ?? '').filter(Boolean); }
function relationshipType(source) {
  const values = titles(source); const joined = values.join(' ');
  if (values.length >= 10 && /체험부스|인형극/.test(joined)) return 'EVENT_OVERVIEW_WITH_ACTIVITY_SLOTS';
  if (values.length < 2) return null;
  if (values.every((title) => /\d{1,2}[/.월-]\d{1,2}|\d{1,2}\/\d{1,2}/.test(title))) return 'SAME_PROGRAM_DIFFERENT_DATE';
  if (values.every((title) => /\d{1,2}:\d{2}/.test(title))) return 'SAME_PROGRAM_DIFFERENT_TIME';
  if (values.every((title) => /(?:\d+차|\[\d+차\]|타임)/.test(title))) return 'SAME_PROGRAM_DIFFERENT_ROUND';
  if (values.every((title) => /유아|초등|어린이|성인/.test(title))) return 'SAME_PROGRAM_DIFFERENT_TARGET';
  const prefixes = new Set(values.map((title) => title.replace(/\([^)]*\)|\[[^\]]*\]|\d|\s/g, '').slice(0, 12)));
  return prefixes.size > 1 ? 'MULTI_PROGRAM_SHARED_DOCUMENT' : 'UNRESOLVED';
}

const shared = sources.filter((source) => source.linkedProgramCaseIds.length > 1).map((source) => ({
  sourceSha256: source.sha256, sourceType: source.detectedType, relationshipType: relationshipType(source),
  linkedProgramCaseCount: source.linkedProgramCaseIds.length, linkedAttachmentCount: source.linkedAttachmentIds.length,
  linkedProgramCaseIds: source.linkedProgramCaseIds, linkedAttachmentIds: source.linkedAttachmentIds,
  confidence: relationshipType(source) === 'UNRESOLVED' ? 0.5 : 0.9,
  reasons: ['DISTINCT_PROGRAM_CASE_IDS_SHARE_IDENTICAL_SOURCE_SHA256'],
}));
writeJsonl('shared-binary-relationships.jsonl', shared);

const bySource = (values, sha) => values.filter((value) => value.sourceSha256 === sha);
const exceptions = sources.flatMap((source) => {
  const result = []; const sourceSections = bySource(sections, source.sha256); const sourceCandidates = bySource(candidates, source.sha256);
  if (source.detectedType === 'JPEG' || source.detectedType === 'PNG') {
    const sourceFields = bySource(fields, source.sha256); const sourceBlocks = bySource(blocks, source.sha256);
    if (sourceBlocks.some((block) => ['COLUMN_MAJOR', 'HYBRID_LAYOUT'].includes(block.readingOrder))) result.push('MULTI_COLUMN_LAYOUT');
    if (sourceBlocks.some((block) => block.readingOrder === 'UNRESOLVED')) result.push('READING_ORDER_UNRESOLVED');
    if (sourceFields.some((field) => field.inferConfidence < 0.5)) result.push('LOW_CONFIDENCE_TITLE');
    if (source.linkedProgramCaseIds.length > 1 && sourceSections.length === 1) result.push('UNDER_SEGMENTATION_CANDIDATE');
    if (source.linkedProgramCaseIds.length === 1 && sourceSections.length > 1) result.push('OVER_SEGMENTATION_CANDIDATE');
  } else if (source.detectedType === 'PDF') {
    const sourcePages = bySource(pages, source.sha256);
    if (sourcePages.some((page) => page.ocrCandidate)) result.push('OCR_REQUIRED_PAGE');
    if (sourcePages.length > 1 && source.linkedProgramCaseIds.length > 1) result.push('MULTIPLE_PROGRAMS_ONE_PAGE');
  } else {
    const units = bySource(hwp, source.sha256);
    if (units.some((unit) => unit.kind === 'HWP_TABLE_CELL' && (unit.rowspan > 1 || unit.colspan > 1))) result.push('MERGED_CELL_LAYOUT');
    if (units.some((unit) => unit.kind === 'HWP_TABLE') && source.linkedProgramCaseIds.length > 1) result.push('MULTI_PROGRAM_TABLE');
    if (!units.some((unit) => unit.kind === 'HWP_HEADING_CANDIDATE')) result.push('MISSING_HEADING_STYLE');
  }
  if (sourceCandidates.some((candidate) => candidate.status === 'AMBIGUOUS')) result.push('AMBIGUOUS');
  if (sourceCandidates.some((candidate) => candidate.status === 'NO_RELIABLE_MATCH')) result.push('NO_RELIABLE_MATCH');
  if (source.linkedProgramCaseIds.length > 1 && sourceSections.some((section) => sourceCandidates.filter((candidate) => candidate.sectionId === section.sectionId && candidate.status === 'CANDIDATE').length > 1)) result.push('SECTION_MATCHES_MULTIPLE_PROGRAM_CASES');
  const relation = shared.find((item) => item.sourceSha256 === source.sha256)?.relationshipType;
  if (relation === 'EVENT_OVERVIEW_WITH_ACTIVITY_SLOTS') result.push('ATTACHMENT_IS_EVENT_OVERVIEW');
  return [...new Set(result)].sort().map((code) => ({ sourceSha256: source.sha256, sourceType: source.detectedType, code, status: 'CANDIDATE' }));
});
writeJsonl('representation-exceptions.jsonl', exceptions);

const exceptionMap = new Map(); for (const item of exceptions) { const list = exceptionMap.get(item.sourceSha256) ?? []; list.push(item.code); exceptionMap.set(item.sourceSha256, list); }
const strata = [
  ['MAX_SHARED', (s) => s.linkedProgramCaseIds.length === Math.max(...sources.map((x) => x.linkedProgramCaseIds.length))],
  ['SHARED_IMAGE', (s) => ['JPEG', 'PNG'].includes(s.detectedType) && s.linkedProgramCaseIds.length > 1],
  ['SINGLE_IMAGE', (s) => ['JPEG', 'PNG'].includes(s.detectedType) && s.linkedProgramCaseIds.length === 1],
  ['PDF_OCR_CANDIDATE', (s) => bySource(pages, s.sha256).some((p) => p.ocrCandidate)],
  ['PDF_TEXT', (s) => s.detectedType === 'PDF' && bySource(pages, s.sha256).every((p) => !p.ocrCandidate)],
  ['HWP_TABLE', (s) => s.detectedType === 'HWP' && bySource(hwp, s.sha256).some((u) => u.kind === 'HWP_TABLE')],
  ['HWP_PARAGRAPH', (s) => s.detectedType === 'HWP' && bySource(hwp, s.sha256).some((u) => u.kind === 'HWP_PARAGRAPH')],
  ['AMBIGUOUS', (s) => (exceptionMap.get(s.sha256) ?? []).includes('AMBIGUOUS')],
  ['NO_RELIABLE_MATCH', (s) => (exceptionMap.get(s.sha256) ?? []).includes('NO_RELIABLE_MATCH')],
  ['UNDER_SEGMENTED', (s) => (exceptionMap.get(s.sha256) ?? []).includes('UNDER_SEGMENTATION_CANDIDATE')],
  ['READING_ORDER', (s) => (exceptionMap.get(s.sha256) ?? []).some((c) => c.includes('READING_ORDER'))],
];
const selected = new Map(); for (const [stratum, predicate] of strata) { const source = sources.find(predicate); if (source) { const value = selected.get(source.sha256) ?? { source, strata: [] }; value.strata.push(stratum); selected.set(source.sha256, value); } }
for (const source of sources) { if (selected.size >= 25) break; if (!selected.has(source.sha256)) selected.set(source.sha256, { source, strata: ['DETERMINISTIC_FILL'] }); }
const review = [...selected.values()].map(({ source, strata: sourceStrata }) => {
  const sourceSections = bySource(sections, source.sha256); const sourceCandidates = bySource(candidates, source.sha256); const codes = exceptionMap.get(source.sha256) ?? [];
  let quality = 'GOOD'; if (codes.includes('OVER_SEGMENTATION_CANDIDATE')) quality = 'OVER_SEGMENTED';
  else if (codes.includes('UNDER_SEGMENTATION_CANDIDATE')) quality = 'UNDER_SEGMENTED';
  else if (codes.includes('READING_ORDER_UNRESOLVED')) quality = 'READING_ORDER_ERROR';
  else if (sourceCandidates.every((item) => item.status === 'NO_RELIABLE_MATCH')) quality = 'CANDIDATE_MATCH_WEAK';
  else if (codes.length) quality = 'USABLE_WITH_MINOR_RULES';
  return { sourceSha256: source.sha256, sourceType: source.detectedType, strata: sourceStrata.sort(), linkedProgramCaseCount: source.linkedProgramCaseIds.length,
    unitCounts: { pages: bySource(pages, source.sha256).length, fields: bySource(fields, source.sha256).length, lines: bySource(lines, source.sha256).length,
      blocks: bySource(blocks, source.sha256).length, hwpUnits: bySource(hwp, source.sha256).length }, sectionCount: sourceSections.length,
    candidateStatuses: Object.fromEntries(['CANDIDATE', 'AMBIGUOUS', 'NO_RELIABLE_MATCH'].map((status) => [status, sourceCandidates.filter((item) => item.status === status).length])),
    exceptionCodes: codes, quality, recommendedFollowUp: quality === 'GOOD' ? 'NONE' : 'REVIEW_DERIVED_RULES_WITHOUT_PARSER_RECALL' };
});
writeJsonl('stratified-quality-review.jsonl', review);

const exceptionDistribution = Object.fromEntries([...new Set(exceptions.map((item) => item.code))].sort().map((code) => [code, exceptions.filter((item) => item.code === code).length]));
const relationshipDistribution = Object.fromEntries([...new Set(shared.map((item) => item.relationshipType))].sort().map((type) => [type, shared.filter((item) => item.relationshipType === type).length]));
const report = { analysisVersion: 'attachment-representation-analysis-v1', inputSnapshots: sources.length, sharedBinaryCount: shared.length,
  relationshipDistribution, exceptionDistribution, stratifiedReviewCount: review.length,
  contentHash: hash({ shared, exceptions, review }), databaseWriteCount: 0, externalUrlDownloads: 0, externalApiCalls: 0 };
writeJson('representation-analysis-report.json', report);
console.log(JSON.stringify(report, null, 2));
