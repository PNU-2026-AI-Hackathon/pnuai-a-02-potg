import { Router } from 'express';
import { agendaItems } from '../data/mockData';

const router = Router();

router.get('/', (_req, res) => {
  res.json(agendaItems);
});

router.get('/:id', (req, res) => {
  const agenda = agendaItems.find((item) => item.id === req.params.id);
  if (!agenda) {
    return res.status(404).json({ error: 'Agenda item not found' });
  }

  res.json(agenda);
});

export default router;
