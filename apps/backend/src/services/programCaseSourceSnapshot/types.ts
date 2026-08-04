export const PROGRAM_CASE_SOURCE_SCHEMA_VERSION = 'program-case-source/v1' as const;
export const PROGRAM_CASE_SOURCE_BUILDER_VERSION = 'program-case-source-snapshot-v1' as const;

export type SnapshotStatus =
  | 'NOT_BUILT'
  | 'VERIFIED'
  | 'REUSED_VERIFIED'
  | 'DOWNLOAD_FAILED'
  | 'EMPTY_RESPONSE'
  | 'HASH_MISMATCH'
  | 'TYPE_DETECTION_FAILED';

export type UnresolvedReason =
  | 'CRAWLER_HTML_SNAPSHOT_UNAVAILABLE'
  | 'CRAWLER_PARSER_VERSION_UNAVAILABLE'
  | 'SOURCE_SPAN_UNAVAILABLE'
  | 'SESSION_REGEX_DERIVED'
  | 'ATTACHMENT_BINARY_NOT_SNAPSHOTTED'
  | 'ATTACHMENT_HASH_MISMATCH'
  | 'ATTACHMENT_DOWNLOAD_FAILED'
  | 'OCR_BLOCKS_UNAVAILABLE'
  | 'OCR_BOUNDING_BOXES_UNAVAILABLE'
  | 'OCR_CONFIDENCE_UNAVAILABLE'
  | 'PDF_PAGE_STRUCTURE_UNAVAILABLE'
  | 'HWP_PARAGRAPH_STRUCTURE_UNAVAILABLE';

export type Provenance = {
  source: 'CRAWLER_FINAL_DTO' | 'PROGRAM_CASE_DB' | 'ATTACHMENT_DOWNLOAD' | 'PARSER_DERIVED_DB';
  sourceRef: string;
  parserVersion: string | null;
  lossy: boolean;
  unresolvedReasons: UnresolvedReason[];
};

export type CrawlerSourceRecord = {
  crawlerSourceRef: string;
  crawlerRecordHash: string;
  sourceType: string;
  sourcePostId: string;
  sourceUrl: string;
  record: Record<string, unknown>;
  provenance: Provenance;
};

export type DbSourceIdentity = {
  programCaseId: string;
  sourceType: string;
  sourcePostId: string;
  sourceUrl: string;
  crawledAt: string;
  requestSucceeded: boolean;
  parseWarnings: unknown;
};

export type FlattenedRepresentation = {
  kind: 'PROGRAM_CASE_RAW_TEXT' | 'PROGRAM_CASE_NOTICES' | 'ATTACHMENT_RAW_TEXT' | 'ATTACHMENT_CLEANED_TEXT';
  value: string | null;
  contentSha256: string | null;
  lossy: true;
  provenance: Provenance;
};

export type CanonicalSessionSource = {
  sessionId: string;
  sessionNumber: number;
  sessionDate: string | null;
  dateText: string;
  activity: string;
  sortOrder: number;
  provenance: Provenance;
};

export type AttachmentSourceMetadata = {
  attachmentId: string;
  programCaseId: string;
  attachmentSourceUrl: string;
  fileName: string;
  declaredType: string | null;
  dbDetectedType: string | null;
  dbMimeType: string | null;
  dbByteSize: number | null;
  sourceSha256: string | null;
  extractionStatus: string;
  extractorType: string | null;
  extractorVersion: string | null;
  flattenedRepresentations: FlattenedRepresentation[];
  snapshot: VerifiedBinarySnapshot;
  provenance: Provenance;
};

export type VerifiedBinarySnapshot = {
  attachmentId: string;
  programCaseId: string;
  attachmentSourceUrl: string;
  sourceSha256: string | null;
  downloadedSha256: string | null;
  binarySnapshotRef: string | null;
  httpSucceeded: boolean;
  nonEmptyResponse: boolean;
  byteSize: number | null;
  declaredType: string | null;
  detectedType: string | null;
  mimeType: string | null;
  snapshotStatus: SnapshotStatus;
  linkedAttachmentIds: string[];
  linkedProgramCaseIds: string[];
  lossy: false;
  unresolvedReasons: UnresolvedReason[];
  failureCode: string | null;
};

export type ProgramCaseSourceRecordContent = {
  schemaVersion: typeof PROGRAM_CASE_SOURCE_SCHEMA_VERSION;
  builderVersion: typeof PROGRAM_CASE_SOURCE_BUILDER_VERSION;
  programCaseId: string;
  crawler: CrawlerSourceRecord;
  dbIdentity: DbSourceIdentity;
  core: Record<string, unknown>;
  sessions: CanonicalSessionSource[];
  attachments: AttachmentSourceMetadata[];
  unresolvedReasons: UnresolvedReason[];
};

export type ProgramCaseSourceRecord = ProgramCaseSourceRecordContent & {
  recordHash: string;
};

export type SnapshotManifestContent = {
  schemaVersion: typeof PROGRAM_CASE_SOURCE_SCHEMA_VERSION;
  builderVersion: typeof PROGRAM_CASE_SOURCE_BUILDER_VERSION;
  crawlerSourceRef: string;
  crawlerFileSha256: string;
  databaseName: string;
  programCaseRecordCount: number;
  attachmentCount: number;
  attachmentSnapshots: VerifiedBinarySnapshot[];
  programCaseRecordHashes: string[];
};

export type SnapshotManifest = SnapshotManifestContent & {
  datasetSnapshotHash: string;
  generatedAt: string;
  downloadedAt: string | null;
};

export type ValidationReport = {
  schemaVersion: typeof PROGRAM_CASE_SOURCE_SCHEMA_VERSION;
  builderVersion: typeof PROGRAM_CASE_SOURCE_BUILDER_VERSION;
  datasetSnapshotHash: string | null;
  valid: boolean;
  databaseWriteCount: 0;
  counts: Record<string, number>;
  failures: Array<{ attachmentId: string; status: SnapshotStatus; failureCode: string | null }>;
  unresolvedReasons: Record<string, number>;
  generatedAt: string;
};
