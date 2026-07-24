import { open, stat, unlink } from 'fs/promises';
import path from 'path';
import { AttachmentOcrConfig, getAttachmentOcrConfig } from '../../config/attachmentOcr';
import { AttachmentProcessingError } from './attachmentErrors';
import { runSubprocess, RunSubprocessOptions, SubprocessResult } from './subprocessRunner';

type SubprocessRunner = (options: RunSubprocessOptions) => Promise<SubprocessResult>;

export type PdfRendererAvailability = {
  configured: boolean;
  available: boolean;
  versionConfigured: boolean;
  version: string | null;
};

export type RenderedPdfPage = {
  filePath: string;
  byteSize: number;
  cleanup: () => Promise<void>;
};

function containedPath(workDirectory: string, candidate: string) {
  const root = path.resolve(workDirectory);
  const resolved = path.resolve(candidate);
  if (resolved === root || !resolved.startsWith(`${root}${path.sep}`)) {
    throw new AttachmentProcessingError('PDF_RENDER_FAILED', 'PDF renderer path is outside the working directory.');
  }
  return resolved;
}

function mappedRendererError(error: unknown) {
  if (!(error instanceof AttachmentProcessingError)) {
    return new AttachmentProcessingError('PDF_RENDER_FAILED', 'PDF page rendering failed.');
  }
  if (error.code === 'SUBPROCESS_NOT_FOUND') {
    return new AttachmentProcessingError('PDF_RENDERER_UNAVAILABLE', 'PDF renderer is unavailable.');
  }
  if (error.code === 'SUBPROCESS_TIMEOUT') {
    return new AttachmentProcessingError('PDF_RENDER_TIMEOUT', 'PDF page rendering timed out.', true);
  }
  return new AttachmentProcessingError('PDF_RENDER_FAILED', 'PDF page rendering failed.');
}

export async function detectPdfRendererAvailability(
  config: AttachmentOcrConfig = getAttachmentOcrConfig(),
  runner: SubprocessRunner = runSubprocess,
): Promise<PdfRendererAvailability> {
  const configured = config.pdfRenderExecutable.trim().length > 0;
  if (!configured) return { configured: false, available: false, versionConfigured: false, version: null };
  try {
    const result = await runner({
      executable: config.pdfRenderExecutable,
      args: ['-v'],
      timeoutMs: Math.min(config.pdfRenderTimeoutMs, 5_000),
      stdoutMaxBytes: 16 * 1024,
      stderrMaxBytes: 16 * 1024,
    });
    const output = `${result.stdout.toString('utf8')}\n${result.stderr.toString('utf8')}`;
    const version = output.match(/pdftocairo version\s+([0-9][0-9A-Za-z._-]*)/i)?.[1] ?? null;
    return { configured: true, available: true, versionConfigured: version !== null, version };
  } catch {
    return { configured: true, available: false, versionConfigured: false, version: null };
  }
}

export async function renderPdfPage(
  input: { pdfPath: string; pageNumber: number; pageCount: number; workDirectory: string },
  config: AttachmentOcrConfig = getAttachmentOcrConfig(),
  runner: SubprocessRunner = runSubprocess,
): Promise<RenderedPdfPage> {
  if (!Number.isSafeInteger(input.pageCount) || input.pageCount < 1) {
    throw new AttachmentProcessingError('PDF_OCR_PAGE_COUNT_INVALID', 'PDF page count is invalid.');
  }
  if (input.pageCount > config.pdfOcrMaxPages) {
    throw new AttachmentProcessingError('PDF_PAGE_LIMIT_EXCEEDED', 'PDF exceeds the configured page limit.');
  }
  if (!Number.isSafeInteger(input.pageNumber) || input.pageNumber < 1 || input.pageNumber > input.pageCount) {
    throw new AttachmentProcessingError('PDF_PAGE_NUMBER_INVALID', 'PDF page number is invalid.');
  }
  const pdfPath = containedPath(input.workDirectory, input.pdfPath);
  const outputPrefix = containedPath(input.workDirectory, path.join(input.workDirectory, `pdf-page-${input.pageNumber}`));
  const outputPath = `${outputPrefix}.png`;
  const cleanup = async () => { await unlink(outputPath).catch(() => undefined); };
  try {
    await runner({
      executable: config.pdfRenderExecutable,
      args: [
        '-png', '-singlefile', '-r', String(config.pdfRenderDpi),
        '-f', String(input.pageNumber), '-l', String(input.pageNumber),
        pdfPath, outputPrefix,
      ],
      cwd: path.resolve(input.workDirectory),
      timeoutMs: config.pdfRenderTimeoutMs,
      stdoutMaxBytes: 64 * 1024,
      stderrMaxBytes: 64 * 1024,
    });
    let metadata;
    try {
      metadata = await stat(outputPath);
    } catch {
      throw new AttachmentProcessingError('PDF_RENDER_OUTPUT_MISSING', 'PDF renderer output is missing.');
    }
    if (metadata.size === 0) {
      throw new AttachmentProcessingError('PDF_RENDER_OUTPUT_INVALID', 'PDF renderer output is empty.');
    }
    if (metadata.size > config.pdfRenderMaxBytes) {
      throw new AttachmentProcessingError('PDF_RENDER_OUTPUT_TOO_LARGE', 'PDF renderer output exceeds the configured limit.');
    }
    const handle = await open(outputPath, 'r');
    const signature = Buffer.alloc(8);
    try {
      await handle.read(signature, 0, signature.length, 0);
    } finally {
      await handle.close();
    }
    if (!signature.equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
      throw new AttachmentProcessingError('PDF_RENDER_OUTPUT_INVALID', 'PDF renderer output is not a PNG image.');
    }
    return { filePath: outputPath, byteSize: metadata.size, cleanup };
  } catch (error) {
    await cleanup();
    if (error instanceof AttachmentProcessingError && error.code.startsWith('PDF_RENDER_OUTPUT_')) throw error;
    throw mappedRendererError(error);
  }
}
