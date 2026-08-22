import { mkdir, readFile } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
import { buildPdfRepresentation } from './pdfRepresentation';
import { buildHwpRepresentation } from './hwpRepresentation';
import { buildOcrRepresentation, SafeOcrResponse, sanitizeClovaResponse } from './ocrRepresentation';
import { requestClovaOcrResponse } from '../attachment/clovaOcrClient';
import { getClovaOcrConfig } from '../../config/clovaOcr';
import { buildProgramCaseCandidates, buildSectionCandidates } from './candidateBuilders';
import { readJson, readJsonl, writeJson, writeJsonl } from './artifactStore';
import { assertRecord, sha256, stableHash } from './common';
import { loadProgramCaseCandidateSources, loadVerifiedSources } from './sourceLoader';
import {
  BaseRecord, HwpStructuralUnit, OcrBlock, OcrField, OcrLine, PdfPage, PdfTextItem, ProgramCaseCandidate,
  REPRESENTATION_SCHEMA_VERSION, REPRESENTATION_VERSION, SectionCandidate, SourceBinary,
} from './types';

export const DEFAULT_REPRESENTATION_DIRECTORY = 'apps/backend/.local/program-case-search-v2/representation';
export const DEFAULT_SOURCE_DIRECTORY = 'apps/backend/.local/program-case-search-v2/sources';

function file(output: string, name: string) { return path.join(output, name); }
function sourceOutput(output: string, source: SourceBinary) { return path.join(output, 'sha256', source.sourceSha256); }

async function imageMetadata(source: SourceBinary) {
  const metadata = await sharp(source.absolutePath, { animated: true, failOn: 'error' }).metadata();
  if (!metadata.width || !metadata.height) throw new Error('IMAGE_DIMENSIONS_MISSING');
  return { width: metadata.width, height: metadata.height, orientation: metadata.orientation ?? null };
}

async function ensureSafeImageMetadata(source: SourceBinary, safe: SafeOcrResponse) {
  if (Number.isSafeInteger(safe.imageWidth) && safe.imageWidth > 0 && Number.isSafeInteger(safe.imageHeight) && safe.imageHeight > 0
    && Object.prototype.hasOwnProperty.call(safe, 'imageOrientation')) return safe;
  const metadata = await imageMetadata(source);
  const content = { ...Object.fromEntries(Object.entries(safe).filter(([key]) => key !== 'contentHash')), ...{
    imageWidth: metadata.width, imageHeight: metadata.height, imageOrientation: metadata.orientation,
  } } as Omit<SafeOcrResponse, 'contentHash'>;
  return { ...content, contentHash: stableHash(content) } as SafeOcrResponse;
}

export async function planRepresentation(sourceDirectory: string, outputDirectory: string) {
  const sources = await loadVerifiedSources(sourceDirectory);
  const counts = Object.fromEntries(['PDF', 'JPEG', 'PNG', 'HWP'].map((type) => [type, sources.filter((source) => source.detectedType === type).length]));
  const ocrCached = await Promise.all(sources.filter((source) => source.detectedType === 'JPEG' || source.detectedType === 'PNG').map(async (source) =>
    (await readJson(file(sourceOutput(outputDirectory, source), 'ocr-response.safe.json'))) ? 1 : 0));
  const reusableArtifacts = ocrCached.reduce<number>((a, b) => a + b, 0);
  return { inputSnapshots: sources.length, counts, ocr: { uniqueImages: counts.JPEG + counts.PNG, reusableArtifacts, expectedCalls: counts.JPEG + counts.PNG - reusableArtifacts }, externalApiCalls: 0 };
}

