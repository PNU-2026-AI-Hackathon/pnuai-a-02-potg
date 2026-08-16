import fs from 'node:fs';
import path from 'node:path';
import { buildSearchDocuments, SearchProfileKind } from '../services/programBoardSemanticSearch/profileBuilder';
import { buildCorpusSources, type CrawlRecord, type NormalizedProgram } from '../services/programBoardSemanticSearch/corpusAdapter';

const profiles: SearchProfileKind[] = ['title', 'title+intro', 'title+intro+target'];

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function main() {
  const backendDirectory = path.resolve(__dirname, '../..');
  /** 전체 정제 결과. 텍스트 정제 17건도 여기에 들어 있어 따로 읽지 않는다. */
  const programsPath = process.env.PROGRAM_SEARCH_PROGRAMS_PATH
    ? path.resolve(process.env.PROGRAM_SEARCH_PROGRAMS_PATH)
    : path.join(backendDirectory, '.local', 'program-attachment-batch', 'full.json');
  /** 크롤 원본. 정제가 항목을 못 뽑은 건의 소개를 본문 원문에서 살리는 데 쓴다. */
  const crawlPath = process.env.PROGRAM_BOARD_CRAWL
    ? path.resolve(process.env.PROGRAM_BOARD_CRAWL)
    : '';
  const outputDirectory = process.env.PROGRAM_BOARD_SEARCH_DIR
    ? path.resolve(process.env.PROGRAM_BOARD_SEARCH_DIR)
    : path.join(backendDirectory, '.local', 'program-board-search');

  const programs = readJson<{ items: NormalizedProgram[] }>(programsPath).items;
  const crawlRecords = crawlPath ? readJson<{ records: CrawlRecord[] }>(crawlPath).records : [];
  const sources = buildCorpusSources(programs, crawlRecords);

  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const profile of profiles) {
    const documents = buildSearchDocuments(sources, profile);
    fs.writeFileSync(
      path.join(outputDirectory, `documents.${profile}.json`),
      `${JSON.stringify({ schemaVersion: 'program-board-search/v1', profile, count: documents.length, documents }, null, 2)}\n`,
      'utf8',
    );
  }

  const byDetail = sources.reduce<Record<string, number>>((counts, source) => {
    const detail = buildSearchDocuments([source], 'title+intro+target')[0].detailLevel;
    counts[detail] = (counts[detail] ?? 0) + 1;
    return counts;
  }, {});
  console.log(JSON.stringify({
    programsPath,
    crawlPath: crawlPath || null,
    outputDirectory,
    count: sources.length,
    crawlMatched: sources.filter((source) => source.description).length,
    detailLevels: byDetail,
    profiles,
  }, null, 2));
}

main();
