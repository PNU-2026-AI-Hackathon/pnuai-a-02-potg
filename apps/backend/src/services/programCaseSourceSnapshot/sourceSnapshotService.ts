import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'fs/promises';
import path from 'path';
import { ProgramCaseAttachment } from '@prisma/client';
import { downloadAttachment } from '../attachment/attachmentDownloader';
import { detectAttachmentFileType } from '../attachment/fileTypeDetector';
import { SourceProgramRow, SourceSnapshotRows } from './sourceRepository';
import { buildProgramCaseSourceRecord } from './sourceContractBuilder';
import { sha256, stableHash, stableJson } from './stableJson';
import {
  PROGRAM_CASE_SOURCE_BUILDER_VERSION,
  PROGRAM_CASE_SOURCE_SCHEMA_VERSION,
  ProgramCaseSourceRecord,
  SnapshotManifest,
  SnapshotManifestContent,
  SnapshotStatus,
  UnresolvedReason,
  ValidationReport,
  VerifiedBinarySnapshot,
} from './types';

export const DEFAULT_CRAWLER_SOURCE_REF = 'docs/fixtures/geumjeong-programs-349.json';
export const DEFAULT_SNAPSHOT_DIRECTORY = '.local/program-case-search-v2/sources';

type CrawlerRecord = Record<string, unknown>;

export type LoadedCrawlerSource = {
  sourceRef: string;
  fileSha256: string;
  records: CrawlerRecord[];
  byIdentity: Map<string, CrawlerRecord>;
  attachmentUrls: Set<string>;
};

export type SnapshotDependencies = {
  download?: typeof downloadAttachment;
  detect?: typeof detectAttachmentFileType;
  now?: () => Date;
};

function sourceKey(sourceType: string, sourcePostId: string) {
  return `${sourceType}\u0000${sourcePostId}`;
}

function forward(value: string) {
  return value.replace(/\\/g, '/');
}

async function fileHash(filePath: string) {
  return sha256(await readFile(filePath));
}

