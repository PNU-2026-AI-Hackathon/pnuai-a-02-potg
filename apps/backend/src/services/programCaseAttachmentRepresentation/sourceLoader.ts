import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { ProgramCaseCandidateSource, SourceBinary, SourceType } from './types';

type BinaryManifest = {
  sha256: string; binarySnapshotRef: string; detectedType: SourceType; mimeType: string;
  linkedAttachmentIds: string[]; linkedProgramCaseIds: string[];
};

export async function loadVerifiedSources(sourceDirectory: string): Promise<SourceBinary[]> {
  const hashRoot = path.join(sourceDirectory, 'sha256');
  const names = (await readdir(hashRoot)).sort();
  const result: SourceBinary[] = [];
  for (const name of names) {
    const directory = path.join(hashRoot, name);
    const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')) as BinaryManifest;
    if (manifest.sha256 !== name) throw new Error(`Snapshot directory hash mismatch: ${name}`);
    if (!['PDF', 'JPEG', 'PNG', 'HWP'].includes(manifest.detectedType)) continue;
    result.push({
      sourceSha256: manifest.sha256,
      binarySnapshotRef: manifest.binarySnapshotRef,
      absolutePath: path.join(directory, 'original.bin'),
      detectedType: manifest.detectedType,
      mimeType: manifest.mimeType,
      linkedAttachmentIds: [...manifest.linkedAttachmentIds].sort(),
      linkedProgramCaseIds: [...manifest.linkedProgramCaseIds].sort(),
    });
  }
  return result.sort((left, right) => left.sourceSha256.localeCompare(right.sourceSha256));
}

export async function loadProgramCaseCandidateSources(sourceDirectory: string) {
  const records = (await readFile(path.join(sourceDirectory, 'program-cases.jsonl'), 'utf8')).trim().split('\n');
  const result = new Map<string, ProgramCaseCandidateSource>();
  for (const line of records) {
    if (!line) continue;
    const record = JSON.parse(line) as { programCaseId: string; core: Record<string, unknown> };
    const text = (key: string) => typeof record.core[key] === 'string' ? String(record.core[key]) : '';
    result.set(record.programCaseId, {
      programCaseId: record.programCaseId,
      title: text('title'), targetAudience: text('targetAudience'),
      educationStartDateText: text('educationStartDateText'), educationEndDateText: text('educationEndDateText'),
      location: text('location'),
    });
  }
  return result;
}
