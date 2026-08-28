import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticateOptionalJwt } from '../middleware/auth';

type StudioDocumentStage = '기획 중' | '수요조사 중' | '수요조사 완료' | '기획서 확정';

type StudioDocumentRow = {
  id: string;
  ownerId: string | null;
  anonymousOwnerId: string | null;
  title: string;
  content: string;
  stage: StudioDocumentStage;
  conditions: Prisma.JsonValue | null;
  agenda: Prisma.JsonValue | null;
  /**
   * 기획서의 항목 구조. 본문(content)은 사람이 읽는 글이라 다시 항목으로 쪼갤 수 없어,
   * 항목 하나만 고치려면 이 구조가 문서와 함께 남아 있어야 한다.
   */
  plan: Prisma.JsonValue | null;
  surveyResult: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateStudioDocumentBody = {
  title?: string;
  content?: string;
  stage?: unknown;
  conditions?: unknown;
  agenda?: unknown;
  plan?: unknown;
  surveyResult?: unknown;
};

type UpdateStudioDocumentBody = {
  title?: string;
  content?: string;
  stage?: unknown;
  plan?: unknown;
  surveyResult?: unknown;
};

const router = Router();
const validStages = new Set<StudioDocumentStage>(['기획 중', '수요조사 중', '수요조사 완료', '기획서 확정']);
const surveyIntentions = ['꼭 참여하고 싶어요', '일정이 맞으면 참여하고 싶어요', '관심은 있지만 참여는 어려워요', '관심이 없어요'];
const surveyTimeSlots = ['평일 오전', '평일 오후', '평일 저녁', '주말'];
let ensureTablePromise: Promise<void> | null = null;

router.use(authenticateOptionalJwt);

function ensureStudioDocumentTable() {
  ensureTablePromise ??= (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StudioDocument" (
        "id" TEXT NOT NULL,
        "ownerId" TEXT,
        "anonymousOwnerId" TEXT,
        "title" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "stage" TEXT NOT NULL DEFAULT '기획 중',
        "conditions" JSONB,
        "agenda" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "StudioDocument_pkey" PRIMARY KEY ("id")
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StudioDocument_ownerId_updatedAt_idx"
      ON "StudioDocument"("ownerId", "updatedAt")
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "StudioDocument"
      ADD COLUMN IF NOT EXISTS "anonymousOwnerId" TEXT
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StudioDocument_anonymousOwnerId_updatedAt_idx"
      ON "StudioDocument"("anonymousOwnerId", "updatedAt")
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "StudioDocument"
      ADD COLUMN IF NOT EXISTS "plan" JSONB
    `);
    /**
     * 로그인하지 않은 사람의 기획서는 ownerId 가 비어 있다. 예전 마이그레이션이 이 열을
     * NOT NULL 로 묶어 둔 DB가 있어, 그대로 두면 익명 저장이 23502 로 떨어진다.
     */
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "StudioDocument"
      ALTER COLUMN "ownerId" DROP NOT NULL
    `);
    /**
     * 주인이 탈퇴해도 문서는 남기고 주인만 지운다. 예전 제약은 CASCADE 였는데,
     * 그대로면 사람을 지울 때 그 사람이 만든 기획서까지 함께 사라진다.
     */
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "StudioDocument"
      ADD COLUMN IF NOT EXISTS "surveyResult" JSONB
    `);
    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'StudioDocument_ownerId_fkey'
            AND confdeltype <> 'n'
        ) THEN
          ALTER TABLE "StudioDocument"
          DROP CONSTRAINT "StudioDocument_ownerId_fkey";
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'StudioDocument_ownerId_fkey'
        ) THEN
          ALTER TABLE "StudioDocument"
          ADD CONSTRAINT "StudioDocument_ownerId_fkey"
          FOREIGN KEY ("ownerId") REFERENCES "User"("id")
          ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$
    `);
  })();

  return ensureTablePromise;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getOwnerScope(req: Request) {
  if (req.user?.id) {
    return {
      ownerId: req.user.id,
      anonymousOwnerId: null,
    };
  }

  const anonymousOwnerId = readString(req.header('x-studio-anonymous-owner-id'));

  return {
    ownerId: null,
    anonymousOwnerId: anonymousOwnerId || null,
  };
}

