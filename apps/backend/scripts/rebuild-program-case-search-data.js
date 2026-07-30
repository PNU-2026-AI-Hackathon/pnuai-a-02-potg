const { prisma } = require('../dist/lib/prisma');
const {
  buildProgramCaseDocument,
} = require('../dist/services/programCaseDocument/programCaseDocumentBuilder');
const {
  PROGRAM_CASE_DOCUMENT_TYPE,
  PROGRAM_CASE_DOCUMENT_VERSION,
  buildProgramCaseDocumentById,
} = require('../dist/services/programCaseDocument/programCaseDocumentService');
const {
  buildProgramCaseDocumentChunks,
} = require('../dist/services/programCaseDocumentChunk/programCaseDocumentChunkBuilder');
const {
  syncProgramCaseDocumentChunksById,
} = require('../dist/services/programCaseDocumentChunk/programCaseDocumentChunkService');
const {
  createProgramCaseDocumentHash,
} = require('../dist/services/programCaseDocument/programCaseDocumentHash');

const PRODUCTION_DATABASE = 'moira';
const DRY_RUN_DATABASES = new Set([PRODUCTION_DATABASE, 'moira_pgvector_integration_test']);
const PRODUCTION_CONFIRMATION = '--confirm-production-rebuild=moira';

function parseArguments(argv) {
  const execute = argv.includes('--execute');
  const dryRun = argv.includes('--dry-run') || !execute;
  const audit = argv.includes('--audit');
  const confirmation = argv.includes(PRODUCTION_CONFIRMATION);
  const batchArgument = argv.find((value) => value.startsWith('--batch-size='));
  const batchSize = batchArgument ? Number(batchArgument.split('=', 2)[1]) : 25;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new Error('INVALID_BATCH_SIZE');
  }
  if (execute && argv.includes('--dry-run')) throw new Error('CONFLICTING_MODE');
  return { execute, dryRun, audit, confirmation, batchSize };
}

function assertExecutionAllowed(options, databaseName) {
  if (!DRY_RUN_DATABASES.has(databaseName)) throw new Error('DATABASE_NOT_ALLOWLISTED');
  if (!options.execute) return;
  if (databaseName !== PRODUCTION_DATABASE) throw new Error('PRODUCTION_DATABASE_REQUIRED');
  if (!options.confirmation) throw new Error('PRODUCTION_CONFIRMATION_REQUIRED');
}

async function databaseMetadata(client) {
  const [databaseRows, tableRows] = await Promise.all([
    client.$queryRaw`SELECT current_database() AS name`,
    client.$queryRaw`
      SELECT to_regclass('"ProgramCaseDocumentChunkEmbedding"') IS NOT NULL AS "embeddingTable"
    `,
  ]);
  return {
    databaseName: databaseRows[0].name,
    embeddingTable: tableRows[0].embeddingTable,
  };
}

