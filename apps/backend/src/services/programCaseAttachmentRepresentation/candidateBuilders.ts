import { baseRecord, stableHash } from './common';
import {
  BaseRecord, CANDIDATE_BUILDER_VERSION, Evidence, ProgramCaseCandidate, ProgramCaseCandidateSource,
  SECTION_BUILDER_VERSION, SectionCandidate, SourceBinary,
} from './types';

const SECTION_DERIVATION_VERSION = 'attachment-section-candidate-v1';
const MATCH_DERIVATION_VERSION = 'program-case-candidate-score-v1';

type TextUnit = BaseRecord & { text?: string; pageNumber?: number };

function nonEmpty(units: TextUnit[]) { return units.filter((unit) => typeof unit.text === 'string' && unit.text.trim().length > 0); }

export function buildSectionCandidates(source: SourceBinary, inputUnits: TextUnit[]): SectionCandidate[] {
  const contentUnits = nonEmpty(inputUnits).sort((a, b) => a.structuralOrder - b.structuralOrder || a.recordId.localeCompare(b.recordId));
  if (!contentUnits.length) return [];
  let groups: Array<{ units: TextUnit[]; evidence: string[]; confidence: number }>;
  if (source.detectedType === 'PDF') {
    const pageUnits = contentUnits.filter((unit) => unit.kind === 'PDF_PAGE');
    groups = pageUnits.map((unit) => ({ units: [unit], evidence: ['PDF_PAGE_BOUNDARY'], confidence: 1 }));
  } else if (source.detectedType === 'HWP') {
    const structural = contentUnits.filter((unit) => unit.kind === 'HWP_PARAGRAPH' || unit.kind === 'HWP_TABLE');
    const headingRefs = new Set(contentUnits.filter((unit) => unit.kind === 'HWP_HEADING_CANDIDATE' && unit.confidence >= 0.7)
      .flatMap((unit) => unit.inputUnitRefs ?? []));
    if (!headingRefs.size) groups = [{ units: structural, evidence: ['WEAK_BOUNDARY_WHOLE_ATTACHMENT'], confidence: 0.45 }];
    else {
      groups = [];
      let current: TextUnit[] = [];
      for (const unit of structural) {
        if (headingRefs.has(unit.recordId) && current.length) { groups.push({ units: current, evidence: ['HWP_HEADING_CANDIDATE'], confidence: 0.72 }); current = []; }
        current.push(unit);
      }
      if (current.length) groups.push({ units: current, evidence: ['HWP_HEADING_CANDIDATE'], confidence: 0.72 });
    }
  } else {
    const blocks = contentUnits.filter((unit) => unit.kind === 'DERIVED_OCR_BLOCK');
    groups = blocks.length > 1
      ? blocks.map((unit) => ({ units: [unit], evidence: ['OCR_BLOCK_SPATIAL_GAP'], confidence: unit.confidence * 0.8 }))
      : [{ units: blocks.length ? blocks : contentUnits.filter((unit) => unit.kind === 'DERIVED_OCR_LINE'), evidence: ['WEAK_BOUNDARY_WHOLE_ATTACHMENT'], confidence: 0.45 }];
  }
  return groups.filter((group) => nonEmpty(group.units).length > 0).map((group, index) => {
    const orderedUnitRefs = group.units.map((unit) => unit.recordId);
    const boundaryEvidence = group.evidence;
    const sectionId = stableHash({ sourceSha256: source.sourceSha256, builder: SECTION_BUILDER_VERSION, index, orderedUnitRefs });
    const content = { sectionId, orderedUnitRefs, boundaryEvidence, sectionBuilderVersion: SECTION_BUILDER_VERSION };
    return { ...baseRecord({ source, kind: 'ATTACHMENT_SECTION_CANDIDATE', origin: 'DERIVED', parser: 'SECTION_BUILDER',
      parserVersion: SECTION_BUILDER_VERSION, structuralOrder: index, structuralPosition: `section:${index}`, content,
      confidence: group.confidence, unresolvedReasons: group.confidence < 0.6 ? ['SECTION_BOUNDARY_WEAK'] : [],
      derivationRule: boundaryEvidence.join('+'), derivationVersion: SECTION_DERIVATION_VERSION, inputUnitRefs: orderedUnitRefs }), ...content } as SectionCandidate;
  });
}

function comparable(value: string) { return value.normalize('NFC').replace(/\s+/g, ' ').trim(); }
function tokens(value: string) { return [...new Set(comparable(value).split(/[^0-9A-Za-z가-힣]+/).filter((token) => token.length >= 2))].sort(); }
function evidence(sectionText: string, value: string, weight: number, name: string): Evidence {
  const expected = comparable(value);
  if (!expected) return { matched: false, score: 0, reasons: [`${name}_UNAVAILABLE`] };
  if (comparable(sectionText).includes(expected)) return { matched: true, score: weight, reasons: [`${name}_EXACT_SUBSTRING`] };
  const expectedTokens = tokens(expected); const sectionTokens = new Set(tokens(sectionText));
  const matches = expectedTokens.filter((token) => sectionTokens.has(token));
  const ratio = expectedTokens.length ? matches.length / expectedTokens.length : 0;
  return { matched: ratio >= 0.5, score: weight * ratio, reasons: matches.length ? [`${name}_TOKEN_OVERLAP:${matches.length}/${expectedTokens.length}`] : [`${name}_NO_MATCH`] };
}

