import { Router } from 'express';
import { searchProgramCases } from '../services/programCaseSemanticSearchService';

const router = Router();

router.get('/semantic-search', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const requestedLimit = typeof req.query.limit === 'string'
    ? Number.parseInt(req.query.limit, 10)
    : 5;

  if (!query) {
    return res.status(400).json({ error: 'query parameter q is required' });
  }

  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 5)
    : 5;

  try {
    const results = await searchProgramCases(query, limit);
    return res.json({ results });
  } catch {
    console.error('ProgramCase semantic search failed');
    return res.status(500).json({ error: 'semantic search failed' });
  }
});

export default router;
