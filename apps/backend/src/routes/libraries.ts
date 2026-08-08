import { Router } from 'express';
import { libraries } from '../data/mockData';

const router = Router();

router.get('/', (_req, res) => {
  res.json(libraries);
});

router.get('/:id', (req, res) => {
  const library = libraries.find((item) => item.id === req.params.id);
  if (!library) {
    return res.status(404).json({ error: 'Library not found' });
  }

  res.json(library);
});

export default router;