function hasOwnerScope(scope: { ownerId: string | null; anonymousOwnerId: string | null }) {
  return Boolean(scope.ownerId || scope.anonymousOwnerId);
}

function isStudioDocumentStage(value: unknown): value is StudioDocumentStage {
  return typeof value === 'string' && validStages.has(value as StudioDocumentStage);
}

function createPreview(content: string) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 96);
}

function readConditionValue(conditions: Prisma.JsonValue | null, key: string) {
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) {
    return '';
  }

  const value = (conditions as Record<string, unknown>)[key];

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).join(', ')
    : '';
}

function serializeStudioDocument(document: StudioDocumentRow, surveyResult: Prisma.JsonValue | null = document.surveyResult) {
  return {
    id: document.id,
    title: document.title,
    content: document.content,
    preview: createPreview(document.content),
    stage: document.stage,
    category: readConditionValue(document.conditions, 'category'),
    audience: readConditionValue(document.conditions, 'audience'),
    period: readConditionValue(document.conditions, 'period'),
    conditions: document.conditions,
    agenda: document.agenda,
    plan: document.plan,
    surveyResult,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function liveSurveyResult(documentId: string): Promise<Prisma.JsonObject> {
  type CountRow = { label: string | null; count: bigint };
  const [intentionRows, timeSlotRows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT intention AS label, COUNT(*)::bigint AS count
      FROM "StudioDocumentVote"
      WHERE "studioDocumentId" = ${documentId}
      GROUP BY intention
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT "timeSlot" AS label, COUNT(*)::bigint AS count
      FROM "StudioDocumentVote"
      WHERE "studioDocumentId" = ${documentId} AND "timeSlot" IS NOT NULL
      GROUP BY "timeSlot"
    `,
  ]);

  const intentionCounts = new Map(intentionRows.map((row) => [row.label, Number(row.count)]));
  const timeSlotCounts = new Map(timeSlotRows.map((row) => [row.label, Number(row.count)]));
  const respondents = [...intentionCounts.values()].reduce((sum, count) => sum + count, 0);
  const choice = (label: string, count: number) => ({
    label,
    count,
    ratio: respondents > 0 ? Math.round((count / respondents) * 100) : 0,
  });
  const intentionBreakdown = surveyIntentions.map((label) => choice(label, intentionCounts.get(label) ?? 0));
  const timeSlotBreakdown = surveyTimeSlots.map((label) => choice(label, timeSlotCounts.get(label) ?? 0));

  return {
    respondents,
    totalTarget: respondents,
    satisfaction: 0,
    topChoices: [...intentionBreakdown].sort((a, b) => b.count - a.count),
    intentionBreakdown,
    timeSlotBreakdown,
    comments: [],
    actionPoints: [],
  };
}

async function findScopedDocument(documentId: string, scope: { ownerId: string | null; anonymousOwnerId: string | null }) {
  const documents = await prisma.$queryRaw<StudioDocumentRow[]>`
    SELECT id, "ownerId", "anonymousOwnerId", title, content, stage, conditions, agenda, plan, "surveyResult", "createdAt", "updatedAt"
    FROM "StudioDocument"
    WHERE id = ${documentId}
      AND (
        (${scope.ownerId}::text IS NOT NULL AND "ownerId" = ${scope.ownerId})
        OR (
          ${scope.ownerId}::text IS NULL
          AND ${scope.anonymousOwnerId}::text IS NOT NULL
          AND "ownerId" IS NULL
          AND "anonymousOwnerId" = ${scope.anonymousOwnerId}
        )
      )
    LIMIT 1
  `;

  return documents[0] ?? null;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    await ensureStudioDocumentTable();
    const scope = getOwnerScope(req);

    if (!hasOwnerScope(scope)) {
      return res.status(401).json({ code: 'STUDIO_DOCUMENT_OWNER_REQUIRED', error: 'Studio document owner is required.' });
    }

    const documents = await prisma.$queryRaw<StudioDocumentRow[]>`
      SELECT id, "ownerId", "anonymousOwnerId", title, content, stage, conditions, agenda, plan, "surveyResult", "createdAt", "updatedAt"
      FROM "StudioDocument"
      WHERE
        (${scope.ownerId}::text IS NOT NULL AND "ownerId" = ${scope.ownerId})
        OR (
          ${scope.ownerId}::text IS NULL
          AND ${scope.anonymousOwnerId}::text IS NOT NULL
          AND "ownerId" IS NULL
          AND "anonymousOwnerId" = ${scope.anonymousOwnerId}
        )
      ORDER BY "updatedAt" DESC
    `;

    return res.status(200).json({ documents: documents.map(serializeStudioDocument) });
  } catch (error) {
    console.error('Studio document list lookup failed:', error);
    return res.status(500).json({ code: 'STUDIO_DOCUMENT_LIST_FAILED', error: 'Unable to load studio documents.' });
  }
});

router.post('/', async (req: Request<{}, {}, CreateStudioDocumentBody>, res: Response) => {
  const title = readString(req.body.title);
  const content = readString(req.body.content);
  const stage = req.body.stage === undefined ? '기획 중' : req.body.stage;
  const conditions = req.body.conditions ?? {};
  const agenda = req.body.agenda ?? null;
  const plan = req.body.plan ?? null;
  const surveyResult = req.body.surveyResult ?? null;

  if (!title || !content) {
    return res.status(400).json({ code: 'REQUIRED_FIELDS_MISSING', error: 'title and content are required.' });
  }

  if (!isStudioDocumentStage(stage)) {
    return res.status(400).json({ code: 'INVALID_STAGE', error: 'stage is invalid.' });
  }

  try {
    await ensureStudioDocumentTable();
    const documentId = randomUUID();
    const scope = getOwnerScope(req);

    if (!hasOwnerScope(scope)) {
      return res.status(401).json({ code: 'STUDIO_DOCUMENT_OWNER_REQUIRED', error: 'Studio document owner is required.' });
    }

    const documents = await prisma.$queryRaw<StudioDocumentRow[]>`
      INSERT INTO "StudioDocument" (id, "ownerId", "anonymousOwnerId", title, content, stage, conditions, agenda, plan, "surveyResult")
      VALUES (
        ${documentId},
        ${scope.ownerId},
        ${scope.ownerId ? null : scope.anonymousOwnerId},
        ${title},
        ${content},
        ${stage},
        ${JSON.stringify(conditions)}::jsonb,
        ${agenda === null ? null : JSON.stringify(agenda)}::jsonb,
        ${plan === null ? null : JSON.stringify(plan)}::jsonb,
        ${surveyResult === null ? null : JSON.stringify(surveyResult)}::jsonb
      )
      RETURNING id, "ownerId", "anonymousOwnerId", title, content, stage, conditions, agenda, plan, "surveyResult", "createdAt", "updatedAt"
    `;

    return res.status(201).json({ document: serializeStudioDocument(documents[0]) });
  } catch (error) {
    console.error('Studio document creation failed:', error);
    return res.status(500).json({ code: 'STUDIO_DOCUMENT_CREATE_FAILED', error: 'Unable to create studio document.' });
  }
});

router.get('/:documentId', async (req: Request<{ documentId: string }>, res: Response) => {
  try {
    await ensureStudioDocumentTable();
    const scope = getOwnerScope(req);

    if (!hasOwnerScope(scope)) {
      return res.status(401).json({ code: 'STUDIO_DOCUMENT_OWNER_REQUIRED', error: 'Studio document owner is required.' });
    }

    const document = await findScopedDocument(req.params.documentId, scope);

    if (!document) {
      return res.status(404).json({ code: 'STUDIO_DOCUMENT_NOT_FOUND', error: 'Studio document not found.' });
    }

    return res.status(200).json({ document: serializeStudioDocument(document, await liveSurveyResult(document.id)) });
  } catch (error) {
    console.error('Studio document detail lookup failed:', error);
    return res.status(500).json({ code: 'STUDIO_DOCUMENT_DETAIL_FAILED', error: 'Unable to load studio document.' });
  }
});

router.patch('/:documentId', async (req: Request<{ documentId: string }, {}, UpdateStudioDocumentBody>, res: Response) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : undefined;
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : undefined;
  const stage = req.body.stage;
  const plan = req.body.plan;
  const surveyResult = req.body.surveyResult;

  if (title !== undefined && title.length === 0) {
    return res.status(400).json({ code: 'INVALID_TITLE', error: 'title cannot be empty.' });
  }

  if (content !== undefined && content.length === 0) {
    return res.status(400).json({ code: 'INVALID_CONTENT', error: 'content cannot be empty.' });
  }

  if (stage !== undefined && !isStudioDocumentStage(stage)) {
    return res.status(400).json({ code: 'INVALID_STAGE', error: 'stage is invalid.' });
  }

  try {
    await ensureStudioDocumentTable();
    const scope = getOwnerScope(req);

    if (!hasOwnerScope(scope)) {
      return res.status(401).json({ code: 'STUDIO_DOCUMENT_OWNER_REQUIRED', error: 'Studio document owner is required.' });
    }

    const currentDocument = await findScopedDocument(req.params.documentId, scope);

    if (!currentDocument) {
      return res.status(404).json({ code: 'STUDIO_DOCUMENT_NOT_FOUND', error: 'Studio document not found.' });
    }

    const updateFields: Prisma.Sql[] = [];

    if (title !== undefined) {
      updateFields.push(Prisma.sql`title = ${title}`);
    }

    if (content !== undefined) {
      updateFields.push(Prisma.sql`content = ${content}`);
    }

    if (stage !== undefined) {
      updateFields.push(Prisma.sql`stage = ${stage}`);
    }

    /**
     * 본문만 저장하면 다음에 열었을 때 항목 구조가 예전 것으로 남아, 고친 내용이
     * 사라진 것처럼 보인다. 본문과 항목 구조는 늘 함께 저장한다.
     */
    if (plan !== undefined) {
      updateFields.push(Prisma.sql`plan = ${plan === null ? null : JSON.stringify(plan)}::jsonb`);
    }

    if (surveyResult !== undefined) {
      updateFields.push(Prisma.sql`"surveyResult" = ${surveyResult === null ? null : JSON.stringify(surveyResult)}::jsonb`);
    }

    if (updateFields.length === 0) {
      return res.status(200).json({ document: serializeStudioDocument(currentDocument, await liveSurveyResult(currentDocument.id)) });
    }

    updateFields.push(Prisma.sql`"updatedAt" = CURRENT_TIMESTAMP`);

    const documents = await prisma.$queryRaw<StudioDocumentRow[]>(Prisma.sql`
      UPDATE "StudioDocument"
      SET ${Prisma.join(updateFields)}
      WHERE id = ${req.params.documentId}
        AND (
          (${scope.ownerId}::text IS NOT NULL AND "ownerId" = ${scope.ownerId})
          OR (
            ${scope.ownerId}::text IS NULL
            AND ${scope.anonymousOwnerId}::text IS NOT NULL
            AND "ownerId" IS NULL
            AND "anonymousOwnerId" = ${scope.anonymousOwnerId}
          )
        )
      RETURNING id, "ownerId", "anonymousOwnerId", title, content, stage, conditions, agenda, plan, "surveyResult", "createdAt", "updatedAt"
    `);

    return res.status(200).json({ document: serializeStudioDocument(documents[0], await liveSurveyResult(documents[0].id)) });
  } catch (error) {
    console.error('Studio document update failed:', error);
    return res.status(500).json({ code: 'STUDIO_DOCUMENT_UPDATE_FAILED', error: 'Unable to update studio document.' });
  }
});

router.delete('/:documentId', async (req: Request<{ documentId: string }>, res: Response) => {
  try {
    await ensureStudioDocumentTable();
    const scope = getOwnerScope(req);

    if (!hasOwnerScope(scope)) {
      return res.status(401).json({ code: 'STUDIO_DOCUMENT_OWNER_REQUIRED', error: 'Studio document owner is required.' });
    }

    const result = await prisma.$executeRaw`
      DELETE FROM "StudioDocument"
      WHERE id = ${req.params.documentId}
        AND (
          (${scope.ownerId}::text IS NOT NULL AND "ownerId" = ${scope.ownerId})
          OR (
            ${scope.ownerId}::text IS NULL
            AND ${scope.anonymousOwnerId}::text IS NOT NULL
            AND "ownerId" IS NULL
            AND "anonymousOwnerId" = ${scope.anonymousOwnerId}
          )
        )
    `;

    if (result === 0) {
      return res.status(404).json({ code: 'STUDIO_DOCUMENT_NOT_FOUND', error: 'Studio document not found.' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Studio document deletion failed:', error);
    return res.status(500).json({ code: 'STUDIO_DOCUMENT_DELETE_FAILED', error: 'Unable to delete studio document.' });
  }
});

export default router;
