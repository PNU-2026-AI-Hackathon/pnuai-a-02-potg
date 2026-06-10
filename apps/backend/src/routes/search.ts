import { Router } from 'express';
import { searchAll } from '../data/mockData';

const router = Router();

router.get('/', (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const type = typeof req.query.type === 'string' ? req.query.type.toLowerCase() : undefined;

  if (!query) {
    return res.status(400).json({ error: 'query parameter q is required' });
  }

  const results = searchAll(query, type);
  res.json(results);
});

export default router;
