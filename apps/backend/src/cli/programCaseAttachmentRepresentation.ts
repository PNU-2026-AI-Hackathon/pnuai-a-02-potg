import { existsSync } from 'fs';
import path from 'path';
import {
  buildCandidateArtifacts, buildHwpArtifacts, buildOcrArtifacts, buildPdfArtifacts, buildSectionArtifacts,
  DEFAULT_REPRESENTATION_DIRECTORY, DEFAULT_SOURCE_DIRECTORY, planRepresentation, validateRepresentation,
} from '../services/programCaseAttachmentRepresentation/representationService';

type Mode = 'dry-run' | 'build-pdf' | 'build-hwp' | 'plan-ocr' | 'build-ocr' | 'build-sections' | 'build-candidates' | 'validate';
export type RepresentationArguments = { mode: Mode; sourceDirectory: string; outputDirectory: string; allowExternalApi: boolean; maximumCalls: number; sourceHashes: string[] };

function resolveDefault(relative: string) {
  const candidates = [path.resolve(process.cwd(), relative), path.resolve(process.cwd(), '..', '..', relative)];
  return candidates.find(existsSync) ?? candidates[0];
}

export function parseRepresentationArguments(args: string[]): RepresentationArguments {
  const modes = new Map<string, Mode>([['--dry-run', 'dry-run'], ['--build-pdf', 'build-pdf'], ['--build-hwp', 'build-hwp'],
    ['--plan-ocr', 'plan-ocr'], ['--build-ocr', 'build-ocr'], ['--build-sections', 'build-sections'],
    ['--build-candidates', 'build-candidates'], ['--validate', 'validate']]);
  let mode: Mode | null = null; let sourceDirectory = resolveDefault(DEFAULT_SOURCE_DIRECTORY);
  let outputDirectory = resolveDefault(DEFAULT_REPRESENTATION_DIRECTORY); let allowExternalApi = false; let maximumCalls = 0;
  const sourceHashes: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (modes.has(argument)) { if (mode) throw new Error('Only one execution mode may be selected.'); mode = modes.get(argument)!; continue; }
    if (argument === '--allow-external-api') { if (allowExternalApi) throw new Error('Duplicate option: --allow-external-api'); allowExternalApi = true; continue; }
    const [option, inline] = argument.split('=', 2); const value = inline ?? args[++index];
    if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
    if (option === '--sources') sourceDirectory = path.resolve(value);
    else if (option === '--output') outputDirectory = path.resolve(value);
    else if (option === '--max-calls') { maximumCalls = Number(value); if (!Number.isSafeInteger(maximumCalls) || maximumCalls < 0 || maximumCalls > 10) throw new Error('--max-calls must be an integer from 0 to 10.'); }
    else if (option === '--source-hash') { if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid source hash.'); sourceHashes.push(value); }
    else throw new Error(`Unknown option: ${option}`);
  }
  const selectedMode = mode ?? 'dry-run';
  if (allowExternalApi && selectedMode !== 'build-ocr') throw new Error('--allow-external-api is only valid with --build-ocr.');
  if (selectedMode === 'build-ocr' && allowExternalApi && (!sourceHashes.length || maximumCalls < 1)) {
    throw new Error('External OCR requires at least one --source-hash and --max-calls >= 1.');
  }
  if (selectedMode !== 'build-ocr' && (sourceHashes.length || maximumCalls)) throw new Error('OCR selection options are only valid with --build-ocr.');
  return { mode: selectedMode, sourceDirectory, outputDirectory, allowExternalApi, maximumCalls, sourceHashes: [...new Set(sourceHashes)].sort() };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseRepresentationArguments(args); let result: unknown;
  if (options.mode === 'build-pdf') result = await buildPdfArtifacts(options.sourceDirectory, options.outputDirectory);
  else if (options.mode === 'build-hwp') result = await buildHwpArtifacts(options.sourceDirectory, options.outputDirectory);
  else if (options.mode === 'build-ocr') result = await buildOcrArtifacts({ sourceDirectory: options.sourceDirectory, outputDirectory: options.outputDirectory,
    allowExternalApi: options.allowExternalApi, maximumCalls: options.maximumCalls, sourceHashes: options.sourceHashes });
  else if (options.mode === 'build-sections') result = await buildSectionArtifacts(options.sourceDirectory, options.outputDirectory);
  else if (options.mode === 'build-candidates') result = await buildCandidateArtifacts(options.sourceDirectory, options.outputDirectory);
  else if (options.mode === 'validate') result = await validateRepresentation(options.sourceDirectory, options.outputDirectory);
  else result = await planRepresentation(options.sourceDirectory, options.outputDirectory);
  console.log(JSON.stringify({ mode: options.mode, databaseWriteCount: 0, externalUrlDownloads: 0, ...result as object }, null, 2));
  return result;
}

if (require.main === module) main().catch((error) => {
  console.error(JSON.stringify({ code: 'PROGRAM_CASE_ATTACHMENT_REPRESENTATION_FAILED', error: error instanceof Error ? error.message : 'Representation failed.' }));
  process.exitCode = 1;
});