export async function buildPdfArtifacts(sourceDirectory: string, outputDirectory: string) {
  const sources = (await loadVerifiedSources(sourceDirectory)).filter((source) => source.detectedType === 'PDF');
  const pages: PdfPage[] = []; const items: PdfTextItem[] = []; const failures: Array<{ sourceSha256: string; code: string }> = [];
  for (const source of sources) {
    try {
      const result = await buildPdfRepresentation(source); pages.push(...result.pages); items.push(...result.items);
      await writeJson(file(sourceOutput(outputDirectory, source), 'parser-manifest.json'), {
        schemaVersion: REPRESENTATION_SCHEMA_VERSION, representationVersion: REPRESENTATION_VERSION, sourceSha256: source.sourceSha256,
        parser: result.parser, parserVersion: result.parserVersion, pageCount: result.pages.length, textItemCount: result.items.length,
        contentHash: stableHash({ pages: result.pages, items: result.items }),
      });
      await writeJsonl(file(sourceOutput(outputDirectory, source), 'pdf-pages.jsonl'), result.pages);
      await writeJsonl(file(sourceOutput(outputDirectory, source), 'pdf-text-items.jsonl'), result.items);
    } catch (error) { failures.push({ sourceSha256: source.sourceSha256, code: error instanceof Error ? error.message : 'PDF_FAILED' }); }
  }
  await writeJsonl(file(outputDirectory, 'pdf-pages.jsonl'), pages);
  await writeJsonl(file(outputDirectory, 'pdf-text-items.jsonl'), items);
  return { input: sources.length, succeeded: sources.length - failures.length, failed: failures.length, pageCount: pages.length,
    ocrCandidatePages: pages.filter((page) => page.ocrCandidate).length, textItemCount: items.length, failures, externalApiCalls: 0 };
}

export async function buildHwpArtifacts(sourceDirectory: string, outputDirectory: string) {
  const sources = (await loadVerifiedSources(sourceDirectory)).filter((source) => source.detectedType === 'HWP');
  const units: HwpStructuralUnit[] = []; const failures: Array<{ sourceSha256: string; code: string }> = [];
  for (const source of sources) {
    try {
      const result = await buildHwpRepresentation(source); units.push(...result.units);
      const directory = sourceOutput(outputDirectory, source);
      await writeJson(file(directory, 'parser-manifest.json'), {
        schemaVersion: REPRESENTATION_SCHEMA_VERSION, representationVersion: REPRESENTATION_VERSION, sourceSha256: source.sourceSha256,
        parser: result.parser, parserVersion: result.parserVersion, unitCount: result.units.length, contentHash: stableHash(result.units),
      });
      await writeJsonl(file(directory, 'hwp-structural-units.jsonl'), result.units);
      await mkdir(directory, { recursive: true });
      await writeJson(file(directory, 'hwp-markdown.safe.json'), { sourceSha256: source.sourceSha256,
        parser: result.parser, parserVersion: result.parserVersion, markdown: result.rawMarkdown, contentHash: sha256(result.rawMarkdown) });
    } catch (error) { failures.push({ sourceSha256: source.sourceSha256, code: error instanceof Error ? error.message : 'HWP_FAILED' }); }
  }
  await writeJsonl(file(outputDirectory, 'hwp-structural-units.jsonl'), units);
  return { input: sources.length, succeeded: sources.length - failures.length, failed: failures.length,
    paragraphs: units.filter((unit) => unit.kind === 'HWP_PARAGRAPH').length, tables: units.filter((unit) => unit.kind === 'HWP_TABLE').length,
    rows: units.filter((unit) => unit.kind === 'HWP_TABLE_ROW').length, cells: units.filter((unit) => unit.kind === 'HWP_TABLE_CELL').length,
    headingCandidates: units.filter((unit) => unit.kind === 'HWP_HEADING_CANDIDATE').length, failures, externalApiCalls: 0 };
}

