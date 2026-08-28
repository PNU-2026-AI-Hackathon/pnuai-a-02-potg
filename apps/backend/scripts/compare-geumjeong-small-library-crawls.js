const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--before') options.before = path.resolve(argv[++index]);
    else if (option === '--after') options.after = path.resolve(argv[++index]);
    else if (option === '--output') options.output = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${option}`);
  }
  if (!options.before || !options.after) throw new Error('Usage: --before <json> --after <json> [--output <json>]');
  return options;
}

const stable = (value) => JSON.stringify(value, (_key, nested) => {
  if (!nested || Array.isArray(nested) || typeof nested !== 'object') return nested;
  return Object.fromEntries(Object.entries(nested).sort(([left], [right]) => left.localeCompare(right, 'ko')));
});

// 구 크롤러는 HTML 블록 경계의 공백까지 없앴고 새 크롤러는 그 자리에 개행을 둔다.
// 따라서 의미 문자가 추가/삭제됐는지는 모든 공백을 제거한 문자열로 비교한다.
const withoutWhitespace = (value) => String(value ?? '').replace(/\s+/g, '');

function compare(beforePayload, afterPayload) {
  const before = new Map(beforePayload.records.map((record) => [record.idx, record]));
  const after = new Map(afterPayload.records.map((record) => [record.idx, record]));
  const beforeIds = [...before.keys()].sort((a, b) => a - b);
  const afterIds = [...after.keys()].sort((a, b) => a - b);
  const sharedIds = beforeIds.filter((idx) => after.has(idx));
  const differing = (selector) => sharedIds.filter((idx) => stable(selector(before.get(idx))) !== stable(selector(after.get(idx))));
  const semanticTextDifference = (field) => sharedIds.filter((idx) => withoutWhitespace(before.get(idx)[field]) !== withoutWhitespace(after.get(idx)[field]));
  const newlineCoverage = (records, field) => records.filter((record) => /[\r\n]/.test(String(record[field] ?? ''))).length;

  return {
    beforeCount: beforeIds.length,
    afterCount: afterIds.length,
    addedIds: afterIds.filter((idx) => !before.has(idx)),
    removedIds: beforeIds.filter((idx) => !after.has(idx)),
    changed: {
      titleIds: differing((record) => record.title),
      urlIds: differing((record) => record.url),
      basicInfoIds: differing((record) => record.basicInfo),
      attachmentIds: differing((record) => record.attachments),
      hasAttachmentsIds: differing((record) => record.hasAttachments),
      detailTextSemanticIds: semanticTextDifference('detailText'),
      bodyTextSemanticIds: semanticTextDifference('bodyText'),
    },
    newlineCoverage: {
      beforeDetailText: newlineCoverage(beforePayload.records, 'detailText'),
      afterDetailText: newlineCoverage(afterPayload.records, 'detailText'),
      beforeBodyText: newlineCoverage(beforePayload.records, 'bodyText'),
      afterBodyText: newlineCoverage(afterPayload.records, 'bodyText'),
    },
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const before = JSON.parse(fs.readFileSync(options.before, 'utf8'));
  const after = JSON.parse(fs.readFileSync(options.after, 'utf8'));
  const result = compare(before, after);
  const output = `${JSON.stringify(result, null, 2)}\n`;
  if (options.output) {
    fs.mkdirSync(path.dirname(options.output), { recursive: true });
    fs.writeFileSync(options.output, output);
  }
  console.log(output.trimEnd());
  const changedIds = Object.values(result.changed).flat();
  if (result.addedIds.length || result.removedIds.length || changedIds.length) process.exitCode = 1;
}

main();
