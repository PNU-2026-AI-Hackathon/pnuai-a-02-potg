import { Router } from 'express';
import { SearchProfileKind } from '../services/programBoardSemanticSearch/profileBuilder';
import { buildProgramBoardContext, searchProgramBoard } from '../services/programBoardSemanticSearch/searchService';

const router = Router();
const profiles = new Set<SearchProfileKind>([
  'title', 'title+intro', 'title+intro+target', 'title+intro+target+curriculum',
]);
/**
 * 한 번에 돌려줄 수 있는 결과 수의 상한.
 * 파일럿은 코퍼스가 17건이라 그 수를 그대로 썼다. 검색 대상이 300건으로 늘었으므로
 * 코퍼스 크기에 매이지 않는 값으로 둔다. 파이썬 쪽 `MAX_RESULT_LIMIT`과 같아야 한다.
 */
const MAX_RESULT_LIMIT = 50;
/** 사서가 스튜디오에서 고를 수 있는 대상. 파이썬 쪽 `AUDIENCE_FILTERS`와 같아야 한다. */
const AUDIENCE_FILTERS = new Set(['preschool', 'elementary-lower', 'elementary-upper', 'adult', 'everyone']);

router.get('/search', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const requestedLimit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 5;
  const requestedProfile = typeof req.query.profile === 'string' ? req.query.profile : 'title+intro+target';
  if (!query || query.length > 1000) {
    return res.status(400).json({ error: 'query parameter q must contain 1-1000 characters' });
  }
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > MAX_RESULT_LIMIT) {
    return res.status(400).json({ error: `limit must be an integer between 1 and ${MAX_RESULT_LIMIT}` });
  }
  if (!profiles.has(requestedProfile as SearchProfileKind)) {
    return res.status(400).json({ error: 'unsupported search profile' });
  }
  const audience = typeof req.query.audience === 'string' ? req.query.audience : undefined;
  if (audience && !AUDIENCE_FILTERS.has(audience)) {
    return res.status(400).json({ error: 'unsupported audience filter' });
  }
  try {
    return res.json(await searchProgramBoard(query, requestedLimit, requestedProfile as SearchProfileKind, audience));
  } catch (error) {
    console.error('Program board semantic search failed', error);
    return res.status(500).json({ error: 'program board semantic search failed' });
  }
});

router.get('/context', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : 3;
  const audience = typeof req.query.audience === 'string' ? req.query.audience : undefined;
  if (!query || query.length > 1000 || !Number.isInteger(limit) || limit < 1 || limit > 5) {
    return res.status(400).json({ error: 'q and an integer limit between 1 and 5 are required' });
  }
  if (audience && !AUDIENCE_FILTERS.has(audience)) {
    return res.status(400).json({ error: 'unsupported audience filter' });
  }
  try {
    return res.json(await buildProgramBoardContext(query, limit, audience));
  } catch (error) {
    console.error('Program board context generation failed', error);
    return res.status(500).json({ error: 'program board context generation failed' });
  }
});

export default router;
