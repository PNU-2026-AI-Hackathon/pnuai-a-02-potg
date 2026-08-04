import { ProgramCaseAttachment, ProgramCaseSession } from '@prisma/client';
import { SourceProgramRow } from './sourceRepository';
import { stableHash, sha256 } from './stableJson';
import {
  AttachmentSourceMetadata,
  CrawlerSourceRecord,
  FlattenedRepresentation,
  PROGRAM_CASE_SOURCE_BUILDER_VERSION,
  PROGRAM_CASE_SOURCE_SCHEMA_VERSION,
  ProgramCaseSourceRecord,
  Provenance,
  UnresolvedReason,
  VerifiedBinarySnapshot,
} from './types';

const crawlerUnresolved: UnresolvedReason[] = [
  'CRAWLER_HTML_SNAPSHOT_UNAVAILABLE',
  'CRAWLER_PARSER_VERSION_UNAVAILABLE',
  'SOURCE_SPAN_UNAVAILABLE',
];

function iso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function textRepresentation(
  kind: FlattenedRepresentation['kind'],
  value: string | null,
  sourceRef: string,
): FlattenedRepresentation {
  const reasons: UnresolvedReason[] = kind.startsWith('ATTACHMENT_')
    ? ['OCR_BLOCKS_UNAVAILABLE', 'OCR_BOUNDING_BOXES_UNAVAILABLE', 'OCR_CONFIDENCE_UNAVAILABLE', 'PDF_PAGE_STRUCTURE_UNAVAILABLE', 'HWP_PARAGRAPH_STRUCTURE_UNAVAILABLE']
    : ['CRAWLER_HTML_SNAPSHOT_UNAVAILABLE', 'SOURCE_SPAN_UNAVAILABLE'];
  return {
    kind,
    value,
    contentSha256: value === null ? null : sha256(value),
    lossy: true,
    provenance: {
      source: kind.startsWith('ATTACHMENT_') ? 'PARSER_DERIVED_DB' : 'PROGRAM_CASE_DB',
      sourceRef,
      parserVersion: null,
      lossy: true,
      unresolvedReasons: reasons,
    },
  };
}

function notBuiltSnapshot(attachment: ProgramCaseAttachment): VerifiedBinarySnapshot {
  return {
    attachmentId: attachment.id,
    programCaseId: attachment.programCaseId,
    attachmentSourceUrl: attachment.fileUrl,
    sourceSha256: attachment.checksumSha256,
    downloadedSha256: null,
    binarySnapshotRef: null,
    byteSize: null,
    declaredType: attachment.fileType,
    detectedType: null,
    mimeType: null,
    snapshotStatus: 'NOT_BUILT',
    linkedAttachmentIds: [attachment.id],
    linkedProgramCaseIds: [attachment.programCaseId],
    lossy: false,
    unresolvedReasons: ['ATTACHMENT_BINARY_NOT_SNAPSHOTTED'],
    failureCode: null,
  };
}

function attachmentSource(
  attachment: ProgramCaseAttachment,
  snapshots: ReadonlyMap<string, VerifiedBinarySnapshot>,
): AttachmentSourceMetadata {
  const sourceRef = `db:ProgramCaseAttachment/${attachment.id}`;
  return {
    attachmentId: attachment.id,
    programCaseId: attachment.programCaseId,
    attachmentSourceUrl: attachment.fileUrl,
    fileName: attachment.fileName,
    declaredType: attachment.fileType,
    dbDetectedType: attachment.detectedFileType,
    dbMimeType: attachment.detectedMimeType,
    dbByteSize: attachment.fileSizeBytes,
    sourceSha256: attachment.checksumSha256,
    extractionStatus: attachment.extractionStatus,
    extractorType: attachment.extractorType,
    extractorVersion: attachment.extractorVersion,
    flattenedRepresentations: [
      textRepresentation('ATTACHMENT_RAW_TEXT', attachment.rawText, sourceRef),
      textRepresentation('ATTACHMENT_CLEANED_TEXT', attachment.cleanedText, sourceRef),
    ],
    snapshot: snapshots.get(attachment.id) ?? notBuiltSnapshot(attachment),
    provenance: {
      source: 'PROGRAM_CASE_DB', sourceRef, parserVersion: attachment.extractorVersion,
      lossy: false, unresolvedReasons: [],
    },
  };
}

