import { readFile } from 'fs/promises';
import path from 'path';
import { sha256, stableHash, stableJson } from '../programCaseSourceSnapshot/stableJson';
import {
  BaseRecord, REPRESENTATION_SCHEMA_VERSION, REPRESENTATION_VERSION, RepresentationOrigin, SourceBinary,
} from './types';

export { sha256, stableHash, stableJson };

export function deterministicRecordId(input: {
  sourceSha256: string; kind: string; structuralPosition: string; content: unknown;
}) {
  return stableHash({
    representationVersion: REPRESENTATION_VERSION,
    sourceSha256: input.sourceSha256,
    kind: input.kind,
    structuralPosition: input.structuralPosition,
    contentHash: stableHash(input.content),
  });
}

export function baseRecord(input: {
  source: SourceBinary; kind: string; origin: RepresentationOrigin; parser: string; parserVersion: string;
  structuralOrder: number; structuralPosition: string; content: unknown; confidence?: number;
  unresolvedReasons?: string[]; derivationRule?: string; derivationVersion?: string; inputUnitRefs?: string[];
}): BaseRecord {
  const contentHash = stableHash(input.content);
  return {
    schemaVersion: REPRESENTATION_SCHEMA_VERSION,
    representationVersion: REPRESENTATION_VERSION,
    recordId: deterministicRecordId({
      sourceSha256: input.source.sourceSha256, kind: input.kind,
      structuralPosition: input.structuralPosition, content: input.content,
    }),
    kind: input.kind,
    origin: input.origin,
    sourceSha256: input.source.sourceSha256,
    binarySnapshotRef: input.source.binarySnapshotRef,
    parser: input.parser,
    parserVersion: input.parserVersion,
    structuralOrder: input.structuralOrder,
    contentHash,
    confidence: input.confidence ?? 1,
    unresolvedReasons: [...(input.unresolvedReasons ?? [])].sort(),
    ...(input.derivationRule ? { derivationRule: input.derivationRule } : {}),
    ...(input.derivationVersion ? { derivationVersion: input.derivationVersion } : {}),
    ...(input.inputUnitRefs ? { inputUnitRefs: [...input.inputUnitRefs] } : {}),
  };
}

export async function verifySourceBinary(source: SourceBinary) {
  const bytes = await readFile(source.absolutePath);
  if (sha256(bytes) !== source.sourceSha256) throw new Error(`Source hash mismatch: ${source.sourceSha256}`);
  const normalizedRef = source.binarySnapshotRef.replace(/\\/g, '/');
  if (normalizedRef !== `sha256/${source.sourceSha256}/original.bin`) {
    throw new Error(`Invalid binary snapshot ref: ${source.binarySnapshotRef}`);
  }
  return bytes;
}

export function assertRecord(record: BaseRecord) {
  if (!record.parser || !record.parserVersion || !record.representationVersion) throw new Error('Parser and representation versions are required.');
  if (!/^[a-f0-9]{64}$/.test(record.sourceSha256)) throw new Error('Invalid source hash.');
  if (!record.binarySnapshotRef) throw new Error('Binary snapshot ref is required.');
  if (record.origin === 'DERIVED' && (!record.derivationRule || !record.derivationVersion || !record.inputUnitRefs)) {
    throw new Error(`Derived record is missing derivation metadata: ${record.recordId}`);
  }
  if (record.contentHash !== stableHash(recordContent(record))) throw new Error(`Content hash mismatch: ${record.recordId}`);
}

function recordContent(record: BaseRecord) {
  const ignored = new Set([
    'schemaVersion', 'representationVersion', 'recordId', 'kind', 'origin', 'sourceSha256', 'binarySnapshotRef',
    'parser', 'parserVersion', 'structuralOrder', 'contentHash', 'confidence', 'unresolvedReasons',
    'derivationRule', 'derivationVersion', 'inputUnitRefs',
  ]);
  return Object.fromEntries(Object.entries(record).filter(([key]) => !ignored.has(key)));
}

export function snapshotRootFromRepresentation(outputDirectory: string) {
  return path.resolve(outputDirectory, '..', 'sources');
}
