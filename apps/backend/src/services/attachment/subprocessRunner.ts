import { spawn } from 'child_process';
import { AttachmentProcessingError } from './attachmentErrors';

export type SubprocessResult = {
  exitCode: number;
  signal: NodeJS.Signals | null;
  stdout: Buffer;
  stderr: Buffer;
  durationMs: number;
};

export type RunSubprocessOptions = {
  executable: string;
  args: readonly string[];
  cwd?: string;
  timeoutMs: number;
  stdoutMaxBytes?: number;
  stderrMaxBytes?: number;
  signal?: AbortSignal;
};

export async function runSubprocess(options: RunSubprocessOptions): Promise<SubprocessResult> {
  const startedAt = Date.now();
  const stdoutMax = options.stdoutMaxBytes ?? 64 * 1024;
  const stderrMax = options.stderrMaxBytes ?? 64 * 1024;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timedOut = false;
    let aborted = false;
    let limitExceeded = false;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const child = spawn(options.executable, [...options.args], {
      cwd: options.cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stop = () => { if (!child.killed) child.kill('SIGKILL'); };
    const timer = setTimeout(() => { timedOut = true; stop(); }, options.timeoutMs);
    const onAbort = () => { aborted = true; stop(); };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
    const collect = (target: Buffer[], chunk: Buffer, stream: 'stdout' | 'stderr') => {
      if (stream === 'stdout') stdoutBytes += chunk.length;
      else stderrBytes += chunk.length;
      const total = stream === 'stdout' ? stdoutBytes : stderrBytes;
      const maximum = stream === 'stdout' ? stdoutMax : stderrMax;
      if (total > maximum) { limitExceeded = true; stop(); return; }
      target.push(Buffer.from(chunk));
    };
    child.stdout.on('data', (chunk: Buffer) => collect(stdout, chunk, 'stdout'));
    child.stderr.on('data', (chunk: Buffer) => collect(stderr, chunk, 'stderr'));
    const finish = () => {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    };
    child.once('error', (error: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      finish();
      reject(new AttachmentProcessingError(
        error.code === 'ENOENT' ? 'SUBPROCESS_NOT_FOUND' : 'SUBPROCESS_TERMINATED',
        error.code === 'ENOENT' ? 'Required subprocess executable was not found.' : 'Subprocess could not be started.',
      ));
    });
    child.once('close', (exitCode, signal) => {
      if (settled) return;
      settled = true;
      finish();
      if (limitExceeded) return reject(new AttachmentProcessingError('SUBPROCESS_OUTPUT_LIMIT_EXCEEDED', 'Subprocess output exceeded the configured limit.'));
      if (timedOut) return reject(new AttachmentProcessingError('SUBPROCESS_TIMEOUT', 'Subprocess timed out.', true));
      if (aborted) return reject(new AttachmentProcessingError('SUBPROCESS_TERMINATED', 'Subprocess was cancelled.', true));
      if (exitCode !== 0) return reject(new AttachmentProcessingError('SUBPROCESS_EXIT_FAILED', 'Subprocess exited unsuccessfully.'));
      resolve({ exitCode: 0, signal, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr), durationMs: Date.now() - startedAt });
    });
  });
}
