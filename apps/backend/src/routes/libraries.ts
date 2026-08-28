import { Router, type Request, type Response } from 'express';
import { geumjeongLibraries, type GeumjeongLibrary, type LibraryKind } from '../data/geumjeongLibraries';
import { prisma } from '../lib/prisma';

const router = Router();

type RecentProgram = {
  sourceId: number;
  title: string;
  libraryName: string | null;
  targetGroup: string | null;
  sourceUrl: string;
  occurrenceLabel: string | null;
  capacity: number | null;
  capacityText: string | null;
  programStartDate: string | null;
  programEndDate: string | null;
  applyStartDate: string | null;
  applyEndDate: string | null;
};

type LibraryResponse = GeumjeongLibrary & {
  kindLabel: string;
  recentPrograms: RecentProgram[];
};

const KIND_LABELS: Record<LibraryKind, string> = {
  PUBLIC_LIBRARY: '공공도서관',
  PUBLIC_SMALL: '공립 작은도서관',
  PRIVATE_SMALL: '사립 작은도서관',
};

const PROGRAM_SELECT = {
  sourceId: true,
  title: true,
  libraryName: true,
  targetGroup: true,
  sourceUrl: true,
  occurrenceLabel: true,
  capacity: true,
  capacityText: true,
  programStartDate: true,
  programEndDate: true,
  applyStartDate: true,
  applyEndDate: true,
} as const;

function readQuery(value: Request['query'][string]) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalize(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, '').toLowerCase();
}

function librarySearchText(library: GeumjeongLibrary) {
  return [
    library.name,
    library.kind,
    KIND_LABELS[library.kind],
    library.district,
    library.address,
    library.geocodeAddress,
    ...(library.aliases ?? []),
  ]
    .join(' ')
    .toLowerCase();
}

function matchesQuery(library: GeumjeongLibrary, query: string) {
  if (!query) return true;

  const normalizedQuery = query.toLowerCase();
  const compactQuery = normalize(query);

  return librarySearchText(library).includes(normalizedQuery) || normalize(librarySearchText(library)).includes(compactQuery);
}

function matchesLibrary(program: RecentProgram, library: GeumjeongLibrary) {
  const programLibraryName = normalize(program.libraryName);
  if (!programLibraryName) return false;

  const candidates = [library.name, ...(library.aliases ?? [])].map(normalize).filter(Boolean);

  return candidates.some((candidate) => programLibraryName.includes(candidate) || candidate.includes(programLibraryName));
}

async function loadRecentPrograms() {
  try {
    return await prisma.programBoardEntry.findMany({
      select: PROGRAM_SELECT,
      orderBy: [{ applyStartDate: 'desc' }, { sourceId: 'desc' }],
      take: 500,
    });
  } catch (error) {
    console.warn('Library recent programs unavailable:', error);
    return [];
  }
}

function serializeLibrary(library: GeumjeongLibrary, programs: RecentProgram[]): LibraryResponse {
  return {
    ...library,
    kindLabel: KIND_LABELS[library.kind],
    recentPrograms: programs.filter((program) => matchesLibrary(program, library)).slice(0, 3),
  };
}

router.get('/', async (req: Request, res: Response) => {
  const query = readQuery(req.query.q);
  const programs = await loadRecentPrograms();
  const libraries = geumjeongLibraries
    .filter((library) => matchesQuery(library, query))
    .map((library) => serializeLibrary(library, programs));

  res.json({ libraries, total: libraries.length, query });
});

router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  const library = geumjeongLibraries.find((item) => item.id === req.params.id);
  if (!library) {
    return res.status(404).json({ error: 'Library not found' });
  }

  const programs = await loadRecentPrograms();
  res.json({ library: serializeLibrary(library, programs) });
});

export default router;
