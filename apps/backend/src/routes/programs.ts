import { Router } from 'express';
import { programs } from '../data/mockData';

const router = Router();

router.get('/', (_req, res) => {
  res.json(programs);
});

router.get('/:id', (req, res) => {
  const program = programs.find((item) => item.id === req.params.id);
  if (!program) {
    return res.status(404).json({ error: 'Program not found' });
  }

  res.json(program);
});

export default router;
