import { Router } from 'express';
import { syncProgramCasesController } from '../controllers/programCaseSyncController';
import { requireInternalApiKey } from '../middleware/internalApiKey';

const router = Router();

router.post('/sync', requireInternalApiKey, syncProgramCasesController);

export default router;
