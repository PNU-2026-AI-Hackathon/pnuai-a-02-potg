import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { downloadAttachment } from '../services/attachment/attachmentDownloader';
import { maskUrl } from '../services/attachment/hwpAttachmentAnalysisService';
import { readHwpAttachmentRows } from '../services/attachment/hwpReadOnlyRepository';
import { runSubprocess } from '../services/attachment/subprocessRunner';

const SAMPLE_IDS = [
  '7d6e2509-23a0-431c-b624-b9b7fa70faef',
  '88b3ab83-7b66-44c7-a3c8-e7e0245c770c',
  'bd7ffc09-ef85-4288-a44c-4b97dfc9ddf1',
  '41a0d307-62e4-42de-a199-93aaf02419a0',
] as const;
const OUTPUT_MAX_BYTES = 5 * 1024 * 1024;
const TOOL_TIMEOUT_MS = 60_000;

type ToolMetadata = {
  tool: string;
  version: string;
  command: string;
  success: boolean;
  durationMs: number | null;
  rssBytes: number | null;
  sourceBytes: number;
  rawCharacters: number;
  nonWhitespaceCharacters: number;
  lineCount: number;
  blankLineCount: number;
  errorCode: string | null;
  stderrSummary: string | null;
};

function textMetrics(text: string) {
  const lines = text.length === 0 ? [] : text.split('\n');
  return {
    rawCharacters: text.length,
    nonWhitespaceCharacters: text.replace(/\s/g, '').length,
    lineCount: lines.length,
    blankLineCount: lines.filter((line) => line.trim().length === 0).length,
  };
}

function safeSummary(value: string) {
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 300) || null;
}

async function saveToolResult(directory: string, name: string, text: string, metadata: ToolMetadata) {
  await writeFile(path.join(directory, `${name}.txt`), text, { encoding: 'utf8', flag: 'w', mode: 0o600 });
  await writeFile(path.join(directory, `${name}.json`), `${JSON.stringify(metadata, null, 2)}\n`, {
    encoding: 'utf8', flag: 'w', mode: 0o600,
  });
}

async function runHwpJs(inputPath: string, sourceBytes: number, outputDirectory: string, runtimeDirectory: string) {
  const adapter = path.resolve(process.cwd(), 'scripts/hwpjs-extract-adapter.js');
  const startedAt = Date.now();
  try {
    const result = await runSubprocess({
      executable: process.execPath,
      args: [adapter, runtimeDirectory, inputPath],
      timeoutMs: TOOL_TIMEOUT_MS,
      stdoutMaxBytes: OUTPUT_MAX_BYTES,
      stderrMaxBytes: 64 * 1024,
    });
    const parsed = JSON.parse(result.stdout.toString('utf8')) as {
      success?: unknown; text?: unknown; error?: unknown; rssBytes?: unknown;
    };
    if (parsed.success === false) {
      throw new Error(typeof parsed.error === 'string' ? parsed.error : 'hwp.js parse failed');
    }
    if (typeof parsed.text !== 'string') throw new Error('hwp.js adapter returned no text');
    const metadata: ToolMetadata = {
      tool: 'hwp.js',
      version: '0.0.3',
      command: 'node scripts/hwpjs-extract-adapter.js <local-runtime> <temporary-input>',
      success: true,
      durationMs: result.durationMs,
      rssBytes: typeof parsed.rssBytes === 'number' ? parsed.rssBytes : null,
      sourceBytes,
      ...textMetrics(parsed.text),
      errorCode: null,
      stderrSummary: safeSummary(result.stderr.toString('utf8')),
    };
    await saveToolResult(outputDirectory, 'hwpjs', parsed.text, metadata);
    return metadata;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'hwp.js failed';
    const metadata: ToolMetadata = {
      tool: 'hwp.js', version: '0.0.3',
      command: 'node scripts/hwpjs-extract-adapter.js <local-runtime> <temporary-input>',
      success: false, durationMs: Date.now() - startedAt, rssBytes: null, sourceBytes,
      ...textMetrics(''), errorCode: 'HWPJS_FAILED', stderrSummary: safeSummary(message),
    };
    await saveToolResult(outputDirectory, 'hwpjs', '', metadata);
    return metadata;
  }
}

