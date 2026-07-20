import { open, stat, unlink } from 'fs/promises';
import path from 'path';
import { TextDecoder } from 'util';
import { AttachmentOcrConfig } from '../../config/attachmentOcr';
import { AttachmentProcessingError } from './attachmentErrors';
import { cleanExtractedText, sanitizeRawTextForStorage } from './pdfTextExtractor';
import { runSubprocess, RunSubprocessOptions, SubprocessResult } from './subprocessRunner';

export type SubprocessRunner = (options: RunSubprocessOptions) => Promise<SubprocessResult>;

export type TesseractPreflightResult = { version: string; availableLanguages: string[] };
export type OcrResult = {
  rawText: string;
  cleanedText: string;
  engine: 'TESSERACT_OCR';
  engineVersion: string;
  languages: string[];
  durationMs: number;
  isEmpty: boolean;
};

function safeWorkPath(workDirectory: string, candidate: string) {
  const root = path.resolve(workDirectory);
  const resolved = path.resolve(candidate);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new AttachmentProcessingError('OCR_PROCESS_FAILED', 'OCR path is outside the work directory.');
  }
  return resolved;
}

function mapOcrError(error: unknown, preflight = false): AttachmentProcessingError {
  if (!(error instanceof AttachmentProcessingError)) {
    return new AttachmentProcessingError(preflight ? 'OCR_VERSION_CHECK_FAILED' : 'OCR_PROCESS_FAILED', preflight ? 'OCR preflight failed.' : 'OCR process failed.');
  }
  if (error.code === 'SUBPROCESS_NOT_FOUND') return new AttachmentProcessingError('OCR_BINARY_NOT_FOUND', 'Tesseract executable was not found.');
  if (error.code === 'SUBPROCESS_TIMEOUT') return new AttachmentProcessingError('OCR_TIMEOUT', 'Tesseract process timed out.', true);
  return new AttachmentProcessingError(preflight ? 'OCR_VERSION_CHECK_FAILED' : 'OCR_PROCESS_FAILED', preflight ? 'OCR preflight failed.' : 'OCR process failed.');
}

export function parseTesseractVersion(output: string) {
  const match = output.match(/tesseract\s+([^\s]+)/i);
  if (!match) throw new AttachmentProcessingError('OCR_VERSION_CHECK_FAILED', 'Tesseract version could not be determined.');
  return match[1];
}

export function parseTesseractLanguages(output: string) {
  return output.split(/\r?\n/).map((line) => line.trim()).filter((line) => /^[a-z0-9_]+$/.test(line));
}

export async function checkTesseract(
  config: AttachmentOcrConfig,
  runner: SubprocessRunner = runSubprocess,
): Promise<TesseractPreflightResult> {
  try {
    const common = { executable: config.tesseractPath, timeoutMs: config.ocrTimeoutMs, stdoutMaxBytes: config.subprocessStdoutMaxBytes, stderrMaxBytes: config.subprocessStderrMaxBytes };
    const versionResult = await runner({ ...common, args: ['--version'] });
    const version = parseTesseractVersion(versionResult.stdout.toString('utf8'));
    const languageResult = await runner({ ...common, args: ['--list-langs'] });
    const availableLanguages = parseTesseractLanguages(languageResult.stdout.toString('utf8'));
    const missing = config.languages.filter((language) => !availableLanguages.includes(language));
    if (missing.length > 0) throw new AttachmentProcessingError('OCR_LANGUAGE_DATA_MISSING', 'Required OCR language data is missing.');
    return { version, availableLanguages };
  } catch (error) {
    if (error instanceof AttachmentProcessingError && error.code === 'OCR_LANGUAGE_DATA_MISSING') throw error;
    throw mapOcrError(error, true);
  }
}

async function readLimitedUtf8(filePath: string, maximum: number) {
  const fileStat = await stat(filePath).catch(() => { throw new AttachmentProcessingError('OCR_PROCESS_FAILED', 'OCR output file was not created.'); });
  if (fileStat.size > maximum) throw new AttachmentProcessingError('OCR_OUTPUT_TOO_LARGE', 'OCR output exceeds the configured limit.');
  const handle = await open(filePath, 'r');
  try {
    const content = Buffer.alloc(fileStat.size);
    await handle.read(content, 0, content.length, 0);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(content); }
    catch { throw new AttachmentProcessingError('OCR_PROCESS_FAILED', 'OCR output is not valid UTF-8.'); }
  } finally { await handle.close(); }
}

export async function runTesseractOcr(input: {
  inputPath: string;
  workDirectory: string;
  engineVersion: string;
  signal?: AbortSignal;
}, config: AttachmentOcrConfig, runner: SubprocessRunner = runSubprocess): Promise<OcrResult> {
  const inputPath = safeWorkPath(input.workDirectory, input.inputPath);
  const outputBase = safeWorkPath(input.workDirectory, path.join(input.workDirectory, 'ocr-output'));
  const outputPath = `${outputBase}.txt`;
  const startedAt = Date.now();
  await unlink(outputPath).catch(() => undefined);
  try {
    await runner({
      executable: config.tesseractPath,
      args: [inputPath, outputBase, '-l', config.languageArgument, '--psm', String(config.psm), 'txt'],
      cwd: path.resolve(input.workDirectory),
      timeoutMs: config.ocrTimeoutMs,
      stdoutMaxBytes: config.subprocessStdoutMaxBytes,
      stderrMaxBytes: config.subprocessStderrMaxBytes,
      signal: input.signal,
    });
    const rawText = sanitizeRawTextForStorage(await readLimitedUtf8(outputPath, config.ocrOutputMaxBytes));
    const cleanedText = cleanExtractedText(rawText);
    return { rawText, cleanedText, engine: 'TESSERACT_OCR', engineVersion: input.engineVersion, languages: [...config.languages], durationMs: Date.now() - startedAt, isEmpty: cleanedText.length === 0 };
  } catch (error) {
    if (error instanceof AttachmentProcessingError && ['OCR_OUTPUT_TOO_LARGE', 'OCR_PROCESS_FAILED'].includes(error.code)) throw error;
    throw mapOcrError(error);
  } finally {
    await unlink(outputPath).catch(() => undefined);
  }
}
