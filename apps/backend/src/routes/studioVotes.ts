import { randomUUID } from 'crypto';
import { Request, Response, Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticateOptionalJwt } from '../middleware/auth';

type VoteDocumentRow = {
  id: string;
  title: string;
  content: string;
  updatedAt: Date;
  voteCount: bigint;
  hasVoted: boolean;
  myIntention: string | null;
  myTimeSlot: string | null;
};

const intentions = new Set(['꼭 참여하고 싶어요', '일정이 맞으면 참여하고 싶어요', '관심은 있지만 참여는 어려워요', '관심이 없어요']);
const timeSlots = new Set(['평일 오전', '평일 오후', '평일 저녁', '주말']);

const router = Router();
router.use(authenticateOptionalJwt);

function voterKey(req: Request) {
  if (req.user?.id) return `user:${req.user.id}`;
  const anonymousId = req.header('x-studio-anonymous-voter-id')?.trim();
  return anonymousId ? `anonymous:${anonymousId}` : null;
}

async function listVotingDocuments(key: string | null, documentId?: string) {
  return prisma.$queryRaw<VoteDocumentRow[]>`
    SELECT d.id, d.title, d.content, d."updatedAt",
      COUNT(v.id)::bigint AS "voteCount",
      COALESCE(BOOL_OR(v."voterKey" = ${key}), false) AS "hasVoted",
      MAX(v.intention) FILTER (WHERE v."voterKey" = ${key}) AS "myIntention",
      MAX(v."timeSlot") FILTER (WHERE v."voterKey" = ${key}) AS "myTimeSlot"
    FROM "StudioDocument" d
    LEFT JOIN "StudioDocumentVote" v ON v."studioDocumentId" = d.id
    WHERE d.stage = '수요조사 중'
      AND (${documentId ?? null}::text IS NULL OR d.id = ${documentId ?? null})
    GROUP BY d.id
    ORDER BY "voteCount" DESC, d."updatedAt" DESC
  `;
}

function serialize(row: VoteDocumentRow) {
  return { ...row, voteCount: Number(row.voteCount), updatedAt: row.updatedAt.toISOString() };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const documents = await listVotingDocuments(voterKey(req));
    return res.json({ documents: documents.map(serialize) });
  } catch (error) {
    console.error('Studio vote list lookup failed:', error);
    return res.status(500).json({ code: 'STUDIO_VOTE_LIST_FAILED', error: 'Unable to load voting documents.' });
  }
});

router.get('/:documentId', async (req: Request<{ documentId: string }>, res: Response) => {
  try {
    const [document] = await listVotingDocuments(voterKey(req), req.params.documentId);
    if (!document) return res.status(404).json({ code: 'VOTING_DOCUMENT_NOT_FOUND', error: 'Voting document not found.' });
    return res.json({ document: serialize(document) });
  } catch (error) {
    console.error('Studio vote detail lookup failed:', error);
    return res.status(500).json({ code: 'STUDIO_VOTE_DETAIL_FAILED', error: 'Unable to load voting document.' });
  }
});

router.post('/:documentId', async (req: Request<{ documentId: string }>, res: Response) => {
  const key = voterKey(req);
  if (!key) return res.status(401).json({ code: 'VOTER_REQUIRED', error: 'Voter identifier is required.' });
  const intention = typeof req.body.intention === 'string' ? req.body.intention.trim() : '';
  const timeSlot = typeof req.body.timeSlot === 'string' ? req.body.timeSlot.trim() : '';
  if (!intentions.has(intention) || (timeSlot && !timeSlots.has(timeSlot))) {
    return res.status(400).json({ code: 'INVALID_VOTE', error: 'intention or timeSlot is invalid.' });
  }

  try {
    const inserted = await prisma.$executeRaw`
      INSERT INTO "StudioDocumentVote" (id, "studioDocumentId", "voterKey", intention, "timeSlot")
      SELECT ${randomUUID()}, id, ${key}, ${intention}, ${timeSlot || null}
      FROM "StudioDocument"
      WHERE id = ${req.params.documentId} AND stage = '수요조사 중'
      ON CONFLICT ("studioDocumentId", "voterKey") DO UPDATE
      SET intention = EXCLUDED.intention, "timeSlot" = EXCLUDED."timeSlot"
    `;
    const [document] = await listVotingDocuments(key, req.params.documentId);
    if (!document) return res.status(404).json({ code: 'VOTING_DOCUMENT_NOT_FOUND', error: 'Voting document not found.' });
    return res.status(inserted ? 201 : 200).json({ document: serialize(document) });
  } catch (error) {
    console.error('Studio vote creation failed:', error);
    return res.status(500).json({ code: 'STUDIO_VOTE_CREATE_FAILED', error: 'Unable to save vote.' });
  }
});

router.delete('/:documentId', async (req: Request<{ documentId: string }>, res: Response) => {
  const key = voterKey(req);
  if (!key) return res.status(401).json({ code: 'VOTER_REQUIRED', error: 'Voter identifier is required.' });

  try {
    await prisma.$executeRaw`
      DELETE FROM "StudioDocumentVote"
      WHERE "studioDocumentId" = ${req.params.documentId} AND "voterKey" = ${key}
    `;
    const [document] = await listVotingDocuments(key, req.params.documentId);
    if (!document) return res.status(404).json({ code: 'VOTING_DOCUMENT_NOT_FOUND', error: 'Voting document not found.' });
    return res.json({ document: serialize(document) });
  } catch (error) {
    console.error('Studio vote cancellation failed:', error);
    return res.status(500).json({ code: 'STUDIO_VOTE_DELETE_FAILED', error: 'Unable to cancel vote.' });
  }
});

export default router;
