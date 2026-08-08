export const GROUPING_BUILDER_VERSION = 'program-case-grouping-v1' as const;
export const CORPUS_BUILDER_VERSION = 'program-case-search-corpus-v1' as const;
export const CORPUS_SCHEMA_VERSION = 'program-case-search-corpus/v1' as const;

export type SafetyStatus = 'SAFE_FOR_CORPUS' | 'CORE_ONLY' | 'MANUAL_REVIEW' | 'EXCLUDED';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type TitleSignals = {
  originalTitle: string;
  baseTitle: string;
  normalizedBaseTitle: string;
  occurrenceDateCandidate: string | null;
  timeCandidate: string | null;
  roundCandidate: number | null;
  institutionPrefix: string | null;
};

export type ProgramGroup = {
  groupId: string;
  canonicalTitle: string;
  memberProgramCaseIds: string[];
  representativeProgramCaseId: string;
  representativeReasons: string[];
  relationshipTypes: string[];
  variantCandidates: Array<{ variantKey: string; targetAudience: string; memberProgramCaseIds: string[] }>;
  groupConfidence: Confidence;
  groupReasons: string[];
  unresolvedReasons: string[];
  builderVersion: typeof GROUPING_BUILDER_VERSION;
  contentHash: string;
};

export type SectionSafetyDecision = {
  sectionId: string;
  sourceSha256: string;
  programCaseId: string | null;
  candidateStatus: string;
  safetyStatus: SafetyStatus;
  reasons: string[];
  excludedPeripheralBlockRefs: string[];
  includedUnitRefs: string[];
  contentHash: string;
};

export type SearchCorpusRecord = {
  schemaVersion: typeof CORPUS_SCHEMA_VERSION;
  corpusId: string;
  groupId: string;
  variantKey: string | null;
  representativeProgramCaseId: string;
  memberProgramCaseIds: string[];
  canonicalTitle: string;
  originalTitles: string[];
  metadata: Record<string, unknown>;
  coreFields: Record<string, unknown>;
  safeAttachmentSections: Array<{ sectionId: string; sourceSha256: string; text: string; unitRefs: string[] }>;
  lexicalText: string;
  denseText: string;
  sourceRefs: string[];
  provenance: Record<string, unknown>;
  confidence: Confidence;
  unresolvedReasons: string[];
  truncation: { lexical: boolean; dense: boolean; attachment: boolean };
  builderVersion: typeof CORPUS_BUILDER_VERSION;
  contentHash: string;
};