async function aggregateAudit(client, embeddingTable) {
  const rows = await client.$queryRaw`
    SELECT
      (SELECT COUNT(*)::int FROM "ProgramCase") AS "programs",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocument") AS "documents",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocument" WHERE "version" = '2') AS "documentsV2",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocument"
       WHERE "content" ~ '(^|[^0-9A-Za-z])0[0-9]{1,2}\\)?[- ]?[0-9]{3,4}[- ]?[0-9]{4}([^0-9A-Za-z]|$)') AS "documentsPhone",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocument"
       WHERE "content" ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}') AS "documentsEmail",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocument" d
       JOIN "ProgramCase" p ON p."id" = d."programCaseId"
       WHERE p."instructor" <> '' AND position(p."instructor" in d."content") > 0) AS "documentsInstructor",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocument" d
       JOIN "ProgramCase" p ON p."id" = d."programCaseId"
       WHERE p."contactText" IS NOT NULL AND p."contactText" <> ''
         AND position(p."contactText" in d."content") > 0) AS "documentsContact",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocument"
       WHERE "content" ~ '(생년월일|생일|출생일)') AS "documentsBirthLabel",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocument"
       WHERE "content" ~ '(입금계좌|환불계좌|계좌번호|예금주)') AS "documentsAccountLabel",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocument"
       WHERE "content" ~ '(참여자 *명단|신청자 *명단|수강생 *명단|출석부|서명부)') AS "documentsHighRisk",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocumentChunk") AS "chunks",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocumentChunk"
       WHERE "builderVersion" = 'program-case-chunk-v2') AS "chunksV2",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocumentChunk"
       WHERE "content" ~ '(^|[^0-9A-Za-z])0[0-9]{1,2}\\)?[- ]?[0-9]{3,4}[- ]?[0-9]{4}([^0-9A-Za-z]|$)') AS "chunksPhone",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocumentChunk"
       WHERE "content" ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}') AS "chunksEmail",
      (SELECT COUNT(*)::int FROM "ProgramCaseDocumentChunk"
       WHERE "content" ~ '(참여자 *명단|신청자 *명단|수강생 *명단|출석부|서명부)') AS "chunksHighRisk",
      (SELECT COUNT(*)::int FROM "ProgramCaseAttachment"
       WHERE "isActive" AND "extractionStatus" = 'COMPLETED'
         AND (coalesce("fileName", '') || E'\n' || coalesce("cleanedText", ''))
           ~ '(참여자 *명단|신청자 *명단|수강생 *명단|출석부|서명부|강사 *이력서|개인정보.*동의서)')
        AS "highRiskAttachments"
  `;
  let embeddings = 0;
  let staleEmbeddings = 0;
  if (embeddingTable) {
    const embeddingRows = await client.$queryRawUnsafe(`
      SELECT
        COUNT(*)::int AS "embeddings",
        COUNT(*) FILTER (
          WHERE e."embeddedContentHash" IS DISTINCT FROM c."contentHash"
        )::int AS "staleEmbeddings"
      FROM "ProgramCaseDocumentChunkEmbedding" e
      JOIN "ProgramCaseDocumentChunk" c ON c."id" = e."programCaseDocumentChunkId"
    `);
    embeddings = embeddingRows[0].embeddings;
    staleEmbeddings = embeddingRows[0].staleEmbeddings;
  }
  return { ...rows[0], embeddingTable, embeddings, staleEmbeddings };
}

async function readOnlyAudit() {
  const rollback = new Error('READ_ONLY_AUDIT_ROLLBACK');
  let result;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const metadata = await databaseMetadata(tx);
      const audit = await aggregateAudit(tx, metadata.embeddingTable);
      result = { metadata, audit };
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return result;
}

