import { Router, type Request, type Response } from 'express';
import { Prisma } from '@prisma/client';
import { authenticateJwt } from '../middleware/auth';
import { prisma } from '../lib/prisma';

const router = Router();

const programSelect = {
  sourceId: true,
  title: true,
  libraryName: true,
  targetGroup: true,
  sourceUrl: true,
  programStartDate: true,
  programEndDate: true,
  applyStartDate: true,
  applyEndDate: true,
} as const;

function readSourceId(value: string) {
  const sourceId = Number(value);
  return Number.isInteger(sourceId) && sourceId > 0 ? sourceId : null;
}

router.use(authenticateJwt);

router.get('/', async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });

  try {
    const favorites = await prisma.userFavoriteProgram.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, program: { select: programSelect } },
    });
    return res.json({
      programs: favorites.map(({ program, createdAt }) => ({ ...program, favoritedAt: createdAt.toISOString() })),
    });
  } catch (error) {
    console.error('Favorite program lookup failed:', error);
    return res.status(500).json({ code: 'FAVORITE_PROGRAM_LOOKUP_FAILED', error: 'Unable to load favorite programs.' });
  }
});

router.get('/:sourceId', async (req: Request<{ sourceId: string }>, res: Response) => {
  if (!req.user) return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });
  const programSourceId = readSourceId(req.params.sourceId);
  if (!programSourceId) return res.status(400).json({ code: 'INVALID_SOURCE_ID', error: 'sourceId must be a positive integer.' });
  const favorite = await prisma.userFavoriteProgram.findUnique({
    where: { userId_programSourceId: { userId: req.user.id, programSourceId } },
  });
  return res.json({ favorited: Boolean(favorite) });
});

router.put('/:sourceId', async (req: Request<{ sourceId: string }>, res: Response) => {
  if (!req.user) return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });
  const programSourceId = readSourceId(req.params.sourceId);
  if (!programSourceId) return res.status(400).json({ code: 'INVALID_SOURCE_ID', error: 'sourceId must be a positive integer.' });

  try {
    await prisma.userFavoriteProgram.upsert({
      where: { userId_programSourceId: { userId: req.user.id, programSourceId } },
      update: {},
      create: { userId: req.user.id, programSourceId },
    });
    return res.json({ favorited: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
      return res.status(404).json({ code: 'PROGRAM_NOT_FOUND', error: 'Program not found.' });
    }
    console.error('Favorite program save failed:', error);
    return res.status(500).json({ code: 'FAVORITE_PROGRAM_SAVE_FAILED', error: 'Unable to save favorite program.' });
  }
});

router.delete('/:sourceId', async (req: Request<{ sourceId: string }>, res: Response) => {
  if (!req.user) return res.status(401).json({ code: 'AUTHENTICATION_REQUIRED', error: 'Authentication required.' });
  const programSourceId = readSourceId(req.params.sourceId);
  if (!programSourceId) return res.status(400).json({ code: 'INVALID_SOURCE_ID', error: 'sourceId must be a positive integer.' });
  await prisma.userFavoriteProgram.deleteMany({ where: { userId: req.user.id, programSourceId } });
  return res.json({ favorited: false });
});

export default router;
