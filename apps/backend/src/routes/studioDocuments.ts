import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '../lib/prisma';
import { authenticateJwt } from '../middleware/auth';

type StudioDocumentStage = '기획 중' | '수요조사 중' | '수요조사 완료' | '기획서 확정';

type StudioDocumentRow = {
  id: string;
  ownerId: string;
  title: string;
  content: string;
  stage: StudioDocumentStage;
  conditions: Prisma.JsonValue | null;
  agenda: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
};

type CreateStudioDocumentBody = {
  title?: string;
  content?: string;
  stage?: StudioDocumentStage;
  conditions?: unknown;
  agenda?: unknown;
};

type UpdateStudioDocumentBody = {
  title?: string;
  content?: string;
  stage?: StudioDocumentStage;
};

const router = Router();
const validStages = new Set<StudioDocumentStage>(['기획 중', '수요조사 중', '수요조사 완료', '기획서 확정']);
let ensureTablePromise: Promise<void> | null = null;

router.use(authenticateJwt);

function ensureStudioDocumentTable() {
  ensureTablePromise ??= (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "StudioDocument" (
        "id" TEXT NOT NULL,
        "ownerId" TEXT NOT NULL,
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
      DELETE FROM "StudioDocument"
      WHERE "ownerId" IS NULL
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "StudioDocument"
      ALTER COLUMN "ownerId" SET NOT NULL
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "StudioDocument_ownerId_updatedAt_idx"
      ON "StudioDocument"("ownerId", "updatedAt")
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "StudioDocument"
      DROP CONSTRAINT IF EXISTS "StudioDocument_ownerId_fkey"
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "StudioDocument"
      ADD CONSTRAINT "StudioDocument_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
  })();

  return ensureTablePromise;
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readStage(value: unknown): StudioDocumentStage {
  return typeof value === 'string' && validStages.has(value as StudioDocumentStage)
    ? (value as StudioDocumentStage)
    : '기획 중';
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

function serializeStudioDocument(document: StudioDocumentRow) {
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
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function findOwnedDocument(documentId: string, ownerId: string) {
  const documents = await prisma.$queryRaw<StudioDocumentRow[]>`
    SELECT id, "ownerId", title, content, stage, conditions, agenda, "createdAt", "updatedAt"
    FROM "StudioDocument"
    WHERE id = ${documentId} AND "ownerId" = ${ownerId}
    LIMIT 1
  `;

  return documents[0] ?? null;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    await ensureStudioDocumentTable();
    const documents = await prisma.$queryRaw<StudioDocumentRow[]>`
      SELECT id, "ownerId", title, content, stage, conditions, agenda, "createdAt", "updatedAt"
      FROM "StudioDocument"
      WHERE "ownerId" = ${req.user!.id}
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
  const stage = readStage(req.body.stage);
  const conditions = req.body.conditions ?? {};
  const agenda = req.body.agenda ?? null;

  if (!title || !content) {
    return res.status(400).json({ code: 'REQUIRED_FIELDS_MISSING', error: 'title and content are required.' });
  }

  try {
    await ensureStudioDocumentTable();
    const documentId = randomUUID();
    const documents = await prisma.$queryRaw<StudioDocumentRow[]>`
      INSERT INTO "StudioDocument" (id, "ownerId", title, content, stage, conditions, agenda)
      VALUES (
        ${documentId},
        ${req.user!.id},
        ${title},
        ${content},
        ${stage},
        ${JSON.stringify(conditions)}::jsonb,
        ${agenda === null ? null : JSON.stringify(agenda)}::jsonb
      )
      RETURNING id, "ownerId", title, content, stage, conditions, agenda, "createdAt", "updatedAt"
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
    const document = await findOwnedDocument(req.params.documentId, req.user!.id);

    if (!document) {
      return res.status(404).json({ code: 'STUDIO_DOCUMENT_NOT_FOUND', error: 'Studio document not found.' });
    }

    return res.status(200).json({ document: serializeStudioDocument(document) });
  } catch (error) {
    console.error('Studio document detail lookup failed:', error);
    return res.status(500).json({ code: 'STUDIO_DOCUMENT_DETAIL_FAILED', error: 'Unable to load studio document.' });
  }
});

router.patch('/:documentId', async (req: Request<{ documentId: string }, {}, UpdateStudioDocumentBody>, res: Response) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : undefined;
  const content = typeof req.body.content === 'string' ? req.body.content.trim() : undefined;
  const stage = req.body.stage ? readStage(req.body.stage) : undefined;

  if (title !== undefined && title.length === 0) {
    return res.status(400).json({ code: 'INVALID_TITLE', error: 'title cannot be empty.' });
  }

  if (content !== undefined && content.length === 0) {
    return res.status(400).json({ code: 'INVALID_CONTENT', error: 'content cannot be empty.' });
  }

  try {
    await ensureStudioDocumentTable();
    const currentDocument = await findOwnedDocument(req.params.documentId, req.user!.id);

    if (!currentDocument) {
      return res.status(404).json({ code: 'STUDIO_DOCUMENT_NOT_FOUND', error: 'Studio document not found.' });
    }

    const documents = await prisma.$queryRaw<StudioDocumentRow[]>`
      UPDATE "StudioDocument"
      SET
        title = ${title ?? currentDocument.title},
        content = ${content ?? currentDocument.content},
        stage = ${stage ?? currentDocument.stage},
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${req.params.documentId} AND "ownerId" = ${req.user!.id}
      RETURNING id, "ownerId", title, content, stage, conditions, agenda, "createdAt", "updatedAt"
    `;

    return res.status(200).json({ document: serializeStudioDocument(documents[0]) });
  } catch (error) {
    console.error('Studio document update failed:', error);
    return res.status(500).json({ code: 'STUDIO_DOCUMENT_UPDATE_FAILED', error: 'Unable to update studio document.' });
  }
});

router.delete('/:documentId', async (req: Request<{ documentId: string }>, res: Response) => {
  try {
    await ensureStudioDocumentTable();
    const result = await prisma.$executeRaw`
      DELETE FROM "StudioDocument"
      WHERE id = ${req.params.documentId} AND "ownerId" = ${req.user!.id}
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
