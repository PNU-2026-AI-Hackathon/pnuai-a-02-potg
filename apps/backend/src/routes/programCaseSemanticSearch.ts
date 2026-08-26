import { Router } from 'express';
import { searchProgramCases } from '../services/programCaseSemanticSearchService';
import { compareProgramCaseSearch } from '../services/programCaseSearchProfileService';
import { searchProgramCaseStudioContext, STUDIO_AUDIENCE_FILTERS } from '../services/programCaseStudioContext';

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
    return res.json({ results: results.map((result) => ({
      rank: result.rank,
      programTitle: result.programTitle,
      similarity: result.similarity,
      chunkType: result.chunkType,
      programCaseId: result.programCaseId,
    })) });
  } catch {
    console.error('ProgramCase semantic search failed');
    return res.status(500).json({ error: 'semantic search failed' });
  }
});

router.get('/studio-context', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const audience = typeof req.query.audience === 'string' ? req.query.audience : undefined;
  if (!query || query.length > 1000) {
    return res.status(400).json({ error: 'query parameter q must contain 1-1000 characters' });
  }
  if (audience && !STUDIO_AUDIENCE_FILTERS.has(audience)) {
    return res.status(400).json({ error: 'unsupported audience filter' });
  }

  try {
    const context = await searchProgramCaseStudioContext(query, audience);
    if (!context.resultCount) {
      return res.status(404).json({ error: '유사 프로그램 사례를 찾지 못했습니다.' });
    }
    return res.json({
      query: context.query,
      resultCount: context.resultCount,
      source: context.search.source,
      markdown: context.markdown,
      candidateCount: context.search.candidateCount,
      eligibleCount: context.search.eligibleCount,
      results: context.search.results.map((result) => ({
        rank: result.rank,
        sourceId: result.sourceId,
        title: result.title,
        target: result.target,
        similarity: result.similarity,
        rankingScore: result.rankingScore,
        conceptCoverage: result.conceptCoverage,
        audienceMatch: result.audienceMatch,
      })),
    });
  } catch (error) {
    console.error('ProgramCase Studio context search failed', error);
    return res.status(500).json({ error: 'pgvector context search failed' });
  }
});

router.get('/search-profile-pilot', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!query || query.length > 1000) {
    return res.status(400).json({ error: 'query parameter q must contain 1-1000 characters' });
  }
  try {
    return res.json(await compareProgramCaseSearch(query, 5));
  } catch {
    console.error('ProgramCase SearchProfile pilot search failed');
    return res.status(500).json({ error: 'search profile pilot failed' });
  }
});

export default router;
