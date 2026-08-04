export const REPRESENTATION_SCHEMA_VERSION = 'program-case-attachment-representation/v1' as const;
export const REPRESENTATION_VERSION = 'attachment-representation-v1' as const;
export const SECTION_BUILDER_VERSION = 'attachment-section-candidate-v1' as const;
export const CANDIDATE_BUILDER_VERSION = 'program-case-candidate-v1' as const;

export type RepresentationOrigin = 'PARSER_NATIVE' | 'DERIVED';
export type SourceType = 'PDF' | 'JPEG' | 'PNG' | 'HWP';

export type Provenance = {
  sourceSha256: string;
  binarySnapshotRef: string;
  parser: string;
  parserVersion: string;
  representationVersion: typeof REPRESENTATION_VERSION;
};

export type BaseRecord = {
  schemaVersion: typeof REPRESENTATION_SCHEMA_VERSION;
  representationVersion: typeof REPRESENTATION_VERSION;
  recordId: string;
  kind: string;
  origin: RepresentationOrigin;
  sourceSha256: string;
  binarySnapshotRef: string;
  parser: string;
  parserVersion: string;
  structuralOrder: number;
  contentHash: string;
  confidence: number;
  unresolvedReasons: string[];
  derivationRule?: string;
  derivationVersion?: string;
  inputUnitRefs?: string[];
};

export type PdfTextItem = BaseRecord & {
  kind: 'PDFJS_TEXT_ITEM';
  pageNumber: number;
  itemOrder: number;
  text: string;
  hasEol: boolean;
  transform: number[] | null;
  width: number | null;
  height: number | null;
  fontName: string | null;
};

export type PdfPage = BaseRecord & {
  kind: 'PDF_PAGE';
  pageNumber: number;
  pageHash: string;
  text: string;
  characterCount: number;
  nonWhitespaceCharacterCount: number;
  hangulCharacterCount: number;
  latinCharacterCount: number;
  digitCharacterCount: number;
  replacementCharacterCount: number;
  pageType: 'TEXT' | 'LOW_DENSITY' | 'OCR_CANDIDATE';
  ocrCandidate: boolean;
  textItemRefs: string[];
};

export type OcrField = BaseRecord & {
  kind: 'CLOVA_OCR_FIELD';
  fieldOrder: number;
  inferText: string;
  inferConfidence: number;
  boundingPoly: Array<{ x: number; y: number }>;
  lineBreak: boolean | null;
  requestFormatVersion: string;
  responseFormatVersion: string;
  ocrEngine: string;
  ocrEngineVersion: string;
  imageWidth: number;
  imageHeight: number;
  imageOrientation: number | null;
  safeResponseArtifactHash: string;
};

export type OcrLine = BaseRecord & {
  kind: 'DERIVED_OCR_LINE';
  fieldRefs: string[];
  text: string;
  boundingPoly: Array<{ x: number; y: number }>;
};

export type OcrBlock = BaseRecord & {
  kind: 'DERIVED_OCR_BLOCK';
  lineRefs: string[];
  text: string;
  boundingPoly: Array<{ x: number; y: number }>;
  role: 'PROGRAM_CONTENT' | 'TITLE_CANDIDATE' | 'PROGRAM_METADATA' | 'TABLE_OR_GRID' | 'HEADER_OR_BRANDING' | 'CONTACT_OR_FOOTER' | 'ADMINISTRATIVE_NOTICE' | 'UNKNOWN';
  roleConfidence: number;
  roleEvidence: string[];
  roleClassifierVersion: string;
  readingOrder: 'COLUMN_MAJOR' | 'ROW_MAJOR' | 'HYBRID_LAYOUT' | 'UNRESOLVED';
};

export type HwpStructuralUnit = BaseRecord & {
  kind: 'HWP_PARAGRAPH' | 'HWP_TABLE' | 'HWP_TABLE_ROW' | 'HWP_TABLE_CELL' | 'HWP_HEADING_CANDIDATE';
  text: string;
  parentRef: string | null;
  rowIndex: number | null;
  cellIndex: number | null;
  rowspan: number | null;
  colspan: number | null;
  evidence: string[];
};

export type SectionCandidate = BaseRecord & {
  kind: 'ATTACHMENT_SECTION_CANDIDATE';
  sectionId: string;
  orderedUnitRefs: string[];
  includedBlockRefs: string[];
  excludedPeripheralBlockRefs: string[];
  sectionType: 'WHOLE_DOCUMENT' | 'PROGRAM_REGION' | 'PAGE_REGION' | 'STRUCTURAL_REGION';
  boundaryEvidence: string[];
  sectionBuilderVersion: typeof SECTION_BUILDER_VERSION;
};

export type Evidence = { matched: boolean; score: number; reasons: string[] };
export type ProgramCaseCandidate = BaseRecord & {
  kind: 'PROGRAM_CASE_CANDIDATE';
  sectionId: string;
  programCaseId: string | null;
  status: 'CANDIDATE' | 'AMBIGUOUS' | 'NO_RELIABLE_MATCH';
  titleEvidence: Evidence;
  targetEvidence: Evidence;
  dateEvidence: Evidence;
  locationEvidence: Evidence;
  keywordEvidence: Evidence;
  totalConfidence: number;
  reasons: string[];
  conflicts: string[];
};

export type SourceBinary = {
  sourceSha256: string;
  binarySnapshotRef: string;
  absolutePath: string;
  detectedType: SourceType;
  mimeType: string;
  linkedAttachmentIds: string[];
  linkedProgramCaseIds: string[];
};

export type ProgramCaseCandidateSource = {
  programCaseId: string;
  title: string;
  targetAudience: string;
  educationStartDateText: string;
  educationEndDateText: string;
  location: string;
};
