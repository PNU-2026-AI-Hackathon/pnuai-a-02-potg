import dotenv from 'dotenv';
dotenv.config();
import express, { Request, Response } from 'express';
import cors from 'cors';
import announcementsRouter from './routes/announcements';
import authRouter from './routes/auth';
import librariesRouter from './routes/libraries';
import programsRouter from './routes/programs';
import postsRouter from './routes/posts';
import volunteersRouter from './routes/volunteers';
import agendaRouter from './routes/agenda';
import searchRouter from './routes/search';
import { announcements, libraries, programs, volunteers, agendaItems } from './data/mockData';

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors({ origin: ['http://localhost:3000', 'http://127.0.0.1:3000'] }));
app.use(express.json());

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'PNUAI backend is running' });
});

app.get('/api/summary', (_req: Request, res: Response) => {
  res.json({
    libraries: libraries.length,
    programs: programs.length,
    agendaItems: agendaItems.length,
    volunteerMatches: volunteers.length,
  });
});

app.use('/api/announcements', announcementsRouter);
app.use('/api/auth', authRouter);
app.use('/api/libraries', librariesRouter);
app.use('/api/programs', programsRouter);
app.use('/api/posts', postsRouter);
app.use('/api/volunteers', volunteersRouter);
app.use('/api/agenda', agendaRouter);
app.use('/api/search', searchRouter);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'API route not found' });
});

app.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});
