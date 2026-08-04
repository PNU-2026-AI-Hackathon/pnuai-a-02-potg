import { existsSync } from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import {
  buildSourceSnapshot,
  DEFAULT_CRAWLER_SOURCE_REF,
  DEFAULT_SNAPSHOT_DIRECTORY,
  loadCrawlerSource,
  planSourceSnapshot,
  validateBuiltSnapshot,
} from '../services/programCaseSourceSnapshot/sourceSnapshotService';
import { loadSourceRowsReadOnly } from '../services/programCaseSourceSnapshot/sourceRepository';

export type SourceSnapshotArguments = {
  mode: 'dry-run' | 'build' | 'validate';
  crawlerFile: string;
  outputDirectory: string;
};

function defaultCrawlerFile() {
  const candidates = [
    path.resolve(process.cwd(), DEFAULT_CRAWLER_SOURCE_REF),
    path.resolve(process.cwd(), '..', '..', DEFAULT_CRAWLER_SOURCE_REF),
  ];
  return candidates.find(existsSync) ?? candidates[0];
}

function defaultOutputDirectory() {
  return path.resolve(process.cwd(), DEFAULT_SNAPSHOT_DIRECTORY);
}

export function parseSourceSnapshotArguments(args: string[]): SourceSnapshotArguments {
  const flags = new Set(['--dry-run', '--build', '--validate']);
  const values = new Set(['--crawler-file', '--output']);
  const seen = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const equals = argument.indexOf('=');
    const option = equals >= 0 ? argument.slice(0, equals) : argument;
    if (!flags.has(option) && !values.has(option)) throw new Error(`Unknown option: ${option}`);
    if (seen.has(option)) throw new Error(`Duplicate option: ${option}`);
    if (flags.has(option)) {
      if (equals >= 0) throw new Error(`${option} does not accept a value.`);
      seen.set(option, true);
    } else {
      const value = equals >= 0 ? argument.slice(equals + 1) : args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
      seen.set(option, value);
    }
  }
  const selected = [...flags].filter((flag) => seen.has(flag));
  if (selected.length > 1) throw new Error('Only one execution mode may be selected.');
  const mode = selected[0] === '--build' ? 'build' : selected[0] === '--validate' ? 'validate' : 'dry-run';
  return {
    mode,
    crawlerFile: path.resolve(String(seen.get('--crawler-file') ?? defaultCrawlerFile())),
    outputDirectory: path.resolve(String(seen.get('--output') ?? defaultOutputDirectory())),
  };
}

function safeSummary(mode: SourceSnapshotArguments['mode'], databaseName: string, value: {
  correspondence?: Record<string, number>;
  report: { valid: boolean; databaseWriteCount: 0; datasetSnapshotHash: string | null; counts: Record<string, number>; failures: unknown[] };
}) {
  return {
    mode,
    databaseName,
    databaseReadOnly: true,
    databaseWriteCount: value.report.databaseWriteCount,
    valid: value.report.valid,
    datasetSnapshotHash: value.report.datasetSnapshotHash,
    correspondence: value.correspondence,
    counts: value.report.counts,
    failureCount: value.report.failures.length,
  };
}

export async function main(
  args = process.argv.slice(2),
  dependencies: {
    loadRows?: typeof loadSourceRowsReadOnly;
    loadCrawler?: typeof loadCrawlerSource;
    build?: typeof buildSourceSnapshot;
    validate?: typeof validateBuiltSnapshot;
  } = {},
) {
  const options = parseSourceSnapshotArguments(args);
  const rows = await (dependencies.loadRows ?? loadSourceRowsReadOnly)();
  const crawler = await (dependencies.loadCrawler ?? loadCrawlerSource)(options.crawlerFile, DEFAULT_CRAWLER_SOURCE_REF);
  if (options.mode === 'build') {
    const result = await (dependencies.build ?? buildSourceSnapshot)({ rows, crawler, outputDirectory: options.outputDirectory });
    const output = safeSummary(options.mode, rows.databaseName, result);
    console.log(JSON.stringify(output, null, 2));
    if (!result.report.valid) process.exitCode = 1;
    return output;
  }
  if (options.mode === 'validate') {
    const result = await (dependencies.validate ?? validateBuiltSnapshot)({ rows, crawler, outputDirectory: options.outputDirectory });
    const output = safeSummary(options.mode, rows.databaseName, result);
    console.log(JSON.stringify(output, null, 2));
    if (!result.report.valid) process.exitCode = 1;
    return output;
  }
  const result = planSourceSnapshot(rows, crawler);
  const output = safeSummary(options.mode, rows.databaseName, result);
  console.log(JSON.stringify(output, null, 2));
  return output;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(JSON.stringify({
        code: 'PROGRAM_CASE_SOURCE_SNAPSHOT_FAILED',
        error: error instanceof Error ? error.message : 'Program case source snapshot failed.',
      }));
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
