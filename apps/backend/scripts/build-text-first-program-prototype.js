const fs = require('node:fs');
const path = require('node:path');

const { normalizeProgram } = require('../dist/services/programDataNormalization/normalizer.js');

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) {
  throw new Error('Usage: node scripts/build-text-first-program-prototype.js <crawl.json> <output.json>');
}

const input = path.resolve(inputArg);
const output = path.resolve(outputArg);
const payload = JSON.parse(fs.readFileSync(input, 'utf8'));

/**
 * 지금 단계에서 정제할 수 있는 것은 '기계가 읽을 수 있는 본문 텍스트를 가진 레코드'다.
 * 첨부파일이나 포스터 이미지가 함께 있어도 본문 텍스트는 그대로 정제할 수 있으므로
 * 제외 사유로 보지 않는다. 이미지·HWP·PDF는 본문을 대체하는 것이 아니라 보조 자료이며,
 * 그 안의 내용을 읽어내는 일은 다음 단계로 미룬다.
 */
function hasReadableText(record) {
  return Boolean(String(record.programContent?.text ?? record.detailText ?? '').trim());
}

const selected = payload.records
  .map((raw) => ({ raw, normalized: normalizeProgram(raw) }))
  .filter(({ raw, normalized }) => !normalized.isExcluded && hasReadableText(raw))
  .map(({ raw, normalized }) => ({
    selectionReason: raw.programContent?.tables?.length ? 'HTML 표 기반' : '본문 텍스트 기반',
    supplementaryOnly: {
      inlineImages: raw.programContent?.images?.length ?? 0,
      attachments: raw.attachments.length,
    },
    raw,
    normalized,
  }));

const result = {
  schemaVersion: 'program-text-first-prototype/v2',
  generatedAt: new Date().toISOString(),
  input: path.basename(input),
  count: selected.length,
  criteria: {
    requiresReadableBodyText: true,
    excludesRecordsMarkedExcluded: true,
    keepsRecordsWithImagesOrAttachments: true,
  },
  breakdown: {
    withTables: selected.filter((item) => item.raw.programContent?.tables?.length).length,
    withInlineImages: selected.filter((item) => item.supplementaryOnly.inlineImages > 0).length,
    withAttachments: selected.filter((item) => item.supplementaryOnly.attachments > 0).length,
    libraryFromTitleTag: selected.filter((item) => item.normalized.evidence.libraryNameSource === 'title_tag').length,
    libraryFromBodyLocation: selected.filter((item) => item.normalized.evidence.libraryNameSource === 'body_location').length,
    libraryUnresolved: selected.filter((item) => !item.normalized.libraryName).length,
  },
  items: selected,
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ output, count: result.count, breakdown: result.breakdown }, null, 2));
