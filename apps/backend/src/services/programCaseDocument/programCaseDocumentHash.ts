import { createHash } from 'crypto';

export function createProgramCaseDocumentHash(content: string) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}
