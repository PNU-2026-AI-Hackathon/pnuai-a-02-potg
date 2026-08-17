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
/** 첨부·포스터에서 회차를 뽑아 둔 결과. 크롤 본문에는 없는 내용이라 여기서 가져와 붙인다. */
const DEFAULT_ENRICHED_FILE = path.resolve(process.cwd(), '.local', 'program-attachment-batch', 'full.json');

/** 정제 결과의 회차 한 줄. 화면이 표로 그린다. */
export type EnrichedCurriculumRow = {
  session: number | null;
  date: string | null;
  activity: string | null;
  materials: string | null;
  notes: string | null;
  materialsOrNotes: string | null;
};

type EnrichedFile = {
  /** 정제 결과에서 `curriculum`은 회차 배열 그 자체다. 감싸는 객체가 없다. */
  items: Array<{ sourceId: number; curriculum?: EnrichedCurriculumRow[] | null }>;
};

/**
 * 첨부·포스터에서 뽑은 회차를 sourceId로 찾아 쓸 수 있게 모은다.
 *
 * 이 파일이 없으면 회차 없이 만든다. 게시판은 크롤 본문만으로도 열려야 하고,
 * 정제 배치를 아직 안 돌린 사람도 화면은 볼 수 있어야 한다.
 */
function readEnrichedCurriculum(file: string) {
  const bySourceId = new Map<number, EnrichedCurriculumRow[]>();

  if (!fs.existsSync(file)) {
    console.warn(`정제 결과를 찾지 못해 회차 없이 만듭니다: ${file}`);
    return bySourceId;
  }

  const payload = JSON.parse(fs.readFileSync(file, 'utf8')) as EnrichedFile;
  for (const item of payload.items ?? []) {
    const rows = Array.isArray(item.curriculum) ? item.curriculum : [];
    if (rows.length) bySourceId.set(item.sourceId, rows);
  }

  return bySourceId;
}

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

/**
 * 레코드가 어떤 형태의 내용을 갖고 있는지.
 *
 * 본문에 이미지가 있거나 첨부파일을 열어봐야 하는 레코드는 지금 규칙으로 정제되지 않는다.
 * 화면에는 원본 이미지나 파일 링크만 놓이고 항목이 하나도 채워지지 않는다.
 * 그래서 정제와 화면을 검토할 때는 text_only만 보는 것이 판단에 유리하다.
 */
export type ContentProfile = 'text_only' | 'text_with_supplement' | 'image_only' | 'attachment_only' | 'empty';

export function contentProfileOf(raw: RawProgram): ContentProfile {
  const text = hasReadableText(raw);
  const images = (raw.programContent?.images?.length ?? 0) > 0;
  const attachments = raw.attachments.length > 0;
  if (text) return images || attachments ? 'text_with_supplement' : 'text_only';
  if (images) return 'image_only';
  if (attachments) return 'attachment_only';
  return 'empty';
}

const PROFILE_FILTERS: Record<string, (profile: ContentProfile) => boolean> = {
  'text-only': (profile) => profile === 'text_only',
  'text-first': (profile) => profile === 'text_only' || profile === 'text_with_supplement',
  all: () => true,
};

function countBy<T>(rows: T[], pick: (row: T) => string | null) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = pick(row);
    if (key) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export function buildBoardData(
  records: RawProgram[],
  profile: keyof typeof PROFILE_FILTERS = 'text-only',
  curriculumBySourceId = new Map<number, EnrichedCurriculumRow[]>(),
) {
  const keep = PROFILE_FILTERS[profile];
  if (!keep) throw new Error(`알 수 없는 프로파일: ${profile} (text-only | text-first | all)`);

  const all = records.map((raw) => ({ raw, normalized: normalizeProgram(raw), profile: contentProfileOf(raw) }));
  const included = all.filter((item) => !item.normalized.isExcluded && keep(item.profile));

  const seriesCounts = countBy(included, ({ normalized }) => normalized.seriesKey);
  const items = included.map((item) => ({
    raw: item.raw,
    contentProfile: item.profile,
    normalized: {
      ...item.normalized,
      seriesSize: seriesCounts.get(item.normalized.seriesKey) ?? 1,
      /**
       * 첨부·포스터에서 뽑아낸 회차. 크롤 본문에는 없어서 이걸 붙이지 않으면
       * 화면에 원본 포스터 이미지만 남고, 뽑아 둔 표가 어디에도 안 보인다.
       */
      curriculum: curriculumBySourceId.get(item.normalized.sourceId) ?? [],
    } as NormalizedProgram & { seriesSize: number; curriculum: EnrichedCurriculumRow[] },
  }));

  const fieldFill = (pick: (n: NormalizedProgram) => unknown) => items.filter((item) => {
    const value = pick(item.normalized);
    return value !== null && value !== undefined && value !== '';
  }).length;

  return {
    schemaVersion: 'program-board/v1',
    generatedAt: new Date().toISOString(),
    profile,
    count: items.length,
    excludedCount: all.length - included.length,
    stats: {
      total: all.length,
      included: items.length,
      /** 이번 프로파일에서 빠진 레코드가 어떤 유형인지. 다음에 무엇을 해결해야 하는지 보여준다. */
      contentProfiles: Object.fromEntries(countBy(all, (item) => item.profile)),
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
        /** 첨부·포스터에서 뽑은 회차가 실제로 몇 건에 붙었는지. 0이면 정제 결과를 못 찾은 것이다. */
        withCurriculum: items.filter(({ normalized }) => normalized.curriculum.length).length,
        curriculumRows: items.reduce((sum, { normalized }) => sum + normalized.curriculum.length, 0),
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
  const profileIndex = args.indexOf('--profile');
  const enrichedIndex = args.indexOf('--enriched');
  const inputFile = inputIndex >= 0 ? path.resolve(args[inputIndex + 1]) : latestCrawlFile(DEFAULT_CRAWL_DIR);
  const outDir = outIndex >= 0 ? path.resolve(args[outIndex + 1]) : DEFAULT_OUT_DIR;
  const profile = profileIndex >= 0 ? args[profileIndex + 1] : 'text-only';
  const enrichedFile = enrichedIndex >= 0 ? path.resolve(args[enrichedIndex + 1]) : DEFAULT_ENRICHED_FILE;

  const payload = JSON.parse(fs.readFileSync(inputFile, 'utf8')) as { records: RawProgram[] };
  const curriculumBySourceId = readEnrichedCurriculum(enrichedFile);
  const result = {
    ...buildBoardData(payload.records, profile, curriculumBySourceId),
    input: path.basename(inputFile),
    enrichedInput: path.basename(enrichedFile),
  };

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
