import { Router } from 'express';
import { ProgramCaseSearchInspector } from '../services/programCaseSearchCorpus/inspectorService';

const router = Router();
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_PROGRAM_CASE_SEARCH_INSPECTOR !== 'true') return res.status(404).json({ error: 'Inspector is disabled' });
  return next();
});

function service(res: any): ProgramCaseSearchInspector | null {
  try { return new ProgramCaseSearchInspector(); }
  catch { res.status(503).json({ error: 'Inspector artifacts are not built' }); return null; }
}

router.get('/summary', (_req, res) => { const value = service(res); if (value) res.json(value.summary()); });
router.get('/program-cases', (req, res) => { const value = service(res); if (value) res.json({ items: value.list(req.query as Record<string, string>) }); });
router.get('/program-cases/:id', (req, res) => { const value = service(res); const item = value?.programCase(req.params.id); if (value) item ? res.json(item) : res.status(404).json({ error: 'ProgramCase not found' }); });
router.get('/groups/:id', (req, res) => { const value = service(res); const item = value?.group(req.params.id); if (value) item ? res.json(item) : res.status(404).json({ error: 'Group not found' }); });
router.get('/corpus/:id', (req, res) => { const value = service(res); const item = value?.corpus(req.params.id); if (value) item ? res.json(item) : res.status(404).json({ error: 'Corpus not found' }); });
router.get('/sources/:sha', (req, res) => { const value = service(res); const item = value?.source(req.params.sha); if (value) item ? res.json(item) : res.status(404).json({ error: 'Source not found' }); });
router.get('/assets/:sha', (req, res) => {
  const value = service(res); const item = value?.asset(req.params.sha);
  if (!value) return;
  if (!item) return res.status(404).json({ error: 'Asset not found' });
  const mime = item.fileType === 'PDF' ? 'application/pdf' : item.fileType === 'PNG' ? 'image/png' : item.fileType === 'JPEG' ? 'image/jpeg' : 'application/octet-stream';
  res.type(mime).sendFile(item.file);
});

export default router;