async function exists(filePath: string) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function atomicWrite(filePath: string, value: string | Buffer) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.part-${process.pid}`;
  await writeFile(temporary, value);
  try {
    await rename(temporary, filePath);
  } catch {
    await rm(filePath, { force: true });
    await rename(temporary, filePath);
  }
}

export async function loadCrawlerSource(filePath: string, sourceRef = DEFAULT_CRAWLER_SOURCE_REF): Promise<LoadedCrawlerSource> {
  const bytes = await readFile(filePath);
  const parsed: unknown = JSON.parse(bytes.toString('utf8'));
  if (!Array.isArray(parsed)) throw new Error('CRAWLER_SOURCE_MUST_BE_ARRAY');
  const records = parsed as CrawlerRecord[];
  const byIdentity = new Map<string, CrawlerRecord>();
  const attachmentUrls = new Set<string>();
  for (const record of records) {
    const key = sourceKey(String(record.sourceType ?? ''), String(record.sourcePostId ?? ''));
    if (byIdentity.has(key)) throw new Error('DUPLICATE_CRAWLER_SOURCE_IDENTITY');
    byIdentity.set(key, record);
    const attachments = Array.isArray(record.attachments) ? record.attachments : [];
    for (const item of attachments) {
      if (item && typeof item === 'object' && typeof (item as Record<string, unknown>).fileUrl === 'string') {
        attachmentUrls.add(String((item as Record<string, unknown>).fileUrl));
      }
    }
  }
  return { sourceRef, fileSha256: sha256(bytes), records, byIdentity, attachmentUrls };
}

export function validateSourceCorrespondence(rows: SourceSnapshotRows, crawler: LoadedCrawlerSource) {
  const programs = rows.programs;
  const attachments = programs.flatMap((program) => program.attachments);
  const missingCrawlerRecords = programs.filter((program) => !crawler.byIdentity.has(sourceKey(program.sourceType, program.sourcePostId)));
  const identityMismatches = programs.filter((program) => {
    const record = crawler.byIdentity.get(sourceKey(program.sourceType, program.sourcePostId));
    return record && String(record.sourceUrl ?? '') !== program.sourceUrl;
  });
  const dbUrls = new Set(attachments.map((attachment) => attachment.fileUrl));
  const dbUrlsMissingFromCrawler = attachments.filter((attachment) => !crawler.attachmentUrls.has(attachment.fileUrl));
  const crawlerUrlsMissingFromDb = [...crawler.attachmentUrls].filter((url) => !dbUrls.has(url));
  return {
    programCount: programs.length,
    attachmentCount: attachments.length,
    crawlerRecordCount: crawler.records.length,
    crawlerAttachmentUrlCount: crawler.attachmentUrls.size,
    dbAttachmentUrlCount: dbUrls.size,
    attachmentsWithSourceSha256: attachments.filter((attachment) => Boolean(attachment.checksumSha256)).length,
    missingCrawlerRecords: missingCrawlerRecords.length,
    identityMismatches: identityMismatches.length,
    dbUrlsMissingFromCrawler: dbUrlsMissingFromCrawler.length,
    crawlerUrlsMissingFromDb: crawlerUrlsMissingFromDb.length,
  };
}

function failureSnapshot(attachment: ProgramCaseAttachment, status: SnapshotStatus, failureCode: string): VerifiedBinarySnapshot {
  const reason: UnresolvedReason = status === 'HASH_MISMATCH'
    ? 'ATTACHMENT_HASH_MISMATCH'
    : status === 'NOT_BUILT'
      ? 'ATTACHMENT_BINARY_NOT_SNAPSHOTTED'
      : 'ATTACHMENT_DOWNLOAD_FAILED';
  return {
    attachmentId: attachment.id,
    programCaseId: attachment.programCaseId,
    attachmentSourceUrl: attachment.fileUrl,
    sourceSha256: attachment.checksumSha256,
    downloadedSha256: null,
    binarySnapshotRef: null,
    httpSucceeded: false,
    nonEmptyResponse: false,
    byteSize: null,
    declaredType: attachment.fileType,
    detectedType: null,
    mimeType: null,
    snapshotStatus: status,
    linkedAttachmentIds: [attachment.id],
    linkedProgramCaseIds: [attachment.programCaseId],
    lossy: false,
    unresolvedReasons: [reason],
    failureCode,
  };
}

async function readPriorManifest(outputDirectory: string) {
  const manifestPath = path.join(outputDirectory, 'manifest.json');
  if (!(await exists(manifestPath))) return new Map<string, VerifiedBinarySnapshot>();
  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SnapshotManifest;
    return new Map(manifest.attachmentSnapshots.map((snapshot) => [snapshot.attachmentId, snapshot]));
  } catch {
    return new Map<string, VerifiedBinarySnapshot>();
  }
}

async function reusableSnapshot(
  attachment: ProgramCaseAttachment,
  prior: VerifiedBinarySnapshot | undefined,
  outputDirectory: string,
) {
  if (!prior || prior.snapshotStatus !== 'VERIFIED' || !prior.binarySnapshotRef || !attachment.checksumSha256) return null;
  if (prior.sourceSha256 !== attachment.checksumSha256) return null;
  const binaryPath = path.join(outputDirectory, ...prior.binarySnapshotRef.split('/'));
  if (!(await exists(binaryPath)) || await fileHash(binaryPath) !== attachment.checksumSha256) return null;
  return {
    ...prior,
    httpSucceeded: true,
    nonEmptyResponse: true,
    snapshotStatus: 'VERIFIED' as const,
    failureCode: null,
    unresolvedReasons: [],
  };
}

async function snapshotOne(
  attachment: ProgramCaseAttachment,
  outputDirectory: string,
  prior: VerifiedBinarySnapshot | undefined,
  dependencies: SnapshotDependencies,
): Promise<VerifiedBinarySnapshot> {
  const reused = await reusableSnapshot(attachment, prior, outputDirectory);
  if (reused) return reused;
  if (!attachment.checksumSha256) return failureSnapshot(attachment, 'HASH_MISMATCH', 'SOURCE_SHA256_MISSING');
  let downloaded: Awaited<ReturnType<typeof downloadAttachment>> | undefined;
  try {
    downloaded = await (dependencies.download ?? downloadAttachment)(attachment.fileUrl, { networkRetries: 1 });
    if (downloaded.byteSize < 1) return failureSnapshot(attachment, 'EMPTY_RESPONSE', 'EMPTY_FILE');
    if (downloaded.checksumSha256 !== attachment.checksumSha256) {
      const result = failureSnapshot(attachment, 'HASH_MISMATCH', 'SOURCE_SHA256_MISMATCH');
      result.downloadedSha256 = downloaded.checksumSha256;
      result.httpSucceeded = true;
      result.nonEmptyResponse = true;
      result.byteSize = downloaded.byteSize;
      result.mimeType = downloaded.responseContentType;
      return result;
    }
    let detection;
    try {
      detection = await (dependencies.detect ?? detectAttachmentFileType)({
        filePath: downloaded.tempFilePath,
        fileName: attachment.fileName,
        dbFileType: attachment.fileType,
        responseContentType: downloaded.responseContentType,
        requireExpectedMatch: false,
      });
    } catch {
      return failureSnapshot(attachment, 'TYPE_DETECTION_FAILED', 'TYPE_DETECTION_FAILED');
    }
    const binarySnapshotRef = forward(path.join('sha256', attachment.checksumSha256, 'original.bin'));
    const target = path.join(outputDirectory, ...binarySnapshotRef.split('/'));
    await mkdir(path.dirname(target), { recursive: true });
    if (!(await exists(target))) {
      const temporary = `${target}.part-${attachment.id}`;
      await copyFile(downloaded.tempFilePath, temporary);
      if (await fileHash(temporary) !== attachment.checksumSha256) {
        await rm(temporary, { force: true });
        return failureSnapshot(attachment, 'HASH_MISMATCH', 'SNAPSHOT_COPY_HASH_MISMATCH');
      }
      try {
        await rename(temporary, target);
      } catch (error) {
        await rm(temporary, { force: true });
        if (!(await exists(target))) throw error;
      }
    } else if (await fileHash(target) !== attachment.checksumSha256) {
      return failureSnapshot(attachment, 'HASH_MISMATCH', 'EXISTING_SNAPSHOT_HASH_MISMATCH');
    }
    return {
      attachmentId: attachment.id,
      programCaseId: attachment.programCaseId,
      attachmentSourceUrl: attachment.fileUrl,
      sourceSha256: attachment.checksumSha256,
      downloadedSha256: downloaded.checksumSha256,
      binarySnapshotRef,
      httpSucceeded: true,
      nonEmptyResponse: true,
      byteSize: downloaded.byteSize,
      declaredType: attachment.fileType,
      detectedType: detection.detectedFileType,
      mimeType: detection.detectedMimeType ?? downloaded.responseContentType,
      snapshotStatus: 'VERIFIED',
      linkedAttachmentIds: [attachment.id],
      linkedProgramCaseIds: [attachment.programCaseId],
      lossy: false,
      unresolvedReasons: [],
      failureCode: null,
    };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'DOWNLOAD_FAILED';
    return failureSnapshot(attachment, 'DOWNLOAD_FAILED', code);
  } finally {
    await downloaded?.cleanup().catch(() => undefined);
  }
}

function linkSharedSnapshots(snapshots: VerifiedBinarySnapshot[]) {
  const groups = new Map<string, VerifiedBinarySnapshot[]>();
  for (const snapshot of snapshots) {
    if (snapshot.snapshotStatus !== 'VERIFIED' || !snapshot.downloadedSha256) continue;
    if (!groups.has(snapshot.downloadedSha256)) groups.set(snapshot.downloadedSha256, []);
    groups.get(snapshot.downloadedSha256)!.push(snapshot);
  }
  for (const group of groups.values()) {
    const attachmentIds = group.map((item) => item.attachmentId).sort();
    const programCaseIds = [...new Set(group.map((item) => item.programCaseId))].sort();
    for (const snapshot of group) {
      snapshot.linkedAttachmentIds = attachmentIds;
      snapshot.linkedProgramCaseIds = programCaseIds;
    }
  }
  return groups;
}

function pairRecords(
  rows: SourceSnapshotRows,
  crawler: LoadedCrawlerSource,
  snapshots: ReadonlyMap<string, VerifiedBinarySnapshot>,
) {
  return rows.programs.map((program) => {
    const crawlerRecord = crawler.byIdentity.get(sourceKey(program.sourceType, program.sourcePostId));
    if (!crawlerRecord) throw new Error(`CRAWLER_RECORD_MISSING:${program.id}`);
    return buildProgramCaseSourceRecord({ program, crawlerRecord, crawlerSourceRef: crawler.sourceRef, snapshots });
  });
}

function unresolvedCounts(records: ProgramCaseSourceRecord[]) {
  const result: Record<string, number> = {};
  const add = (reasons: readonly string[]) => reasons.forEach((reason) => { result[reason] = (result[reason] ?? 0) + 1; });
  for (const record of records) {
    add(record.unresolvedReasons);
    record.sessions.forEach((session) => add(session.provenance.unresolvedReasons));
    record.attachments.forEach((attachment) => {
      add(attachment.snapshot.unresolvedReasons);
      attachment.flattenedRepresentations.forEach((representation) => add(representation.provenance.unresolvedReasons));
    });
  }
  return result;
}

function reportFor(manifest: SnapshotManifest | null, records: ProgramCaseSourceRecord[], correspondence: ReturnType<typeof validateSourceCorrespondence>): ValidationReport {
  const snapshots = manifest?.attachmentSnapshots ?? records.flatMap((record) => record.attachments.map((attachment) => attachment.snapshot));
  const attachmentSources = records.flatMap((record) => record.attachments);
  const counts: Record<string, number> = {
    programCases: records.length,
    attachments: snapshots.length,
    crawlerRecords: correspondence.crawlerRecordCount,
    jsonUrlsMatched: correspondence.attachmentCount - correspondence.dbUrlsMissingFromCrawler,
    attachmentsWithSourceSha256: correspondence.attachmentsWithSourceSha256,
    verifiedSnapshots: snapshots.filter((item) => item.snapshotStatus === 'VERIFIED').length,
    plannedSnapshots: snapshots.filter((item) => item.snapshotStatus === 'NOT_BUILT').length,
    failedSnapshots: snapshots.filter((item) => item.snapshotStatus !== 'VERIFIED' && item.snapshotStatus !== 'NOT_BUILT').length,
    hashMatches: snapshots.filter((item) => item.downloadedSha256 && item.downloadedSha256 === item.sourceSha256).length,
    hashMismatches: snapshots.filter((item) => item.snapshotStatus === 'HASH_MISMATCH').length,
    httpSuccessful: snapshots.filter((item) => item.httpSucceeded).length,
    nonEmptyResponses: snapshots.filter((item) => item.nonEmptyResponse).length,
    dbByteSizeMatches: attachmentSources.filter((item) => item.dbByteSize !== null && item.snapshot.byteSize === item.dbByteSize).length,
    dbByteSizeMismatches: attachmentSources.filter((item) => item.dbByteSize !== null && item.snapshot.byteSize !== item.dbByteSize).length,
    dbDetectedTypeMatches: attachmentSources.filter((item) => item.dbDetectedType !== null && item.snapshot.detectedType === item.dbDetectedType).length,
    dbDetectedTypeMismatches: attachmentSources.filter((item) => item.dbDetectedType !== null && item.snapshot.detectedType !== item.dbDetectedType).length,
    dbMimeTypeMatches: attachmentSources.filter((item) => item.dbMimeType !== null && item.snapshot.mimeType === item.dbMimeType).length,
    dbMimeTypeMismatches: attachmentSources.filter((item) => item.dbMimeType !== null && item.snapshot.mimeType !== item.dbMimeType).length,
    uniqueVerifiedBinaries: new Set(snapshots.filter((item) => item.snapshotStatus === 'VERIFIED').map((item) => item.downloadedSha256)).size,
    sharedHashGroups: new Set(snapshots.filter((item) => item.snapshotStatus === 'VERIFIED' && item.linkedAttachmentIds.length > 1).map((item) => item.downloadedSha256)).size,
    missingSnapshotReferences: snapshots.filter((item) => item.snapshotStatus === 'VERIFIED' && !item.binarySnapshotRef).length,
    missingCrawlerRecords: correspondence.missingCrawlerRecords,
    identityMismatches: correspondence.identityMismatches,
    dbUrlsMissingFromCrawler: correspondence.dbUrlsMissingFromCrawler,
    crawlerUrlsMissingFromDb: correspondence.crawlerUrlsMissingFromDb,
  };
  const failures = snapshots
    .filter((snapshot) => snapshot.snapshotStatus !== 'VERIFIED' && snapshot.snapshotStatus !== 'NOT_BUILT')
    .map((snapshot) => ({ attachmentId: snapshot.attachmentId, status: snapshot.snapshotStatus, failureCode: snapshot.failureCode }));
  const valid = counts.programCases === 349 && counts.attachments === 237
    && counts.jsonUrlsMatched === 237 && counts.attachmentsWithSourceSha256 === 237
    && counts.failedSnapshots === 0 && counts.hashMismatches === 0
    && counts.httpSuccessful === 237 && counts.nonEmptyResponses === 237
    && counts.dbByteSizeMismatches === 0 && counts.dbDetectedTypeMismatches === 0 && counts.dbMimeTypeMismatches === 0
    && counts.missingSnapshotReferences === 0 && counts.missingCrawlerRecords === 0
    && counts.identityMismatches === 0 && counts.dbUrlsMissingFromCrawler === 0
    && counts.crawlerUrlsMissingFromDb === 0;
  return {
    schemaVersion: PROGRAM_CASE_SOURCE_SCHEMA_VERSION,
    builderVersion: PROGRAM_CASE_SOURCE_BUILDER_VERSION,
    datasetSnapshotHash: manifest?.datasetSnapshotHash ?? null,
    valid,
    databaseWriteCount: 0,
    counts,
    failures,
    unresolvedReasons: unresolvedCounts(records),
    generatedAt: new Date().toISOString(),
  };
}

export function planSourceSnapshot(rows: SourceSnapshotRows, crawler: LoadedCrawlerSource) {
  const correspondence = validateSourceCorrespondence(rows, crawler);
  const records = pairRecords(rows, crawler, new Map());
  return { correspondence, report: reportFor(null, records, correspondence) };
}

export async function buildSourceSnapshot(input: {
  rows: SourceSnapshotRows;
  crawler: LoadedCrawlerSource;
  outputDirectory: string;
  dependencies?: SnapshotDependencies;
}) {
  const correspondence = validateSourceCorrespondence(input.rows, input.crawler);
  if (correspondence.missingCrawlerRecords || correspondence.identityMismatches
    || correspondence.dbUrlsMissingFromCrawler || correspondence.crawlerUrlsMissingFromDb) {
    throw new Error('SOURCE_CORRESPONDENCE_FAILED');
  }
  await mkdir(path.join(input.outputDirectory, 'sha256'), { recursive: true });
  const prior = await readPriorManifest(input.outputDirectory);
  const attachments = input.rows.programs.flatMap((program) => program.attachments).sort((a, b) => a.id.localeCompare(b.id));
  const snapshots: VerifiedBinarySnapshot[] = [];
  for (const attachment of attachments) {
    snapshots.push(await snapshotOne(attachment, input.outputDirectory, prior.get(attachment.id), input.dependencies ?? {}));
  }
  const groups = linkSharedSnapshots(snapshots);
  for (const [hash, group] of groups) {
    const content = {
      schemaVersion: PROGRAM_CASE_SOURCE_SCHEMA_VERSION,
      builderVersion: PROGRAM_CASE_SOURCE_BUILDER_VERSION,
      sha256: hash,
      byteSize: group[0].byteSize,
      detectedType: group[0].detectedType,
      mimeType: group[0].mimeType,
      binarySnapshotRef: group[0].binarySnapshotRef,
      linkedAttachmentIds: group[0].linkedAttachmentIds,
      linkedProgramCaseIds: group[0].linkedProgramCaseIds,
    };
    await atomicWrite(path.join(input.outputDirectory, 'sha256', hash, 'manifest.json'), stableJson({
      ...content,
      contentHash: stableHash(content),
      generatedAt: (input.dependencies?.now ?? (() => new Date()))().toISOString(),
    }));
  }
  const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.attachmentId, snapshot]));
  const records = pairRecords(input.rows, input.crawler, snapshotMap);
  const content: SnapshotManifestContent = {
    schemaVersion: PROGRAM_CASE_SOURCE_SCHEMA_VERSION,
    builderVersion: PROGRAM_CASE_SOURCE_BUILDER_VERSION,
    crawlerSourceRef: input.crawler.sourceRef,
    crawlerFileSha256: input.crawler.fileSha256,
    databaseName: input.rows.databaseName,
    programCaseRecordCount: records.length,
    attachmentCount: snapshots.length,
    attachmentSnapshots: snapshots.sort((a, b) => a.attachmentId.localeCompare(b.attachmentId)),
    programCaseRecordHashes: records.map((record) => record.recordHash),
  };
  const now = (input.dependencies?.now ?? (() => new Date()))().toISOString();
  const manifest: SnapshotManifest = {
    ...content,
    datasetSnapshotHash: stableHash(content),
    generatedAt: now,
    downloadedAt: now,
  };
  const report = reportFor(manifest, records, correspondence);
  await atomicWrite(path.join(input.outputDirectory, 'program-cases.jsonl'), `${records.map(stableJson).join('\n')}\n`);
  await atomicWrite(path.join(input.outputDirectory, 'manifest.json'), stableJson(manifest));
  await atomicWrite(path.join(input.outputDirectory, 'validation-report.json'), stableJson(report));
  return { manifest, report, records };
}

export async function validateBuiltSnapshot(input: {
  rows: SourceSnapshotRows;
  crawler: LoadedCrawlerSource;
  outputDirectory: string;
}) {
  const manifest = JSON.parse(await readFile(path.join(input.outputDirectory, 'manifest.json'), 'utf8')) as SnapshotManifest;
  const lines = (await readFile(path.join(input.outputDirectory, 'program-cases.jsonl'), 'utf8')).trim().split('\n').filter(Boolean);
  const records = lines.map((line) => JSON.parse(line) as ProgramCaseSourceRecord);
  const { generatedAt: _generatedAt, downloadedAt: _downloadedAt, datasetSnapshotHash, ...content } = manifest;
  if (stableHash(content) !== datasetSnapshotHash) throw new Error('DATASET_SNAPSHOT_HASH_MISMATCH');
  for (const record of records) {
    const { recordHash, ...recordContent } = record;
    if (stableHash(recordContent) !== recordHash) throw new Error(`PROGRAM_RECORD_HASH_MISMATCH:${record.programCaseId}`);
  }
  for (const snapshot of manifest.attachmentSnapshots.filter((item) => item.snapshotStatus === 'VERIFIED')) {
    if (!snapshot.binarySnapshotRef || !snapshot.downloadedSha256) throw new Error('VERIFIED_SNAPSHOT_REFERENCE_MISSING');
    const binaryPath = path.join(input.outputDirectory, ...snapshot.binarySnapshotRef.split('/'));
    if (!(await exists(binaryPath)) || await fileHash(binaryPath) !== snapshot.downloadedSha256) {
      throw new Error(`BINARY_SNAPSHOT_HASH_MISMATCH:${snapshot.attachmentId}`);
    }
  }
  const correspondence = validateSourceCorrespondence(input.rows, input.crawler);
  const report = reportFor(manifest, records, correspondence);
  await atomicWrite(path.join(input.outputDirectory, 'validation-report.json'), stableJson(report));
  return { manifest, report, records };
}
