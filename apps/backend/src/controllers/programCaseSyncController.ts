import { Request, Response } from 'express';
import { syncProgramCases } from '../services/programCaseSyncService';
import { validateProgramCaseSyncRequest } from '../validators/programCaseSync';

export async function syncProgramCasesController(req: Request, res: Response) {
  const validation = validateProgramCaseSyncRequest(req.body);
  if (!validation.ok) {
    return res.status(400).json({
      code: 'INVALID_PROGRAM_CASE_SYNC_REQUEST',
      error: 'Program case sync request validation failed.',
      issues: validation.issues,
    });
  }

  try {
    const result = await syncProgramCases(validation.programs);
    console.info('Program case sync completed', {
      total: result.total,
      succeeded: result.succeeded,
      failed: result.failed,
      created: result.created,
      updated: result.updated,
      sessions: result.sessions,
      attachments: result.attachments,
      failedPostIds: result.failures.map((failure) => failure.sourcePostId),
      durationMs: result.durationMs,
    });
    return res.status(result.failed > 0 ? 207 : 200).json(result);
  } catch (error) {
    console.error('Program case sync request failed:', error instanceof Error ? error.name : 'UnknownError');
    return res.status(500).json({
      code: 'PROGRAM_CASE_SYNC_FAILED',
      error: 'Unable to synchronize program cases.',
    });
  }
}
