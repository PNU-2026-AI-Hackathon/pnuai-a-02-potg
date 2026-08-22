export const BM25_TOKENIZER_VERSION = 'unicode-light-ko-v1';

export function tokenize(value: string): string[] {
  return value.normalize('NFKC').toLocaleLowerCase('ko-KR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(/\s+/).filter(Boolean);
}