export async function buildOcrArtifacts(input: {
  sourceDirectory: string; outputDirectory: string; allowExternalApi: boolean; maximumCalls: number; sourceHashes?: string[];
}) {
  const all = (await loadVerifiedSources(input.sourceDirectory)).filter((source) => source.detectedType === 'JPEG' || source.detectedType === 'PNG');
  const selected = input.sourceHashes?.length ? all.filter((source) => input.sourceHashes!.includes(source.sourceSha256)) : all;
  if (input.sourceHashes?.some((hash) => !selected.some((source) => source.sourceSha256 === hash))) throw new Error('Unknown or non-image source hash selected.');
  const fields: OcrField[] = []; const lines: OcrLine[] = []; const blocks: OcrBlock[] = [];
  let reused = 0; let apiCalls = 0; const failures: Array<{ sourceSha256: string; code: string }> = [];
  for (const source of selected) {
    const directory = sourceOutput(input.outputDirectory, source);
    let safe = await readJson<SafeOcrResponse>(file(directory, 'ocr-response.safe.json'));
    if (safe?.sourceSha256 === source.sourceSha256) {
      const enriched = await ensureSafeImageMetadata(source, safe);
      if (enriched.contentHash !== safe.contentHash) { safe = enriched; await writeJson(file(directory, 'ocr-response.safe.json'), safe); }
    }
    const reusable = safe && safe.sourceSha256 === source.sourceSha256 && safe.contentHash === stableHash(Object.fromEntries(Object.entries(safe).filter(([key]) => key !== 'contentHash')));
    if (reusable) reused += 1;
    else {
      if (!input.allowExternalApi) { failures.push({ sourceSha256: source.sourceSha256, code: 'EXTERNAL_API_NOT_ALLOWED' }); continue; }
      if (apiCalls >= input.maximumCalls) { failures.push({ sourceSha256: source.sourceSha256, code: 'MAXIMUM_CALLS_REACHED' }); continue; }
      const raw = await requestClovaOcrResponse({ filePath: source.absolutePath, format: source.detectedType === 'PNG' ? 'png' : 'jpg' },
        { ...getClovaOcrConfig(), maxRetries: 0 });
      apiCalls += 1;
      safe = sanitizeClovaResponse(raw, source.sourceSha256, await imageMetadata(source));
      await writeJson(file(directory, 'ocr-response.safe.json'), safe);
    }
    const result = buildOcrRepresentation(source, safe!);
    fields.push(...result.fields); lines.push(...result.lines); blocks.push(...result.blocks);
    await writeJsonl(file(directory, 'fields.jsonl'), result.fields); await writeJsonl(file(directory, 'lines.jsonl'), result.lines);
    await writeJsonl(file(directory, 'blocks.jsonl'), result.blocks);
    await writeJson(file(directory, 'parser-manifest.json'), { schemaVersion: REPRESENTATION_SCHEMA_VERSION,
      representationVersion: REPRESENTATION_VERSION, sourceSha256: source.sourceSha256, parser: 'CLOVA_OCR_GENERAL',
      parserVersion: 'clova-structure-parser-v1', providerVersion: 'V2', fieldCount: result.fields.length,
      lineCount: result.lines.length, blockCount: result.blocks.length, imageWidth: safe!.imageWidth, imageHeight: safe!.imageHeight,
      imageOrientation: safe!.imageOrientation, safeResponseArtifactHash: safe!.contentHash,
      contentHash: stableHash({ fields: result.fields, lines: result.lines, blocks: result.blocks }) });
  }
  await writeJsonl(file(input.outputDirectory, 'ocr-fields.jsonl'), fields); await writeJsonl(file(input.outputDirectory, 'ocr-lines.jsonl'), lines);
  await writeJsonl(file(input.outputDirectory, 'ocr-blocks.jsonl'), blocks);
  return { selected: selected.length, reused, apiCalls, fieldCount: fields.length, lineCount: lines.length, blockCount: blocks.length, failures };
}

async function representationUnits(outputDirectory: string) {
  const [pages, hwp, lines, blocks] = await Promise.all([
    readJsonl<PdfPage>(file(outputDirectory, 'pdf-pages.jsonl')),
    readJsonl<HwpStructuralUnit>(file(outputDirectory, 'hwp-structural-units.jsonl')),
    readJsonl<OcrLine>(file(outputDirectory, 'ocr-lines.jsonl')),
    readJsonl<OcrBlock>(file(outputDirectory, 'ocr-blocks.jsonl')),
  ]);
  return [...pages, ...hwp, ...lines, ...blocks] as Array<BaseRecord & { text?: string; pageNumber?: number }>;
}

export async function buildSectionArtifacts(sourceDirectory: string, outputDirectory: string) {
  const sources = await loadVerifiedSources(sourceDirectory); const units = await representationUnits(outputDirectory);
  const sections = sources.flatMap((source) => buildSectionCandidates(source, units.filter((unit) => unit.sourceSha256 === source.sourceSha256)));
  await writeJsonl(file(outputDirectory, 'attachment-sections.jsonl'), sections);
  for (const source of sources) await writeJsonl(file(sourceOutput(outputDirectory, source), 'sections.jsonl'), sections.filter((section) => section.sourceSha256 === source.sourceSha256));
  return { inputSnapshots: sources.length, sectionCount: sections.length, missingRepresentationSnapshots: sources.filter((source) => !sections.some((section) => section.sourceSha256 === source.sourceSha256)).length };
}

