import crypto from 'crypto';
import { createRequire } from 'module';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { runSubprocess } from '../services/attachment/subprocessRunner';

const SAMPLE_IDS = [
  '7d6e2509-23a0-431c-b624-b9b7fa70faef',
  '88b3ab83-7b66-44c7-a3c8-e7e0245c770c',
  'bd7ffc09-ef85-4288-a44c-4b97dfc9ddf1',
  '41a0d307-62e4-42de-a199-93aaf02419a0',
] as const;
const OUTPUT_MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 60_000;

type ParseResult = { success: boolean; markdown?: string; error?: { code?: string; message?: string } };
type KordocApi = { VERSION?: string; parseHwp: (buffer: ArrayBuffer) => Promise<ParseResult> };

function packageName(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/');
  const marker = '/node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index < 0) return null;
  const parts = normalized.slice(index + marker.length).split('/');
  return parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

function metrics(text: string) {
  return {
    bytes: Buffer.byteLength(text),
    characters: text.length,
    nonWhitespaceCharacters: text.replace(/\s/g, '').length,
    lines: text.length === 0 ? 0 : text.split('\n').length,
    sha256: crypto.createHash('sha256').update(text).digest('hex'),
  };
}

function exactArrayBuffer(buffer: Buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

export async function validateKordocDeployment(input: {
  runtimeDirectory: string;
  sampleDirectory: string;
  resultDirectory: string;
}) {
  const runtime = path.resolve(input.runtimeDirectory);
  const samples = path.resolve(input.sampleDirectory);
  const results = path.resolve(input.resultDirectory);
  await mkdir(results, { recursive: true });
  const found = (await readdir(samples)).filter((name) => name.endsWith('.hwp')).sort();
  const expected = [...SAMPLE_IDS].map((id) => `${id}.hwp`).sort();
  if (JSON.stringify(found) !== JSON.stringify(expected)) throw new Error('Exactly the four approved HWP samples are required.');

  const beforeModules = new Set(Object.keys(require.cache));
  const requireFromRuntime = createRequire(path.join(runtime, 'package.json'));
  const importStartedAt = Date.now();
  const kordoc = requireFromRuntime('kordoc') as KordocApi;
  const importDurationMs = Date.now() - importStartedAt;
  if (typeof kordoc.parseHwp !== 'function') throw new Error('Official kordoc parseHwp export is unavailable.');
  const afterModules = Object.keys(require.cache).filter((file) => !beforeModules.has(file));
  const loadedPackages = [...new Set(afterModules.map(packageName).filter((value): value is string => Boolean(value)))].sort();

  const direct: Array<Record<string, unknown>> = [];
  const cli: Array<Record<string, unknown>> = [];
  const cliPath = path.join(runtime, 'node_modules', 'kordoc', 'dist', 'cli.js');
  for (const attachmentId of SAMPLE_IDS) {
    const inputPath = path.join(samples, `${attachmentId}.hwp`);
    const sourceBytes = (await stat(inputPath)).size;
    const buffer = await readFile(inputPath);
    const directStartedAt = Date.now();
    const directResult = await kordoc.parseHwp(exactArrayBuffer(buffer));
    const directDurationMs = Date.now() - directStartedAt;
    if (!directResult.success || typeof directResult.markdown !== 'string') {
      throw new Error(`Direct parseHwp failed for ${attachmentId}: ${directResult.error?.code ?? 'UNKNOWN'}`);
    }
    if (Buffer.byteLength(directResult.markdown) > OUTPUT_MAX_BYTES) throw new Error('Direct API output exceeded its limit.');
    await writeFile(path.join(results, `${attachmentId}.direct.txt`), directResult.markdown, { mode: 0o600 });
    direct.push({
      attachmentId, sourceBytes, durationMs: directDurationMs, rssBytes: process.memoryUsage().rss,
      ...metrics(directResult.markdown),
    });

    const temporaryOutput = path.join(results, `${attachmentId}.cli.tmp.md`);
    const finalOutput = path.join(results, `${attachmentId}.cli.txt`);
    try {
      const subprocess = await runSubprocess({
        executable: process.execPath,
        args: [cliPath, inputPath, '--output', temporaryOutput, '--silent'],
        cwd: results,
        timeoutMs: TIMEOUT_MS,
        stdoutMaxBytes: 64 * 1024,
        stderrMaxBytes: 64 * 1024,
      });
      const outputBytes = (await stat(temporaryOutput)).size;
      if (outputBytes > OUTPUT_MAX_BYTES) throw new Error('CLI output exceeded its limit.');
      const text = await readFile(temporaryOutput, 'utf8');
      await writeFile(finalOutput, text, { mode: 0o600 });
      cli.push({ attachmentId, sourceBytes, durationMs: subprocess.durationMs, ...metrics(text) });
    } finally {
      await unlink(temporaryOutput).catch(() => undefined);
    }
  }
  const pairs = direct.map((item, index) => ({
    attachmentId: item.attachmentId,
    identicalOutput: item.sha256 === cli[index]?.sha256,
  }));
  const report = {
    runtime,
    kordocVersion: kordoc.VERSION ?? '4.2.7',
    importDurationMs,
    loadedPackages,
    direct,
    cli,
    pairs,
  };
  await writeFile(path.join(results, 'validation.json'), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  return report;
}

export async function main(args = process.argv.slice(2)) {
  const values = Object.fromEntries(
    args.reduce<Array<[string, string]>>((pairs, value, index) => {
      if (index % 2 === 0) {
        const next = args[index + 1];
        if (!next) throw new Error(`${value} requires a value.`);
        pairs.push([value, next]);
      }
      return pairs;
    }, []),
  );
  const report = await validateKordocDeployment({
    runtimeDirectory: values['--runtime'] ?? '.local/hwp-deployment-validation/prod-no-optional',
    sampleDirectory: values['--samples'] ?? '.local/hwp-deployment-validation/samples',
    resultDirectory: values['--results'] ?? '.local/hwp-deployment-validation/results',
  });
  console.log(JSON.stringify({
    directSucceeded: report.direct.length,
    cliSucceeded: report.cli.length,
    identicalPairs: report.pairs.filter((pair) => pair.identicalOutput).length,
  }));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({
      code: 'KORDOC_DEPLOYMENT_VALIDATION_FAILED',
      error: error instanceof Error ? error.message : 'Deployment validation failed.',
    }));
    process.exitCode = 1;
  });
}
