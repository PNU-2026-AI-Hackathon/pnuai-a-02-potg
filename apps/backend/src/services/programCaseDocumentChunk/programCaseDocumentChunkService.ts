import {
  AttachmentExtractionStatus,
  Prisma,
  ProgramCaseDocumentChunkType,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';
import {
  buildSessions,
  dateValue,
  fieldLines,
  normalizeText,
  originalBody,
  section,
  textValue,
} from '../programCaseDocument/programCaseDocumentBuilder';
import {
  buildProgramCaseDocumentChunks,
  ProgramCaseDocumentChunk,
  ProgramCaseDocumentChunkBuilderInput,
} from './programCaseDocumentChunkBuilder';

export type ProgramCaseDocumentChunkFailureStep = 'LOAD_DOCUMENT' | 'BUILD_CHUNKS' | 'SYNC_CHUNKS';
export type ProgramCaseDocumentChunkFailure = {
  programCaseDocumentId: string;
  programCaseId: string;
  programTitle: string;
  step: ProgramCaseDocumentChunkFailureStep;
  code: string;
  message: string;
};
export type ProgramCaseDocumentChunkSyncResult = {
  programCaseDocumentId: string;
  programCaseId: string;
  programTitle: string;
  status: 'SUCCESS' | 'FAILED';
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  total: number;
  warningCount: number;
  failure?: ProgramCaseDocumentChunkFailure;
};
export type ProgramCaseDocumentChunkBatchResult = {
  documentsProcessed: number;
  documentsSucceeded: number;
  documentsFailed: number;
  chunksCreated: number;
  chunksUpdated: number;
  chunksUnchanged: number;
  chunksDeleted: number;
  totalChunks: number;
  warningCount: number;
  failures: ProgramCaseDocumentChunkFailure[];
  results: ProgramCaseDocumentChunkSyncResult[];
  durationMs: number;
};

type LoadedDocument = {
  id: string;
  documentType: string;
  programCaseId: string;
  programCase: {
    id: string;
    title: string;
    targetAudience: string;
    sourceType: string;
    sourcePostId: string;
    sourceUrl: string;
    instructor: string;
    capacity: number;
    currentApplicants: number;
    applicationStatus: string;
    educationStartDate: Date | string;
    educationEndDate: Date | string;
    educationStartDateText: string;
    educationEndDateText: string;
    location: string | null;
    feeText: string | null;
    preparationText: string | null;
    contactText: string | null;
    notices: string;
    rawText: string;
    sessions: Array<{
      id: string; sessionNumber: number; sessionDate: Date | string | null;
      dateText: string; activity: string; sortOrder: number;
    }>;
    attachments: Array<{
      id: string; fileName: string; cleanedText: string | null; createdAt: Date | string;
      isActive: boolean; extractionStatus: string;
    }>;
  };
};

type ExistingChunk = {
  id: string;
  chunkKey: string;
  chunkOrder: number;
  chunkType: ProgramCaseDocumentChunkType;
  programCaseAttachmentId: string | null;
  sourceLabel: string | null;
  contentHash: string;
  builderVersion: string;
  characterCount: number;
};

export type ProgramCaseDocumentChunkRepository = {
  findDocument(id: string): Promise<LoadedDocument | null>;
  listSearchDocumentIds(): Promise<string[]>;
  sync(documentId: string, chunks: readonly ProgramCaseDocumentChunk[]): Promise<{
    created: number; updated: number; unchanged: number; deleted: number;
  }>;
};

function defaultRepository(): ProgramCaseDocumentChunkRepository {
  return {
    async findDocument(id) {
      return prisma.programCaseDocument.findUnique({
        where: { id },
        include: {
          programCase: {
            include: {
              sessions: { orderBy: [{ sortOrder: 'asc' }, { sessionNumber: 'asc' }, { id: 'asc' }] },
              attachments: {
                where: {
                  isActive: true,
                  extractionStatus: AttachmentExtractionStatus.COMPLETED,
                  cleanedText: { not: null },
                },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
              },
            },
          },
        },
      }) as Promise<LoadedDocument | null>;
    },
    async listSearchDocumentIds() {
      const rows = await prisma.programCaseDocument.findMany({
        where: { documentType: 'SEARCH' },
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      return rows.map((row) => row.id);
    },
    async sync(documentId, chunks) {
      return prisma.$transaction(async (tx) => {
        const existing = await tx.programCaseDocumentChunk.findMany({
          where: { programCaseDocumentId: documentId },
          select: {
            id: true, chunkKey: true, chunkOrder: true, chunkType: true,
            programCaseAttachmentId: true, sourceLabel: true, contentHash: true,
            builderVersion: true, characterCount: true,
          },
        });
        const existingByKey = new Map(existing.map((chunk) => [chunk.chunkKey, chunk]));
        const desiredKeys = new Set(chunks.map((chunk) => chunk.chunkKey));
        const deletedRows = existing.filter((chunk) => !desiredKeys.has(chunk.chunkKey));
        if (deletedRows.length) {
          await tx.programCaseDocumentChunk.deleteMany({
            where: { id: { in: deletedRows.map((chunk) => chunk.id) } },
          });
        }
        let created = 0;
        let updated = 0;
        let unchanged = 0;
        for (const chunk of chunks) {
          const old = existingByKey.get(chunk.chunkKey);
          const data = {
            chunkOrder: chunk.chunkOrder,
            chunkType: chunk.chunkType as ProgramCaseDocumentChunkType,
            programCaseAttachmentId: chunk.programCaseAttachmentId,
            sourceLabel: chunk.sourceLabel,
            content: chunk.content,
            contentHash: chunk.contentHash,
            builderVersion: chunk.builderVersion,
            characterCount: chunk.characterCount,
          };
          if (!old) {
            await tx.programCaseDocumentChunk.create({
              data: { programCaseDocumentId: documentId, chunkKey: chunk.chunkKey, ...data },
            });
            created += 1;
          } else if (sameChunk(old, chunk)) {
            unchanged += 1;
          } else {
            await tx.programCaseDocumentChunk.update({ where: { id: old.id }, data });
            updated += 1;
          }
        }
        return { created, updated, unchanged, deleted: deletedRows.length };
      });
    },
  };
}

function sameChunk(existing: ExistingChunk, desired: ProgramCaseDocumentChunk) {
  return existing.chunkOrder === desired.chunkOrder
    && existing.chunkType === desired.chunkType
    && existing.programCaseAttachmentId === desired.programCaseAttachmentId
    && existing.sourceLabel === desired.sourceLabel
    && existing.contentHash === desired.contentHash
    && existing.builderVersion === desired.builderVersion
    && existing.characterCount === desired.characterCount;
}

function toBuilderInput(document: LoadedDocument): ProgramCaseDocumentChunkBuilderInput {
  const program = document.programCase;
  const period = [
    textValue(program.educationStartDateText) || dateValue(program.educationStartDate),
    textValue(program.educationEndDateText) || dateValue(program.educationEndDate),
  ].filter(Boolean).join(' ~ ');
  const basic = section('프로그램 기본 정보', [fieldLines([
    ['프로그램명', program.title], ['대상', program.targetAudience], ['강사', program.instructor],
    ['모집 인원', program.capacity], ['현재 신청 인원', program.currentApplicants],
    ['신청 상태', program.applicationStatus], ['운영 기간', period], ['장소', program.location],
    ['비용', program.feeText], ['준비물', program.preparationText], ['문의처', program.contactText],
  ]).join('\n')]);
  const coreContent = normalizeText([
    basic,
    section('프로그램 안내', [program.notices]),
    section('원본 게시글 본문', [originalBody(program)]),
    section('출처 정보', [fieldLines([
      ['프로그램 사례 ID', program.id], ['출처 유형', program.sourceType],
      ['원본 게시글 ID', program.sourcePostId], ['원본 URL', program.sourceUrl],
    ]).join('\n')]),
  ].filter(Boolean).join('\n\n'));
  const sessionsContent = section('회차별 활동', buildSessions(program.sessions));
  return {
    programCaseDocumentId: document.id,
    programCaseId: document.programCaseId,
    title: program.title,
    targetAudience: program.targetAudience,
    coreContent,
    sessionsContent,
    attachments: program.attachments
      .filter((attachment) => Boolean(attachment.cleanedText?.trim()))
      .map((attachment, order) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        content: attachment.cleanedText ?? '',
        order,
      })),
  };
}

function failureResult(id: string, document: LoadedDocument | null, step: ProgramCaseDocumentChunkFailureStep, error: unknown) {
  const known = error instanceof Prisma.PrismaClientKnownRequestError;
  const failure: ProgramCaseDocumentChunkFailure = {
    programCaseDocumentId: id,
    programCaseId: document?.programCaseId ?? '',
    programTitle: document?.programCase.title ?? '',
    step,
    code: known ? `PRISMA_${error.code}` : error instanceof Error ? error.message : 'CHUNK_SYNC_FAILED',
    message: known ? 'Database operation failed.' : 'Program case document chunk processing failed.',
  };
  return {
    programCaseDocumentId: id,
    programCaseId: failure.programCaseId,
    programTitle: failure.programTitle,
    status: 'FAILED' as const,
    created: 0, updated: 0, unchanged: 0, deleted: 0, total: 0, warningCount: 0, failure,
  };
}

export async function syncProgramCaseDocumentChunksById(
  id: string,
  repository: ProgramCaseDocumentChunkRepository = defaultRepository(),
): Promise<ProgramCaseDocumentChunkSyncResult> {
  let document: LoadedDocument | null = null;
  let step: ProgramCaseDocumentChunkFailureStep = 'LOAD_DOCUMENT';
  try {
    document = await repository.findDocument(id);
    if (!document) throw new Error('PROGRAM_CASE_DOCUMENT_NOT_FOUND');
    if (document.documentType !== 'SEARCH') throw new Error('PROGRAM_CASE_DOCUMENT_NOT_SEARCH');
    step = 'BUILD_CHUNKS';
    const built = buildProgramCaseDocumentChunks(toBuilderInput(document));
    step = 'SYNC_CHUNKS';
    const counts = await repository.sync(id, built.chunks);
    return {
      programCaseDocumentId: id,
      programCaseId: document.programCaseId,
      programTitle: document.programCase.title,
      status: 'SUCCESS',
      ...counts,
      total: built.chunks.length,
      warningCount: built.warnings.length,
    };
  } catch (error) {
    return failureResult(id, document, step, error);
  }
}

export async function syncProgramCaseDocumentChunks(
  options: { programCaseDocumentId: string } | { all: true },
  repository: ProgramCaseDocumentChunkRepository = defaultRepository(),
): Promise<ProgramCaseDocumentChunkBatchResult> {
  const startedAt = Date.now();
  const ids = 'programCaseDocumentId' in options
    ? [options.programCaseDocumentId]
    : await repository.listSearchDocumentIds();
  const results: ProgramCaseDocumentChunkSyncResult[] = [];
  for (const id of ids) results.push(await syncProgramCaseDocumentChunksById(id, repository));
  return {
    documentsProcessed: results.length,
    documentsSucceeded: results.filter((result) => result.status === 'SUCCESS').length,
    documentsFailed: results.filter((result) => result.status === 'FAILED').length,
    chunksCreated: results.reduce((sum, result) => sum + result.created, 0),
    chunksUpdated: results.reduce((sum, result) => sum + result.updated, 0),
    chunksUnchanged: results.reduce((sum, result) => sum + result.unchanged, 0),
    chunksDeleted: results.reduce((sum, result) => sum + result.deleted, 0),
    totalChunks: results.reduce((sum, result) => sum + result.total, 0),
    warningCount: results.reduce((sum, result) => sum + result.warningCount, 0),
    failures: results.flatMap((result) => result.failure ? [result.failure] : []),
    results,
    durationMs: Date.now() - startedAt,
  };
}