export function buildProgramCaseCandidates(input: {
  source: SourceBinary; sections: SectionCandidate[]; units: TextUnit[]; programCases: Map<string, ProgramCaseCandidateSource>;
}) {
  const unitMap = new Map(input.units.map((unit) => [unit.recordId, unit]));
  const records: ProgramCaseCandidate[] = [];
  for (const section of input.sections) {
    const sectionText = section.orderedUnitRefs.map((ref) => unitMap.get(ref)?.text ?? '').filter(Boolean).join('\n');
    const scored = input.source.linkedProgramCaseIds.map((programCaseId) => {
      const program = input.programCases.get(programCaseId);
      if (!program) return null;
      const titleEvidence = evidence(sectionText, program.title, 0.4, 'TITLE');
      const targetEvidence = evidence(sectionText, program.targetAudience, 0.15, 'TARGET');
      const dateValue = [program.educationStartDateText, program.educationEndDateText].filter(Boolean).join(' ');
      const dateEvidence = evidence(sectionText, dateValue, 0.2, 'DATE');
      const locationEvidence = evidence(sectionText, program.location, 0.15, 'LOCATION');
      const keywordValue = tokens(program.title).join(' ');
      const keywordEvidence = evidence(sectionText, keywordValue, 0.1, 'KEYWORD');
      const totalConfidence = Math.min(1, titleEvidence.score + targetEvidence.score + dateEvidence.score + locationEvidence.score + keywordEvidence.score);
      return { program, titleEvidence, targetEvidence, dateEvidence, locationEvidence, keywordEvidence, totalConfidence };
    }).filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.totalConfidence - a.totalConfidence || a.program.programCaseId.localeCompare(b.program.programCaseId));
    const reliable = scored.filter((item) => item.totalConfidence >= 0.35);
    if (!reliable.length) {
      const content = { sectionId: section.sectionId, programCaseId: null, status: 'NO_RELIABLE_MATCH' as const,
        titleEvidence: emptyEvidence('BELOW_THRESHOLD'), targetEvidence: emptyEvidence('BELOW_THRESHOLD'), dateEvidence: emptyEvidence('BELOW_THRESHOLD'),
        locationEvidence: emptyEvidence('BELOW_THRESHOLD'), keywordEvidence: emptyEvidence('BELOW_THRESHOLD'), totalConfidence: 0,
        reasons: ['NO_SCORE_AT_OR_ABOVE_0.35'], conflicts: [] as string[] };
      records.push(candidateRecord(input.source, section, records.length, content));
      continue;
    }
    const top = reliable[0].totalConfidence; const ambiguous = reliable.filter((item) => Math.abs(item.totalConfidence - top) < 0.05).length > 1;
    for (const item of reliable) {
      const content = { sectionId: section.sectionId, programCaseId: item.program.programCaseId,
        status: ambiguous && Math.abs(item.totalConfidence - top) < 0.05 ? 'AMBIGUOUS' as const : 'CANDIDATE' as const,
        titleEvidence: item.titleEvidence, targetEvidence: item.targetEvidence, dateEvidence: item.dateEvidence,
        locationEvidence: item.locationEvidence, keywordEvidence: item.keywordEvidence, totalConfidence: item.totalConfidence,
        reasons: [item.titleEvidence, item.targetEvidence, item.dateEvidence, item.locationEvidence, item.keywordEvidence].flatMap((value) => value.reasons),
        conflicts: ambiguous ? ['TOP_SCORE_WITHIN_0.05'] : [] };
      records.push(candidateRecord(input.source, section, records.length, content));
    }
  }
  return records;
}

function emptyEvidence(reason: string): Evidence { return { matched: false, score: 0, reasons: [reason] }; }
function candidateRecord(source: SourceBinary, section: SectionCandidate, order: number,
  content: Omit<ProgramCaseCandidate, keyof BaseRecord | 'kind'>) {
  return { ...baseRecord({ source, kind: 'PROGRAM_CASE_CANDIDATE', origin: 'DERIVED', parser: 'PROGRAM_CASE_CANDIDATE_BUILDER',
    parserVersion: CANDIDATE_BUILDER_VERSION, structuralOrder: order, structuralPosition: `section:${section.sectionId}:candidate:${content.programCaseId ?? 'none'}`,
    content, confidence: content.totalConfidence, derivationRule: 'EXPLAINABLE_FIELD_EVIDENCE_SCORE',
    derivationVersion: MATCH_DERIVATION_VERSION, inputUnitRefs: [section.recordId, ...section.orderedUnitRefs] }), ...content } as ProgramCaseCandidate;
}
