import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import path from 'path';
import { stableHash, stableJson } from './common';

export async function writeJson(pathname: string, value: unknown) {
  await mkdir(path.dirname(pathname), { recursive: true });
  const temporary = `${pathname}.tmp`;
  await writeFile(temporary, `${stableJson(value)}\n`, 'utf8');
  await rm(pathname, { force: true });
  await rename(temporary, pathname);
}

export async function writeJsonl(pathname: string, values: unknown[]) {
  await mkdir(path.dirname(pathname), { recursive: true });
  const temporary = `${pathname}.tmp`;
  const text = values.map(stableJson).join('\n') + (values.length ? '\n' : '');
  await writeFile(temporary, text, 'utf8');
  await rm(pathname, { force: true });
  await rename(temporary, pathname);
  return { count: values.length, sha256: stableHash(values) };
}

export async function readJsonl<T>(pathname: string): Promise<T[]> {
  try {
    const text = await readFile(pathname, 'utf8');
    return text.split('\n').filter(Boolean).map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

export async function readJson<T>(pathname: string): Promise<T | null> {
  try { return JSON.parse(await readFile(pathname, 'utf8')) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
}
