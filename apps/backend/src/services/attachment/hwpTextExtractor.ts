import { access, mkdtemp, readFile, rm, stat } from 'fs/promises';
import path from 'path';
import { getHwpExtractionConfig, HwpExtractionConfig } from '../../config/hwpExtraction';
import { AttachmentProcessingError } from './attachmentErrors';
import { runSubprocess, RunSubprocessOptions, SubprocessResult } from './subprocessRunner';

const KORDOC_VERSION = '4.2.7';
type SubprocessRunner = (options: RunSubprocessOptions) => Promise<SubprocessResult>;

export type HwpTextExtractionResult = {
  rawText: string;
  cleanedText: string;
  extractorType: 'KORDOC_HWP';
  extractorVersion: typeof KORDOC_VERSION;
  metadata: {
    outputFormat: 'kordoc-markdown-with-html-tables';
    outputBytes: number;
    tableCount: number;
    rowCount: number;
    cellCount: number;
    nonWhitespaceCharacterCount: number;
    replacementCharacterCount: number;
  };
};

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match;
    const radix = entity[1]?.toLowerCase() === 'x' ? 16 : 10;
    const digits = radix === 16 ? entity.slice(2) : entity.slice(1);
    const codePoint = Number.parseInt(digits, radix);
    return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
  });
}

function cleanCell(value: string) {
  return decodeEntities(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .trim();
}

export function sanitizeHwpRawText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

export function cleanHwpText(value: string) {
  let normalized = sanitizeHwpRawText(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  normalized = normalized.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi, (_row, body: string) => {
    const cells = [...body.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)].map((match) => cleanCell(match[1]));
    return cells.length > 0 ? `\n${cells.join(' | ')}\n` : '\n';
  });
  return decodeEntities(normalized)
    .replace(/<\/?(?:table|thead|tbody|tfoot|caption)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:p|div|h[1-6]|li|ul|ol|blockquote)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function validateOutput(rawText: string, cleanedText: string, config: HwpExtractionConfig) {
  if (!rawText || !cleanedText) throw new AttachmentProcessingError('HWP_OUTPUT_EMPTY', 'HWP extraction output is empty.');
  if (rawText.length > config.outputMaxCharacters || cleanedText.length > config.outputMaxCharacters) {
    throw new AttachmentProcessingError('HWP_OUTPUT_TOO_LARGE', 'HWP extraction output exceeds the character limit.');
  }
  const nonWhitespace = cleanedText.replace(/\s/g, '').length;
  if (nonWhitespace < config.minimumNonWhitespaceCharacters) {
    throw new AttachmentProcessingError('HWP_OUTPUT_INVALID', 'HWP extraction output has insufficient text.');
  }
  const replacements = (cleanedText.match(/\uFFFD/g) || []).length;
  if (replacements * 10_000 > nonWhitespace * config.maximumReplacementCharactersPerTenThousand) {
    throw new AttachmentProcessingError('HWP_OUTPUT_INVALID', 'HWP extraction output contains excessive replacement characters.');
  }
  return { nonWhitespace, replacements };
}

function kordocCliPath() {
  try {
    return path.join(path.dirname(require.resolve('kordoc')), 'cli.js');
  } catch {
    throw new AttachmentProcessingError('HWP_EXTRACTOR_NOT_AVAILABLE', 'The configured HWP extractor is unavailable.');
  }
}

function mapSubprocessError(error: unknown) {
  if (!(error instanceof AttachmentProcessingError)) {
    return new AttachmentProcessingError('HWP_EXTRACTION_PROCESS_FAILED', 'HWP extraction process failed.');
  }
  if (error.code === 'SUBPROCESS_NOT_FOUND') {
    return new AttachmentProcessingError('HWP_EXTRACTOR_NOT_AVAILABLE', 'The configured HWP extractor is unavailable.');
  }
  if (error.code === 'SUBPROCESS_TIMEOUT') {
    return new AttachmentProcessingError('HWP_EXTRACTION_TIMEOUT', 'HWP extraction process timed out.', true);
  }
  if (error.code === 'SUBPROCESS_OUTPUT_LIMIT_EXCEEDED') {
    return new AttachmentProcessingError('HWP_EXTRACTION_PROCESS_FAILED', 'HWP extraction process log exceeded its limit.');
  }
  if (error.code === 'SUBPROCESS_TERMINATED' && error.retryable) return error;
  return new AttachmentProcessingError('HWP_EXTRACTION_PROCESS_FAILED', 'HWP extraction process failed.');
}

export async function extractHwpText(
  filePath: string,
  signal?: AbortSignal,
  dependencies: { runner?: SubprocessRunner; config?: HwpExtractionConfig; cliPath?: string } = {},
): Promise<HwpTextExtractionResult> {
  const config = dependencies.config ?? getHwpExtractionConfig();
  const runner = dependencies.runner ?? runSubprocess;
  const jobDirectory = await mkdtemp(path.join(path.dirname(filePath), 'kordoc-'));
  const outputPath = path.join(jobDirectory, 'result.md');
  try {
    try {
      await runner({
        executable: process.execPath,
        args: [dependencies.cliPath ?? kordocCliPath(), filePath, '--output', outputPath, '--silent'],
        cwd: jobDirectory,
        timeoutMs: config.timeoutMs,
        stdoutMaxBytes: config.stdoutMaxBytes,
        stderrMaxBytes: config.stderrMaxBytes,
        signal,
      });
    } catch (error) {
      throw mapSubprocessError(error);
    }
    try {
      await access(outputPath);
    } catch {
      throw new AttachmentProcessingError('HWP_OUTPUT_MISSING', 'HWP extraction output file is missing.');
    }
    const outputBytes = (await stat(outputPath)).size;
    if (outputBytes > config.outputMaxBytes) {
      throw new AttachmentProcessingError('HWP_OUTPUT_TOO_LARGE', 'HWP extraction output exceeds the byte limit.');
    }
    const rawText = sanitizeHwpRawText(await readFile(outputPath, 'utf8'));
    const cleanedText = cleanHwpText(rawText);
    const quality = validateOutput(rawText, cleanedText, config);
    return {
      rawText,
      cleanedText,
      extractorType: 'KORDOC_HWP',
      extractorVersion: KORDOC_VERSION,
      metadata: {
        outputFormat: 'kordoc-markdown-with-html-tables',
        outputBytes,
        tableCount: (rawText.match(/<table\b/gi) || []).length,
        rowCount: (rawText.match(/<tr\b/gi) || []).length,
        cellCount: (rawText.match(/<t[dh]\b/gi) || []).length,
        nonWhitespaceCharacterCount: quality.nonWhitespace,
        replacementCharacterCount: quality.replacements,
      },
    };
  } finally {
    await rm(jobDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
