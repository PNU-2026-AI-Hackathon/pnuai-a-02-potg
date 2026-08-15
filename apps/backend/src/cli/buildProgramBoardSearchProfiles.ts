import fs from 'node:fs';
import path from 'node:path';
import { buildSearchDocuments, SearchProfileKind } from '../services/programBoardSemanticSearch/profileBuilder';

const profiles: SearchProfileKind[] = ['title', 'title+intro', 'title+intro+target'];

function main() {
  const backendDirectory = path.resolve(__dirname, '../..');
  const inputPath = process.env.PROGRAM_BOARD_DATA_PATH
    ? path.resolve(process.env.PROGRAM_BOARD_DATA_PATH)
    : path.join(backendDirectory, '.local', 'program-board', 'programs.json');
  const outputDirectory = process.env.PROGRAM_BOARD_SEARCH_DIR
    ? path.resolve(process.env.PROGRAM_BOARD_SEARCH_DIR)
    : path.join(backendDirectory, '.local', 'program-board-search');
  const input = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as {
    count: number;
    items: Array<{ normalized: Parameters<typeof buildSearchDocuments>[0][number] }>;
  };
  const attachmentPath = process.env.PROGRAM_ATTACHMENT_SAMPLES_PATH
    ? path.resolve(process.env.PROGRAM_ATTACHMENT_SAMPLES_PATH)
    : path.join(backendDirectory, '.local', 'program-attachment-enrichment', 'merged-samples.json');
  const attachmentInput = JSON.parse(fs.readFileSync(attachmentPath, 'utf8')) as { items: Array<Record<string, any>> };
  const baseSources = input.items.map((item) => ({ ...item.normalized, sourceType: 'text' as const }));
  const attachmentSources = attachmentInput.items.map((item) => {
    const basic = Object.fromEntries((item.basicInfo || []).map((entry: { label: string; value: string }) => [entry.label, entry.value]));
    return {
      sourceId: item.sourceId,
      sourceUrl: `https://www.geumjeong.go.kr/booking/index.geumj?menuCd=DOM_000000901008000000&mode=view&idx=${item.sourceId}`,
      title: item.title,
      targetGroup: null,
      targetDetail: basic['대상'] || null,
      libraryName: basic['운영 도서관'] || null,
      description: null,
      board: { intro: item.board?.intro || [], sections: item.board?.sections || [] },
      curriculum: item.curriculum || [],
      sourceType: 'attachment' as const,
    };
  });
  const sources = [...baseSources, ...attachmentSources];
  if (!sources.length || new Set(sources.map((source) => source.sourceId)).size !== sources.length) {
    throw new Error('unified semantic search corpus is empty or contains duplicate sourceId');
  }
  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const profile of profiles) {
    const documents = buildSearchDocuments(sources, profile);
    fs.writeFileSync(
      path.join(outputDirectory, `documents.${profile}.json`),
      `${JSON.stringify({ schemaVersion: 'program-board-search/v1', profile, count: documents.length, documents }, null, 2)}\n`,
      'utf8',
    );
  }
  console.log(JSON.stringify({ inputPath, attachmentPath, outputDirectory, baseCount: baseSources.length, attachmentCount: attachmentSources.length, count: sources.length, profiles }, null, 2));
}

main();
