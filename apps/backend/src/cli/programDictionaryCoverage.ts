import fs from 'fs';
import path from 'path';
import {
  LABEL_DICTIONARY_VERSION,
  LIBRARY_DICTIONARY_VERSION,
  lookupLabel,
  lookupLibrary,
  parseLabelLine,
} from '../services/programDataNormalization/dictionary';

/**
 * 사전 커버리지 측정.
 *
 * 정제 표준은 한 번 만들고 끝나지 않는다. 원사이트에 새 표기가 계속 들어오므로,
 * "지금 사전이 원문을 얼마나 덮고 있는가"와 "다음에 무엇을 사전에 넣어야 하는가"를
 * 매번 같은 방식으로 뽑아야 표준이 유지된다. 미분류 항목은 버리지 않고 여기서 드러낸다.
 */

const DEFAULT_INPUT_DIR = path.resolve(process.cwd(), '.local', 'geumjeong-small-library-crawl');

type RawRecord = {
  idx: number;
  title: string;
  programContent?: { text?: string };
  noticeText?: string;
  detailText?: string;
};

function latestCrawlFile(inputDir: string) {
  const files = fs.readdirSync(inputDir)
    .filter((name) => name.startsWith('geumjeong-small-library-programs-') && name.endsWith('.json'))
    .sort();
  if (files.length === 0) throw new Error(`크롤링 결과를 찾을 수 없습니다: ${inputDir}`);
  return path.join(inputDir, files[files.length - 1]);
}

function leadingTags(title: string) {
  const tags: string[] = [];
  let remainder = title.trim();
  while (remainder.startsWith('[')) {
    const match = remainder.match(/^\[([^\]]+)\]\s*/);
    if (!match) break;
    tags.push(match[1].trim());
    remainder = remainder.slice(match[0].length);
  }
  return tags;
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function measureCoverage(records: RawRecord[]) {
  let libraryMatched = 0;
  let libraryKnownNonLibrary = 0;
  let libraryNoTag = 0;
  const libraryUnresolved = new Map<string, number>();

  for (const record of records) {
    const tags = leadingTags(record.title);
    if (tags.length === 0) {
      libraryNoTag += 1;
      continue;
    }
    const hit = lookupLibrary(tags);
    if (hit.canonical) libraryMatched += 1;
    else if (hit.knownNonLibrary) libraryKnownNonLibrary += 1;
    else bump(libraryUnresolved, tags.join('/'));
  }

  let labelMapped = 0;
  let labelIgnored = 0;
  let labelUnknown = 0;
  const labelUnresolved = new Map<string, number>();
  const fieldHits = new Map<string, number>();

  for (const record of records) {
    const text = [record.programContent?.text ?? record.detailText ?? '', record.noticeText ?? ''].join('\n');
    for (const line of text.split('\n')) {
      const parsed = parseLabelLine(line);
      if (!parsed) continue;
      const hit = lookupLabel(parsed.label);
      if (hit.status === 'mapped') {
        labelMapped += 1;
        bump(fieldHits, hit.field);
      } else if (hit.status === 'ignored') {
        labelIgnored += 1;
      } else {
        labelUnknown += 1;
        bump(labelUnresolved, parsed.label);
      }
    }
  }

  const labelTotal = labelMapped + labelIgnored + labelUnknown;
  const sortDesc = (map: Map<string, number>) => [...map.entries()].sort((left, right) => right[1] - left[1]);

  return {
    dictionaryVersions: { libraries: LIBRARY_DICTIONARY_VERSION, labels: LABEL_DICTIONARY_VERSION },
    library: {
      total: records.length,
      matched: libraryMatched,
      knownNonLibrary: libraryKnownNonLibrary,
      noTag: libraryNoTag,
      unresolved: sortDesc(libraryUnresolved).map(([tag, count]) => ({ tag, count })),
    },
    label: {
      totalLines: labelTotal,
      mapped: labelMapped,
      ignored: labelIgnored,
      unknown: labelUnknown,
      mappedRate: labelTotal ? Number((labelMapped / labelTotal * 100).toFixed(1)) : 0,
      fieldHits: sortDesc(fieldHits).map(([field, count]) => ({ field, count })),
      unresolved: sortDesc(labelUnresolved).map(([label, count]) => ({ label, count })),
    },
  };
}

function render(report: ReturnType<typeof measureCoverage>, inputFile: string) {
  const lines: string[] = [];
  lines.push('# 정제 사전 커버리지');
  lines.push('');
  lines.push(`- 입력: \`${path.basename(inputFile)}\``);
  lines.push(`- 도서관 사전: \`${report.dictionaryVersions.libraries}\` / 라벨 사전: \`${report.dictionaryVersions.labels}\``);
  lines.push('');
  lines.push('## 도서관 판별');
  lines.push('');
  lines.push(`- 매칭 ${report.library.matched}/${report.library.total}`);
  lines.push(`- 도서관 아님(사전에 명시) ${report.library.knownNonLibrary}`);
  lines.push(`- 제목에 태그 없음 ${report.library.noTag}`);
  lines.push(`- **미해결 ${report.library.unresolved.reduce((sum, item) => sum + item.count, 0)}**`);
  report.library.unresolved.forEach((item) => lines.push(`  - \`${item.tag}\` ${item.count}건`));
  lines.push('');
  lines.push('## 라벨 매핑');
  lines.push('');
  lines.push(`- 라벨 줄 ${report.label.totalLines}개 중 매핑 ${report.label.mapped} (${report.label.mappedRate}%), 의도적 무시 ${report.label.ignored}, 미분류 ${report.label.unknown}`);
  lines.push('');
  lines.push('| 필드 | 적중 |');
  lines.push('|---|---:|');
  report.label.fieldHits.forEach((item) => lines.push(`| ${item.field} | ${item.count} |`));
  if (report.label.unresolved.length) {
    lines.push('');
    lines.push('### 미분류 라벨 (다음 사전 추가 후보)');
    lines.push('');
    report.label.unresolved.forEach((item) => lines.push(`- \`${item.label}\` ${item.count}회`));
  }
  return lines.join('\n') + '\n';
}

export async function main(args = process.argv.slice(2)) {
  const inputIndex = args.indexOf('--input');
  const outIndex = args.indexOf('--out');
  const inputFile = inputIndex >= 0 ? args[inputIndex + 1] : latestCrawlFile(DEFAULT_INPUT_DIR);
  const records = JSON.parse(fs.readFileSync(inputFile, 'utf8')).records as RawRecord[];
  const report = measureCoverage(records);
  const markdown = render(report, inputFile);

  if (outIndex >= 0) {
    const outDir = args[outIndex + 1];
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'dictionary-coverage.json'), JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(path.join(outDir, 'dictionary-coverage.md'), markdown, 'utf8');
  }
  console.log(markdown);
  return report;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
