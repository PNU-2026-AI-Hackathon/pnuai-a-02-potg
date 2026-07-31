import { AttachmentExtractionStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import {
  buildProgramCaseDocument,
  ProgramCaseDocumentInput,
} from './programCaseDocumentBuilder';
import { createProgramCaseDocumentHash } from './programCaseDocumentHash';

export const PROGRAM_CASE_DOCUMENT_TYPE = 'SEARCH';
export const PROGRAM_CASE_DOCUMENT_VERSION = '2';
export const LONG_ATTACHMENT_TEXT_WARNING_THRESHOLD = 10_000;
export const LONG_DOCUMENT_WARNING_THRESHOLD = 20_000;

export type ProgramCaseDocumentStatus = 'CREATED' | 'UPDATED' | 'UNCHANGED' | 'FAILED';
export type ProgramCaseDocumentFailureStep = 'LOAD_SOURCE' | 'BUILD_DOCUMENT' | 'HASH_CONTENT' | 'LOAD_DOCUMENT' | 'SAVE_DOCUMENT';

export type ProgramCaseDocumentWarningCode =
  | 'LONG_ATTACHMENT_TEXT'
  | 'MULTIPLE_PROGRAM_NAME_MARKERS'
  | 'LONG_DOCUMENT';

export type ProgramCaseDocumentFailure = {
  programCaseId: string;
  code: string;
  message: string;
  step: ProgramCaseDocumentFailureStep;
};

export type ProgramCaseDocumentResult = {
  programCaseId: string;
  status: ProgramCaseDocumentStatus;
  documentType: typeof PROGRAM_CASE_DOCUMENT_TYPE;
  version: typeof PROGRAM_CASE_DOCUMENT_VERSION;
  contentHash?: string;
  contentLength?: number;
  withSessions: boolean;
  withAttachments: boolean;
  emptyDocument: boolean;
  warnings: ProgramCaseDocumentWarningCode[];
  failure?: ProgramCaseDocumentFailure;
};

export type ProgramCaseDocumentBatchResult = {
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  emptyDocuments: number;
  withSessions: number;
  withAttachments: number;
  warningCounts: Record<ProgramCaseDocumentWarningCode, number>;
  failures: ProgramCaseDocumentFailure[];
  results: ProgramCaseDocumentResult[];
  durationMs: number;
};

type ExistingDocument = {
  id: string;
  version: string;
  contentHash: string;
};

type SaveDocumentData = {
  programCaseId: string;
  documentType: string;
  content: string;
  contentHash: string;
  version: string;
};

export type ProgramCaseDocumentRepository = {
  findSource(programCaseId: string): Promise<ProgramCaseDocumentInput | null>;
  findDocument(programCaseId: string, documentType: string): Promise<ExistingDocument | null>;
  createDocument(data: SaveDocumentData): Promise<void>;
  updateDocument(id: string, data: Pick<SaveDocumentData, 'content' | 'contentHash' | 'version'>): Promise<void>;
  listProgramCaseIds(): Promise<string[]>;
};

export type ProgramCaseDocumentServiceDependencies = {
  repository: ProgramCaseDocumentRepository;
  build: typeof buildProgramCaseDocument;
  hash: typeof createProgramCaseDocumentHash;
};

function defaultRepository(): ProgramCaseDocumentRepository {
  return {
    async findSource(programCaseId) {
      const program = await prisma.programCase.findUnique({
        where: { id: programCaseId },
        include: {
          sessions: {
            orderBy: [{ sortOrder: 'asc' }, { sessionNumber: 'asc' }, { id: 'asc' }],
          },
          attachments: {
            where: {
              isActive: true,
              extractionStatus: AttachmentExtractionStatus.COMPLETED,
              cleanedText: { not: null },
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
      if (!program) return null;
      return {
        program,
        sessions: program.sessions,
        attachments: program.attachments.filter((attachment) => Boolean(attachment.cleanedText?.trim())),
      };
    },
    async findDocument(programCaseId, documentType) {
      return prisma.programCaseDocument.findUnique({
        where: { programCaseId_documentType: { programCaseId, documentType } },
        select: { id: true, version: true, contentHash: true },
      });
    },
    async createDocument(data) {
      await prisma.programCaseDocument.create({ data });
    },
    async updateDocument(id, data) {
      await prisma.programCaseDocument.update({ where: { id }, data });
    },
    async listProgramCaseIds() {
      const rows = await prisma.programCase.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
      });
      return rows.map((row) => row.id);
    },
  };
}

function defaultDependencies(): ProgramCaseDocumentServiceDependencies {
  return {
    repository: defaultRepository(),
    build: buildProgramCaseDocument,
    hash: createProgramCaseDocumentHash,
  };
}

function safeFailure(error: unknown, programCaseId: string, step: ProgramCaseDocumentFailureStep): ProgramCaseDocumentFailure {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      programCaseId,
      code: `PRISMA_${error.code}`,
      message: 'Database operation failed.',
      step,
    };
  }
  if (error instanceof Error && error.message === 'PROGRAM_CASE_NOT_FOUND') {
    return {
      programCaseId,
      code: 'PROGRAM_CASE_NOT_FOUND',
      message: 'Program case was not found.',
      step,
    };
  }
  return {
    programCaseId,
    code: 'PROGRAM_CASE_DOCUMENT_FAILED',
    message: 'Program case document processing failed.',
    step,
  };
}

function warningCodes(input: ProgramCaseDocumentInput, content: string) {
  const warnings = new Set<ProgramCaseDocumentWarningCode>();
  if (input.attachments.some((attachment) => (attachment.cleanedText?.length ?? 0) >= LONG_ATTACHMENT_TEXT_WARNING_THRESHOLD)) {
    warnings.add('LONG_ATTACHMENT_TEXT');
  }
  if (input.attachments.some((attachment) => ((attachment.cleanedText ?? '').match(/프로그램명/g) ?? []).length >= 2)) {
    warnings.add('MULTIPLE_PROGRAM_NAME_MARKERS');
  }
  if (content.length >= LONG_DOCUMENT_WARNING_THRESHOLD) {
    warnings.add('LONG_DOCUMENT');
  }
  return [...warnings];
}

function eligibleInput(input: ProgramCaseDocumentInput): ProgramCaseDocumentInput {
  return {
    program: input.program,
    sessions: input.sessions,
    attachments: input.attachments.filter((attachment) =>
      attachment.isActive
      && attachment.extractionStatus === AttachmentExtractionStatus.COMPLETED
      && Boolean(attachment.cleanedText?.trim())),
  };
}

function failedResult(programCaseId: string, failure: ProgramCaseDocumentFailure): ProgramCaseDocumentResult {
  return {
    programCaseId,
    status: 'FAILED',
    documentType: PROGRAM_CASE_DOCUMENT_TYPE,
    version: PROGRAM_CASE_DOCUMENT_VERSION,
    withSessions: false,
    withAttachments: false,
    emptyDocument: false,
    warnings: [],
    failure,
  };
}

export async function buildProgramCaseDocumentById(
  programCaseId: string,
  dependencies: ProgramCaseDocumentServiceDependencies = defaultDependencies(),
): Promise<ProgramCaseDocumentResult> {
  let step: ProgramCaseDocumentFailureStep = 'LOAD_SOURCE';
  try {
    const loadedInput = await dependencies.repository.findSource(programCaseId);
    if (!loadedInput) throw new Error('PROGRAM_CASE_NOT_FOUND');
    const input = eligibleInput(loadedInput);

    step = 'BUILD_DOCUMENT';
    const content = dependencies.build(input);
    const emptyDocument = content.trim().length === 0;
    const warnings = warningCodes(input, content);

    step = 'HASH_CONTENT';
    const contentHash = dependencies.hash(content);

    step = 'LOAD_DOCUMENT';
    const existing = await dependencies.repository.findDocument(programCaseId, PROGRAM_CASE_DOCUMENT_TYPE);
    const baseResult: Omit<ProgramCaseDocumentResult, 'status' | 'failure'> = {
      programCaseId,
      documentType: PROGRAM_CASE_DOCUMENT_TYPE,
      version: PROGRAM_CASE_DOCUMENT_VERSION,
      contentHash,
      contentLength: content.length,
      withSessions: input.sessions.length > 0,
      withAttachments: input.attachments.length > 0,
      emptyDocument,
      warnings,
    };
    if (existing?.version === PROGRAM_CASE_DOCUMENT_VERSION && existing.contentHash === contentHash) {
      return { ...baseResult, status: 'UNCHANGED' };
    }

    step = 'SAVE_DOCUMENT';
    if (existing) {
      await dependencies.repository.updateDocument(existing.id, {
        content,
        contentHash,
        version: PROGRAM_CASE_DOCUMENT_VERSION,
      });
      return { ...baseResult, status: 'UPDATED' };
    }
    await dependencies.repository.createDocument({
      programCaseId,
      documentType: PROGRAM_CASE_DOCUMENT_TYPE,
      content,
      contentHash,
      version: PROGRAM_CASE_DOCUMENT_VERSION,
    });
    return { ...baseResult, status: 'CREATED' };
  } catch (error) {
    const failure = safeFailure(error, programCaseId, step);
    return failedResult(programCaseId, failure);
  }
}

function emptyWarningCounts(): Record<ProgramCaseDocumentWarningCode, number> {
  return {
    LONG_ATTACHMENT_TEXT: 0,
    MULTIPLE_PROGRAM_NAME_MARKERS: 0,
    LONG_DOCUMENT: 0,
  };
}

export async function buildProgramCaseDocuments(
  options: { programCaseId: string } | { all: true },
  dependencies: ProgramCaseDocumentServiceDependencies = defaultDependencies(),
): Promise<ProgramCaseDocumentBatchResult> {
  const startedAt = Date.now();
  const ids = 'programCaseId' in options
    ? [options.programCaseId]
    : await dependencies.repository.listProgramCaseIds();
  const results: ProgramCaseDocumentResult[] = [];
  for (const programCaseId of ids) {
    results.push(await buildProgramCaseDocumentById(programCaseId, dependencies));
  }
  const warningCounts = emptyWarningCounts();
  results.forEach((result) => result.warnings.forEach((warning) => {
    warningCounts[warning] += 1;
  }));
  return {
    total: results.length,
    created: results.filter((result) => result.status === 'CREATED').length,
    updated: results.filter((result) => result.status === 'UPDATED').length,
    unchanged: results.filter((result) => result.status === 'UNCHANGED').length,
    failed: results.filter((result) => result.status === 'FAILED').length,
    emptyDocuments: results.filter((result) => result.emptyDocument).length,
    withSessions: results.filter((result) => result.withSessions).length,
    withAttachments: results.filter((result) => result.withAttachments).length,
    warningCounts,
    failures: results.flatMap((result) => result.failure ? [result.failure] : []),
    results,
    durationMs: Date.now() - startedAt,
  };
}
