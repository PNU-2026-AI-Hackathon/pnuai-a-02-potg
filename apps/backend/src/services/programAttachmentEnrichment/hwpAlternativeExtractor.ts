import fs from 'fs';

// hwp.js는 일부 HWP 표 셀의 글상자 텍스트를 kordoc보다 잘 보존한다.
// 기본 추출 결과를 대체하지 않고, 회차 행이 더 풍부할 때만 보강 근거로 사용한다.
export function extractAlternativeHwpText(filePath: string) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { parse } = require('hwp.js') as { parse: (buffer: Buffer, options: { type: 'buffer' }) => unknown };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { extractDocument } = require('../../../scripts/hwpjs-extract-adapter.js') as { extractDocument: (document: unknown) => string };
  return extractDocument(parse(fs.readFileSync(filePath), { type: 'buffer' }));
}
