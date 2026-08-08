import { Router } from 'express';
import { volunteers } from '../data/mockData';

const router = Router();

router.get('/', (_req, res) => {
  res.json(volunteers);
});

router.get('/:id', (req, res) => {
  const volunteer = volunteers.find((item) => item.id === req.params.id);
  if (!volunteer) {
    return res.status(404).json({ error: 'Volunteer item not found' });
  }

  res.json(volunteer);
});

export default router;