function documentRepository(tx) {
  return {
    async findSource(programCaseId) {
      const program = await tx.programCase.findUnique({
        where: { id: programCaseId },
        include: {
          sessions: { orderBy: [{ sortOrder: 'asc' }, { sessionNumber: 'asc' }, { id: 'asc' }] },
          attachments: {
            where: { isActive: true, extractionStatus: 'COMPLETED', cleanedText: { not: null } },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
      if (!program) return null;
      return { program, sessions: program.sessions, attachments: program.attachments };
    },
    findDocument(programCaseId, documentType) {
      return tx.programCaseDocument.findUnique({
        where: { programCaseId_documentType: { programCaseId, documentType } },
        select: { id: true, version: true, contentHash: true },
      });
    },
    createDocument(data) { return tx.programCaseDocument.create({ data }).then(() => undefined); },
    updateDocument(id, data) {
      return tx.programCaseDocument.update({ where: { id }, data }).then(() => undefined);
    },
    listProgramCaseIds() { throw new Error('BATCH_LIST_NOT_ALLOWED_IN_PROGRAM_TRANSACTION'); },
  };
}

function chunkRepository(tx) {
  return {
    findDocument(id) {
      return tx.programCaseDocument.findUnique({
        where: { id },
        include: {
          programCase: {
            include: {
              sessions: { orderBy: [{ sortOrder: 'asc' }, { sessionNumber: 'asc' }, { id: 'asc' }] },
              attachments: {
                where: { isActive: true, extractionStatus: 'COMPLETED', cleanedText: { not: null } },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              },
            },
          },
        },
      });
    },
    listSearchDocumentIds() { throw new Error('BATCH_LIST_NOT_ALLOWED_IN_PROGRAM_TRANSACTION'); },
    async sync(documentId, chunks) {
      const existing = await tx.programCaseDocumentChunk.findMany({
        where: { programCaseDocumentId: documentId },
      });
      const byKey = new Map(existing.map((row) => [row.chunkKey, row]));
      const wanted = new Set(chunks.map((row) => row.chunkKey));
      const removed = existing.filter((row) => !wanted.has(row.chunkKey));
      if (removed.length) {
        await tx.programCaseDocumentChunk.deleteMany({ where: { id: { in: removed.map((row) => row.id) } } });
      }
      let created = 0; let updated = 0; let unchanged = 0;
      for (const chunk of chunks) {
        const old = byKey.get(chunk.chunkKey);
        const data = {
          chunkOrder: chunk.chunkOrder, chunkType: chunk.chunkType,
          programCaseAttachmentId: chunk.programCaseAttachmentId,
          sourceLabel: chunk.sourceLabel, content: chunk.content,
          contentHash: chunk.contentHash, builderVersion: chunk.builderVersion,
          characterCount: chunk.characterCount,
        };
        const same = old && old.chunkOrder === chunk.chunkOrder
          && old.chunkType === chunk.chunkType
          && old.programCaseAttachmentId === chunk.programCaseAttachmentId
          && old.sourceLabel === chunk.sourceLabel
          && old.contentHash === chunk.contentHash
          && old.builderVersion === chunk.builderVersion
          && old.characterCount === chunk.characterCount;
        if (!old) {
          await tx.programCaseDocumentChunk.create({ data: { programCaseDocumentId: documentId, chunkKey: chunk.chunkKey, ...data } });
          created += 1;
        } else if (same) {
          unchanged += 1;
        } else {
          await tx.programCaseDocumentChunk.update({ where: { id: old.id }, data });
          updated += 1;
        }
      }
      return { created, updated, unchanged, deleted: removed.length };
    },
  };
}

async function rebuildProgram(programCaseId, embeddingTable) {
  return prisma.$transaction(async (tx) => {
    const documentResult = await buildProgramCaseDocumentById(programCaseId, {
      repository: documentRepository(tx),
      build: buildProgramCaseDocument,
      hash: createProgramCaseDocumentHash,
    });
    if (documentResult.status === 'FAILED') throw new Error('DOCUMENT_REBUILD_FAILED');
    const document = await tx.programCaseDocument.findUniqueOrThrow({
      where: { programCaseId_documentType: {
        programCaseId, documentType: PROGRAM_CASE_DOCUMENT_TYPE,
      } },
      select: { id: true },
    });
    const chunkResult = await syncProgramCaseDocumentChunksById(document.id, chunkRepository(tx));
    if (chunkResult.status === 'FAILED') throw new Error('CHUNK_REBUILD_FAILED');
    if (embeddingTable) {
      await tx.$executeRawUnsafe(`
        DELETE FROM "ProgramCaseDocumentChunkEmbedding"
        WHERE "programCaseDocumentChunkId" IN (
          SELECT "id" FROM "ProgramCaseDocumentChunk"
          WHERE "programCaseDocumentId" = $1
        )
      `, document.id);
    }
    return { documentStatus: documentResult.status, chunkResult };
  }, { maxWait: 10_000, timeout: 60_000 });
}

async function executeRebuild(options, metadata) {
  const ids = await prisma.programCase.findMany({ select: { id: true }, orderBy: { id: 'asc' } });
  let processed = 0;
  for (let offset = 0; offset < ids.length; offset += options.batchSize) {
    for (const row of ids.slice(offset, offset + options.batchSize)) {
      await rebuildProgram(row.id, metadata.embeddingTable);
      processed += 1;
    }
  }
  return { processed, failed: 0 };
}

async function run(argv = process.argv.slice(2)) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED');
  const options = parseArguments(argv);
  const { metadata, audit } = await readOnlyAudit();
  assertExecutionAllowed(options, metadata.databaseName);
  const output = {
    mode: options.execute ? 'execute' : options.audit ? 'audit' : 'dry-run',
    databaseName: metadata.databaseName,
    batchSize: options.batchSize,
    expectedBatches: Math.ceil(audit.programs / options.batchSize),
    ...audit,
    writeQueries: 0,
  };
  if (options.execute) {
    const result = await executeRebuild(options, metadata);
    output.processed = result.processed;
    output.failed = result.failed;
    output.writeQueries = result.processed;
  }
  return output;
}

if (require.main === module) {
  run().then((result) => {
    console.log(JSON.stringify(result));
  }).catch((error) => {
    console.error(JSON.stringify({ errorCode: error instanceof Error ? error.message : 'REBUILD_FAILED' }));
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
}

module.exports = {
  DRY_RUN_DATABASES,
  PRODUCTION_CONFIRMATION,
  assertExecutionAllowed,
  parseArguments,
  run,
};
