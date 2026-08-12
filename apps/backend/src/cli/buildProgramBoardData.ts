import fs from 'fs';
import path from 'path';
import { normalizeProgram } from '../services/programDataNormalization/normalizer';
import type { NormalizedProgram, RawProgram } from '../services/programDataNormalization/types';

/**
 * 게시판이 읽을 데이터를 만드는 단일 파이프라인.
 *
 * 이전에는 대표 20건용과 텍스트형용 산출 경로가 따로 있어서 화면이 어느 쪽을 읽는지
 * 파일 존재 여부로 결정됐다. 정제 규칙이 같은데 결과가 둘이면 무엇을 검수한 것인지
 * 알 수 없으므로 하나로 합친다.
 */

const DEFAULT_CRAWL_DIR = path.resolve(process.cwd(), '.local', 'geumjeong-small-library-crawl');
const DEFAULT_OUT_DIR = path.resolve(process.cwd(), '.local', 'program-board');

function latestCrawlFile(dir: string) {
  const files = fs.readdirSync(dir)
    .filter((name) => name.startsWith('geumjeong-small-library-programs-') && name.endsWith('.json'))
    .sort();
  if (!files.length) throw new Error(`크롤링 결과가 없습니다: ${dir}`);
  return path.join(dir, files[files.length - 1]);
}

function hasReadableText(raw: RawProgram) {
  return Boolean(String(raw.programContent?.text ?? raw.detailText ?? '').trim());
}

function countBy<T>(rows: T[], pick: (row: T) => string | null) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = pick(row);
    if (key) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export function buildBoardData(records: RawProgram[]) {
  const all = records.map((raw) => ({ raw, normalized: normalizeProgram(raw) }));
  const included = all.filter(({ raw, normalized }) => !normalized.isExcluded && hasReadableText(raw));

  const seriesCounts = countBy(included, ({ normalized }) => normalized.seriesKey);
  const items = included.map(({ raw, normalized }) => ({
    raw,
    normalized: {
      ...normalized,
      seriesSize: seriesCounts.get(normalized.seriesKey) ?? 1,
    } as NormalizedProgram & { seriesSize: number },
  }));

  const fieldFill = (pick: (n: NormalizedProgram) => unknown) => items.filter((item) => {
    const value = pick(item.normalized);
    return value !== null && value !== undefined && value !== '';
  }).length;

  return {
    schemaVersion: 'program-board/v1',
    generatedAt: new Date().toISOString(),
    count: items.length,
    excludedCount: all.length - included.length,
    stats: {
      total: all.length,
      included: items.length,
      status: Object.fromEntries(countBy(items, ({ normalized }) => normalized.normalizationStatus)),
      fields: {
        libraryName: fieldFill((n) => n.libraryName),
        targetGroup: fieldFill((n) => n.targetGroup),
        capacity: fieldFill((n) => n.capacity),
        programStartDate: fieldFill((n) => n.programStartDate),
        scheduleText: fieldFill((n) => n.scheduleText),
        feeText: fieldFill((n) => n.feeText),
      },
      content: {
        withSections: items.filter(({ normalized }) => normalized.board.sections.length).length,
        withNotices: items.filter(({ normalized }) => normalized.board.notices.length).length,
        withTables: items.filter(({ raw }) => raw.programContent?.tables?.length).length,
        withImages: items.filter(({ raw }) => raw.programContent?.images?.length).length,
        withAttachments: items.filter(({ raw }) => raw.attachments.length).length,
        unmappedLabelRecords: items.filter(({ normalized }) => normalized.board.unmappedLabels.length).length,
      },
      series: {
        groups: [...seriesCounts.values()].filter((count) => count > 1).length,
        recordsInSeries: [...seriesCounts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0),
        largest: [...seriesCounts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5)
          .map(([key, count]) => ({ seriesKey: key, count })),
      },
    },
    items,
  };
}

export async function main(args = process.argv.slice(2)) {
  const inputIndex = args.indexOf('--input');
  const outIndex = args.indexOf('--out');
  const inputFile = inputIndex >= 0 ? path.resolve(args[inputIndex + 1]) : latestCrawlFile(DEFAULT_CRAWL_DIR);
  const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : DEFAULT_OUT_DIR;

  const payload = JSON.parse(fs.readFileSync(inputFile, 'utf8')) as { records: RawProgram[] };
  const result = { ...buildBoardData(payload.records), input: path.basename(inputFile) };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'programs.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output: path.join(outDir, 'programs.json'), count: result.count, stats: result.stats }, null, 2));
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
