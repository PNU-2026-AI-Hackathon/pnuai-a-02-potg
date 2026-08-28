import dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response } from 'express';
import cors from 'cors';
import announcementsRouter from './routes/announcements';
import authRouter from './routes/auth';
import librariesRouter from './routes/libraries';
import interestsRouter from './routes/interests';
import programsRouter from './routes/programs';
import postsRouter from './routes/posts';
import volunteersRouter from './routes/volunteers';
import agendaRouter from './routes/agenda';
import searchRouter from './routes/search';
import internalProgramCasesRouter from './routes/internalProgramCases';
import programCaseSemanticSearchRouter from './routes/programCaseSemanticSearch';
import programCaseSearchInspectorRouter from './routes/programCaseSearchInspector';
import programCaseSearchRouter from './routes/programCaseSearch';
import meRouter from './routes/me';
import studioDocumentsRouter from './routes/studioDocuments';
import studioVotesRouter from './routes/studioVotes';
import programBoardSemanticSearchRouter from './routes/programBoardSemanticSearch';
import programBoardEntriesRouter from './routes/programBoardEntries';
import programFavoritesRouter from './routes/programFavorites';
import { announcements, programs, volunteers, agendaItems } from './data/mockData';
import { geumjeongLibraries } from './data/geumjeongLibraries';
import { prisma } from './lib/prisma';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

const LOCAL_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

/**
 * 브라우저가 이 서버를 직접 부르는 곳은 지금 없다. 프런트는 자기 쪽 API 경로를 거쳐
 * 서버끼리 부르고, 서버끼리는 CORS를 타지 않는다. 그래도 배포 주소를 열어 두는 것은
 * 나중에 한 곳이라도 브라우저에서 직접 부르게 됐을 때 원인 찾기 어려운 실패로
 * 나타나기 때문이다. 아무 데나 열지는 않고 정확한 주소만 받는다.
 */
function allowedOrigins() {
  const configured = (process.env.FRONTEND_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter((origin) => origin.length > 0);

  return [...new Set([...LOCAL_ORIGINS, ...configured])];
}

app.use(cors({ origin: allowedOrigins(), credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'PNUAI backend is running' });
});

/**
 * 배포한 뒤 「프런트가 백엔드에 닿는가」와 「백엔드가 DB에 닿는가」는 다른 문제다.
 * 둘을 한 번에 가르지 못하면 화면이 비었을 때 어디를 봐야 할지 알 수 없어 창구를 따로 둔다.
 */
app.get('/api/health/db', async (_req: Request, res: Response) => {
  try {
    const [{ count }] = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM "ProgramBoardEntry"
    `;

    return res.json({ status: 'ok', programBoardEntries: Number(count) });
  } catch (error) {
    console.error('Database health check failed:', error);

    return res.status(503).json({
      status: 'error',
      code: 'DATABASE_UNREACHABLE',
      error: 'Backend cannot reach the database or the schema is not migrated.',
    });
  }
});

app.get('/api/summary', (_req: Request, res: Response) => {
  res.json({
    libraries: geumjeongLibraries.length,
    programs: programs.length,
    agendaItems: agendaItems.length,
    volunteerMatches: volunteers.length,
  });
});

app.use('/api/announcements', announcementsRouter);
app.use('/api/auth', authRouter);
app.use('/api/interests', interestsRouter);
app.use('/api/me', meRouter);
app.use('/api/libraries', librariesRouter);
app.use('/api/programs', programsRouter);
app.use('/api/posts', postsRouter);
app.use('/api/program-favorites', programFavoritesRouter);
app.use('/api/volunteers', volunteersRouter);
app.use('/api/agenda', agendaRouter);
app.use('/api/search', searchRouter);
app.use('/api/internal/program-cases', internalProgramCasesRouter);
app.use('/api/program-case', programCaseSemanticSearchRouter);
app.use('/api/internal/program-case-search-inspector', programCaseSearchInspectorRouter);
app.use('/api/internal/program-case-search', programCaseSearchRouter);
app.use('/api/studio/documents', studioDocumentsRouter);
app.use('/api/studio/votes', studioVotesRouter);
app.use('/api/program-board', programBoardSemanticSearchRouter);
app.use('/api/program-board', programBoardEntriesRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'API route not found' });
});

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});
