import { Router } from 'express';
import { announcements } from '../data/mockData';

const router = Router();

router.get('/', (_req, res) => {
  res.json(announcements);
});

export default router;