export async function buildCandidateArtifacts(sourceDirectory: string, outputDirectory: string) {
  const sources = await loadVerifiedSources(sourceDirectory); const units = await representationUnits(outputDirectory);
  const sections = await readJsonl<SectionCandidate>(file(outputDirectory, 'attachment-sections.jsonl'));
  const programCases = await loadProgramCaseCandidateSources(sourceDirectory);
  const candidates = sources.flatMap((source) => buildProgramCaseCandidates({ source,
    sections: sections.filter((section) => section.sourceSha256 === source.sourceSha256),
    units: units.filter((unit) => unit.sourceSha256 === source.sourceSha256), programCases }));
  await writeJsonl(file(outputDirectory, 'program-case-candidates.jsonl'), candidates);
  return { candidateCount: candidates.length, ambiguous: candidates.filter((item) => item.status === 'AMBIGUOUS').length,
    noReliableMatch: candidates.filter((item) => item.status === 'NO_RELIABLE_MATCH').length };
}

export async function validateRepresentation(sourceDirectory: string, outputDirectory: string) {
  const sources = await loadVerifiedSources(sourceDirectory);
  const files = ['pdf-pages.jsonl', 'pdf-text-items.jsonl', 'ocr-fields.jsonl', 'ocr-lines.jsonl', 'ocr-blocks.jsonl',
    'hwp-structural-units.jsonl', 'attachment-sections.jsonl', 'program-case-candidates.jsonl'];
  const groups = await Promise.all(files.map((name) => readJsonl<BaseRecord>(file(outputDirectory, name))));
  const records = groups.flat(); const ids = new Set(records.map((record) => record.recordId)); const sourceHashes = new Set(sources.map((source) => source.sourceSha256));
  const failures: string[] = [];
  for (const record of records) {
    try { assertRecord(record); } catch (error) { failures.push(error instanceof Error ? error.message : 'INVALID_RECORD'); }
    if (!sourceHashes.has(record.sourceSha256)) failures.push(`UNKNOWN_SOURCE:${record.recordId}`);
    for (const ref of record.inputUnitRefs ?? []) if (!ids.has(ref)) failures.push(`DANGLING_REF:${record.recordId}:${ref}`);
    const section = record as SectionCandidate; for (const ref of section.orderedUnitRefs ?? []) if (!ids.has(ref)) failures.push(`DANGLING_SECTION_REF:${record.recordId}:${ref}`);
  }
  const datasetHash = stableHash(Object.fromEntries(files.map((name, index) => [name, groups[index]])));
  const sections = groups[6] as SectionCandidate[]; const candidates = groups[7] as ProgramCaseCandidate[];
  const represented = new Set(records.filter((record) => record.kind !== 'PROGRAM_CASE_CANDIDATE').map((record) => record.sourceSha256));
  const report = { schemaVersion: REPRESENTATION_SCHEMA_VERSION, representationVersion: REPRESENTATION_VERSION, valid: failures.length === 0,
    inputSnapshots: sources.length, counts: Object.fromEntries(files.map((name, index) => [name, groups[index].length])),
    sectionCount: sections.length, candidateCount: candidates.length, ambiguous: candidates.filter((item) => item.status === 'AMBIGUOUS').length,
    noReliableMatch: candidates.filter((item) => item.status === 'NO_RELIABLE_MATCH').length,
    missingRepresentationSnapshots: sources.filter((source) => !represented.has(source.sourceSha256)).length,
    danglingReferenceCount: failures.filter((value) => value.includes('DANGLING')).length,
    parserOrProvenanceFailureCount: failures.filter((value) => value.includes('required')).length,
    failures: [...new Set(failures)].sort(), datasetHash, databaseWriteCount: 0, externalUrlDownloads: 0, externalApiCalls: 0 };
  await writeJson(file(outputDirectory, 'validation-report.json'), report);
  await writeJson(file(outputDirectory, 'manifest.json'), { schemaVersion: REPRESENTATION_SCHEMA_VERSION,
    representationVersion: REPRESENTATION_VERSION, sourceDatasetHash: JSON.parse(await readFile(file(sourceDirectory, 'manifest.json'), 'utf8')).datasetSnapshotHash,
    datasetHash, files: Object.fromEntries(files.map((name, index) => [name, { count: groups[index].length, contentHash: stableHash(groups[index]) }])) });
  return report;
}
