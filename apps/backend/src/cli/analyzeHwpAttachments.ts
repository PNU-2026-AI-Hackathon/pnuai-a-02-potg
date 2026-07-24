import { mkdir, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { analyzeHwpDataset } from '../services/attachment/hwpAttachmentAnalysisService';
import { renderHwpAnalysisMarkdown } from '../services/attachment/hwpAnalysisReport';
import { readHwpAttachmentRows } from '../services/attachment/hwpReadOnlyRepository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AnalyzeHwpArguments = {
  attachmentId?: string;
  limit?: number;
  jsonPath?: string;
  markdownPath?: string;
};

export function parseAnalyzeHwpArguments(args: string[]): AnalyzeHwpArguments {
  const values: Record<string, string> = {};
  const supported = new Set(['--attachment-id', '--limit', '--json', '--markdown']);
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!supported.has(option)) throw new Error(`Unknown option: ${option}`);
    if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
    if (option in values) throw new Error(`Duplicate option: ${option}`);
    values[option] = value;
  }
  const attachmentId = values['--attachment-id'];
  if (attachmentId && !UUID.test(attachmentId)) throw new Error('--attachment-id must be a UUID.');
  const limit = values['--limit'] === undefined ? undefined : Number(values['--limit']);
  if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)) {
    throw new Error('--limit must be an integer from 1 to 100.');
  }
  return {
    ...(attachmentId ? { attachmentId } : {}),
    ...(limit ? { limit } : {}),
    ...(values['--json'] ? { jsonPath: path.resolve(values['--json']) } : {}),
    ...(values['--markdown'] ? { markdownPath: path.resolve(values['--markdown']) } : {}),
  };
}

async function writeOutput(filePath: string, contents: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, { encoding: 'utf8', flag: 'w', mode: 0o600 });
}

export async function main(args = process.argv.slice(2)) {
  const options = parseAnalyzeHwpArguments(args);
  const rows = await readHwpAttachmentRows(options);
  const dataset = await analyzeHwpDataset(rows, options);
  const json = `${JSON.stringify(dataset, null, 2)}\n`;
  const markdown = renderHwpAnalysisMarkdown(
    dataset,
    `${process.platform}/${process.arch}, Node ${process.version}, ${os.release()}`,
  );
  if (options.jsonPath) await writeOutput(options.jsonPath, json);
  if (options.markdownPath) await writeOutput(options.markdownPath, markdown);
  if (!options.jsonPath && !options.markdownPath) process.stdout.write(json);
  else process.stdout.write(`${JSON.stringify({ selected: rows.length, jsonPath: options.jsonPath ?? null, markdownPath: options.markdownPath ?? null })}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({
      code: 'HWP_ANALYSIS_COMMAND_FAILED',
      error: error instanceof Error ? error.message : 'HWP analysis failed.',
    }));
    process.exitCode = 1;
  });
}