function sessionSource(session: ProgramCaseSession) {
  const provenance: Provenance = {
    source: 'PARSER_DERIVED_DB',
    sourceRef: `db:ProgramCaseSession/${session.id}`,
    parserVersion: null,
    lossy: true,
    unresolvedReasons: ['SESSION_REGEX_DERIVED', 'CRAWLER_PARSER_VERSION_UNAVAILABLE', 'SOURCE_SPAN_UNAVAILABLE'],
  };
  return {
    sessionId: session.id,
    sessionNumber: session.sessionNumber,
    sessionDate: iso(session.sessionDate),
    dateText: session.dateText,
    activity: session.activity,
    sortOrder: session.sortOrder,
    provenance,
  };
}

export function buildProgramCaseSourceRecord(input: {
  program: SourceProgramRow;
  crawlerRecord: Record<string, unknown>;
  crawlerSourceRef: string;
  snapshots?: ReadonlyMap<string, VerifiedBinarySnapshot>;
}): ProgramCaseSourceRecord {
  const { program, crawlerRecord, crawlerSourceRef } = input;
  const crawler: CrawlerSourceRecord = {
    crawlerSourceRef,
    crawlerRecordHash: stableHash(crawlerRecord),
    sourceType: String(crawlerRecord.sourceType ?? ''),
    sourcePostId: String(crawlerRecord.sourcePostId ?? ''),
    sourceUrl: String(crawlerRecord.sourceUrl ?? ''),
    record: crawlerRecord,
    provenance: {
      source: 'CRAWLER_FINAL_DTO', sourceRef: crawlerSourceRef, parserVersion: null,
      lossy: true, unresolvedReasons: crawlerUnresolved,
    },
  };
  const content = {
    schemaVersion: PROGRAM_CASE_SOURCE_SCHEMA_VERSION,
    builderVersion: PROGRAM_CASE_SOURCE_BUILDER_VERSION,
    programCaseId: program.id,
    crawler,
    dbIdentity: {
      programCaseId: program.id,
      sourceType: program.sourceType,
      sourcePostId: program.sourcePostId,
      sourceUrl: program.sourceUrl,
      crawledAt: program.crawledAt.toISOString(),
      requestSucceeded: program.requestSucceeded,
      parseWarnings: program.parseWarnings,
    },
    core: {
      title: program.title,
      targetAudience: program.targetAudience,
      instructor: program.instructor,
      capacity: program.capacity,
      currentApplicants: program.currentApplicants,
      applicationStatus: program.applicationStatus,
      educationStartDate: program.educationStartDate.toISOString(),
      educationEndDate: program.educationEndDate.toISOString(),
      educationStartDateText: program.educationStartDateText,
      educationEndDateText: program.educationEndDateText,
      location: program.location,
      feeText: program.feeText,
      preparationText: program.preparationText,
      contactText: program.contactText,
      hasUnparsedAttachments: program.hasUnparsedAttachments,
      flattenedRepresentations: [
        textRepresentation('PROGRAM_CASE_NOTICES', program.notices, `db:ProgramCase/${program.id}`),
        textRepresentation('PROGRAM_CASE_RAW_TEXT', program.rawText, `db:ProgramCase/${program.id}`),
      ],
    },
    sessions: program.sessions.map(sessionSource),
    attachments: program.attachments.map((attachment) => attachmentSource(attachment, input.snapshots ?? new Map())),
    unresolvedReasons: crawlerUnresolved,
  };
  return { ...content, recordHash: stableHash(content) };
}