async function runKordoc(inputPath: string, sourceBytes: number, outputDirectory: string, runtimeDirectory: string) {
  const cli = path.join(runtimeDirectory, 'node_modules', 'kordoc', 'dist', 'cli.js');
  const temporaryOutput = path.join(path.dirname(inputPath), 'kordoc-output.md');
  const startedAt = Date.now();
  try {
    const result = await runSubprocess({
      executable: process.execPath,
      args: [cli, inputPath, '--output', temporaryOutput, '--silent'],
      cwd: path.dirname(inputPath),
      timeoutMs: TOOL_TIMEOUT_MS,
      stdoutMaxBytes: 64 * 1024,
      stderrMaxBytes: 64 * 1024,
    });
    const outputSize = (await stat(temporaryOutput)).size;
    if (outputSize > OUTPUT_MAX_BYTES) throw new Error('kordoc output exceeded the comparison limit');
    const text = await readFile(temporaryOutput, 'utf8');
    const metadata: ToolMetadata = {
      tool: 'kordoc', version: '4.2.7',
      command: 'node <local-kordoc-cli> <temporary-input> --output <temporary-output> --silent',
      success: true, durationMs: result.durationMs, rssBytes: null, sourceBytes,
      ...textMetrics(text), errorCode: null, stderrSummary: safeSummary(result.stderr.toString('utf8')),
    };
    await saveToolResult(outputDirectory, 'kordoc', text, metadata);
    return metadata;
  } catch (error) {
    const metadata: ToolMetadata = {
      tool: 'kordoc', version: '4.2.7',
      command: 'node <local-kordoc-cli> <temporary-input> --output <temporary-output> --silent',
      success: false, durationMs: Date.now() - startedAt, rssBytes: null, sourceBytes,
      ...textMetrics(''), errorCode: 'KORDOC_FAILED',
      stderrSummary: safeSummary(error instanceof Error ? error.message : 'kordoc failed'),
    };
    await saveToolResult(outputDirectory, 'kordoc', '', metadata);
    return metadata;
  } finally {
    await unlink(temporaryOutput).catch(() => undefined);
  }
}

async function saveUnavailableTools(directory: string, sourceBytes: number) {
  const unavailable: Array<[string, string, string, string]> = [
    ['pyhwp', '0.1b15', 'PYHWP_INSTALL_FAILED', 'Python 3.12 installation failed while building cryptography; Rust toolchain unavailable.'],
    ['libreoffice', 'not installed', 'LIBREOFFICE_UNAVAILABLE', 'LibreOffice executable was not installed in the Windows comparison environment.'],
  ];
  for (const [name, version, errorCode, message] of unavailable) {
    await saveToolResult(directory, name, '', {
      tool: name, version, command: 'not executed', success: false, durationMs: null, rssBytes: null,
      sourceBytes, ...textMetrics(''), errorCode, stderrSummary: message,
    });
  }
}

export async function main() {
  const outputRoot = path.resolve(process.cwd(), '.local/hwp-tool-comparison/results');
  const runtimeDirectory = path.resolve(process.cwd(), '.local/hwp-tool-comparison/node-runtime');
  const kordocRuntimeDirectory = path.resolve(process.cwd(), '.local/hwp-tool-comparison/kordoc-runtime');
  await mkdir(outputRoot, { recursive: true });
  const rows = [];
  for (const attachmentId of SAMPLE_IDS) {
    const selected = await readHwpAttachmentRows({ attachmentId });
    if (selected.length !== 1) throw new Error(`Expected one read-only HWP row for ${attachmentId}.`);
    rows.push(selected[0]);
  }
  const summary: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const directory = path.join(outputRoot, row.id);
    await mkdir(directory, { recursive: true });
    let downloaded: Awaited<ReturnType<typeof downloadAttachment>> | undefined;
    try {
      downloaded = await downloadAttachment(row.fileUrl, { concurrency: 1 });
      const hwpjs = await runHwpJs(downloaded.tempFilePath, downloaded.byteSize, directory, runtimeDirectory);
      const kordoc = await runKordoc(
        downloaded.tempFilePath, downloaded.byteSize, directory, kordocRuntimeDirectory,
      );
      await saveUnavailableTools(directory, downloaded.byteSize);
      const sample = {
        attachmentId: row.id,
        programCaseId: row.programCaseId,
        fileName: row.fileName,
        maskedFileUrl: maskUrl(row.fileUrl),
        sourceBytes: downloaded.byteSize,
        checksumSha256: downloaded.checksumSha256,
        tools: { hwpjs: hwpjs.success, kordoc: kordoc.success, pyhwp: false, libreoffice: false },
      };
      await writeFile(path.join(directory, 'sample.json'), `${JSON.stringify(sample, null, 2)}\n`, {
        encoding: 'utf8', flag: 'w', mode: 0o600,
      });
      summary.push(sample);
    } catch (error) {
      summary.push({
        attachmentId: row.id,
        programCaseId: row.programCaseId,
        fileName: row.fileName,
        error: safeSummary(error instanceof Error ? error.message : 'sample comparison failed'),
      });
    } finally {
      await downloaded?.cleanup().catch(() => undefined);
    }
  }
  await writeFile(path.join(outputRoot, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, {
    encoding: 'utf8', flag: 'w', mode: 0o600,
  });
  process.stdout.write(`${JSON.stringify({ samples: summary.length, outputRoot })}\n`);
}

export { SAMPLE_IDS, textMetrics };

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({
      code: 'HWP_TOOL_COMPARISON_FAILED',
      error: error instanceof Error ? error.message : 'HWP comparison failed.',
    }));
    process.exitCode = 1;
  });
}
