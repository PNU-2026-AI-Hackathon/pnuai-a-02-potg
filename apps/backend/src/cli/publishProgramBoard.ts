import fs from 'fs';
import path from 'path';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

/**
 * 정제 배치가 만든 programs.json 을 DB로 올린다.
 *
 * 그동안 프런트가 이 파일을 직접 읽었다. 두 앱이 한 기계에 있을 때만 되는 방식이라,
 * 프런트만 따로 배포하면 파일이 없어 게시판이 빈 채로 열린다. 파일은 배치 산출물로 두되
 * 화면이 보는 창구는 DB 한 곳으로 모은다.
 *
 * 배치는 매번 전체를 다시 만들므로 이 명령도 전체를 기준으로 맞춘다. 새 파일에 없는
 * sourceId 는 지워야, 정제에서 빠지기로 한 건이 게시판에 남지 않는다.
 */

const DEFAULT_BOARD_FILE = path.resolve(process.cwd(), '.local', 'program-board', 'programs.json');

type BoardEntryPayload = {
  sourceId: number;
  seriesKey: string;
  title: string;
  libraryName: string | null;
  targetGroup: string | null;
  sourceUrl: string;
  occurrenceLabel: string | null;
  capacity: number | null;
  programStartDate: string | null;
  programEndDate: string | null;
  applyStartDate: string | null;
  applyEndDate: string | null;
  evidence: { capacityText: string | null };
};

type BoardFile = { items: Array<{ normalized: BoardEntryPayload & Record<string, unknown> }> };

function readBoardFile(file: string): BoardFile {
  if (!fs.existsSync(file)) {
    throw new Error(
      `프로그램 게시판 데이터 파일이 없습니다: ${file}\n` +
        '먼저 `npm run program-board:build -- --profile all` 로 만들어 주세요.',
    );
  }

  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as BoardFile;

  if (!Array.isArray(parsed.items)) {
    throw new Error(`items 배열이 없습니다: ${file}`);
  }

  return parsed;
}

export async function publishProgramBoard(file = DEFAULT_BOARD_FILE) {
  const board = readBoardFile(file);
  const entries = board.items.map(({ normalized }) => normalized);

  for (const entry of entries) {
    const row = {
      seriesKey: entry.seriesKey,
      title: entry.title,
      libraryName: entry.libraryName,
      targetGroup: entry.targetGroup,
      sourceUrl: entry.sourceUrl,
      occurrenceLabel: entry.occurrenceLabel,
      capacity: entry.capacity,
      capacityText: entry.evidence?.capacityText ?? null,
      programStartDate: entry.programStartDate,
      programEndDate: entry.programEndDate,
      applyStartDate: entry.applyStartDate,
      applyEndDate: entry.applyEndDate,
      payload: entry as unknown as Prisma.InputJsonValue,
    };

    await prisma.programBoardEntry.upsert({
      where: { sourceId: entry.sourceId },
      create: { sourceId: entry.sourceId, ...row },
      update: row,
    });
  }

  const removed = await prisma.programBoardEntry.deleteMany({
    where: { sourceId: { notIn: entries.map((entry) => entry.sourceId) } },
  });

  return { file, published: entries.length, removed: removed.count };
}

export async function main(args = process.argv.slice(2)) {
  const fileIndex = args.indexOf('--file');
  const file = fileIndex >= 0 ? path.resolve(args[fileIndex + 1]) : DEFAULT_BOARD_FILE;
  const result = await publishProgramBoard(file);

  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
