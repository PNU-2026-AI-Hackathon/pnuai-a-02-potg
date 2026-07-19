import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { ProgramCaseInput, ProgramCaseSyncFailure, ProgramCaseSyncResult } from '../types/programCase';

type SyncOneResult = {
  created: boolean;
  sessions: number;
  attachments: number;
};

function programData(program: ProgramCaseInput) {
  return {
    sourceType: program.sourceType,
    sourcePostId: program.sourcePostId,
    sourceUrl: program.sourceUrl,
    title: program.title,
    targetAudience: program.targetAudience,
    instructor: program.instructor,
    capacity: program.capacity,
    currentApplicants: program.currentApplicants,
    applicationStatus: program.applicationStatus,
    educationStartDate: program.educationStartDate,
    educationEndDate: program.educationEndDate,
    educationStartDateText: program.educationStartDateText,
    educationEndDateText: program.educationEndDateText,
    location: program.location,
    feeText: program.feeText,
    preparationText: program.preparationText,
    contactText: program.contactText,
    notices: program.notices,
    rawText: program.rawText,
    hasUnparsedAttachments: program.hasUnparsedAttachments,
    crawledAt: program.crawledAt,
    requestSucceeded: program.requestSucceeded,
    parseWarnings: program.parseWarnings as Prisma.InputJsonValue,
  };
}

async function syncOneProgram(program: ProgramCaseInput): Promise<SyncOneResult> {
  return prisma.$transaction(async (tx) => {
    const where = {
      sourceType_sourcePostId: {
        sourceType: program.sourceType,
        sourcePostId: program.sourcePostId,
      },
    };
    const existing = await tx.programCase.findUnique({ where, select: { id: true } });
    const saved = await tx.programCase.upsert({
      where,
      create: programData(program),
      update: programData(program),
      select: { id: true },
    });

    await tx.programCaseSession.deleteMany({ where: { programCaseId: saved.id } });
    if (program.sessions.length > 0) {
      await tx.programCaseSession.createMany({
        data: program.sessions.map((session) => ({
          programCaseId: saved.id,
          sessionNumber: session.sessionNumber,
          sessionDate: session.sessionDate,
          dateText: session.dateText,
          activity: session.activity,
          sortOrder: session.sortOrder,
        })),
      });
    }

    // 초기 적재 단계에서는 원천 배열을 기준으로 메타데이터를 전체 교체한다.
    // 첨부 본문 추출 결과를 저장하기 시작하면 식별자 기반 갱신 전략으로 변경해야 한다.
    await tx.programCaseAttachment.deleteMany({ where: { programCaseId: saved.id } });
    if (program.attachments.length > 0) {
      await tx.programCaseAttachment.createMany({
        data: program.attachments.map((attachment) => ({
          programCaseId: saved.id,
          fileName: attachment.fileName,
          fileUrl: attachment.fileUrl,
          fileType: attachment.fileType,
          extractionStatus: attachment.extractionStatus,
        })),
      });
    }

    return {
      created: existing === null,
      sessions: program.sessions.length,
      attachments: program.attachments.length,
    };
  });
}

function safeFailureMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `Database operation failed (${error.code})`;
  }
  return 'Database operation failed';
}

export async function syncProgramCases(programs: ProgramCaseInput[]): Promise<ProgramCaseSyncResult> {
  const startedAt = Date.now();
  let succeeded = 0;
  let created = 0;
  let updated = 0;
  let sessions = 0;
  let attachments = 0;
  const failures: ProgramCaseSyncFailure[] = [];

  // 안정성을 우선해 프로그램별 트랜잭션을 순차 처리한다.
  for (const program of programs) {
    try {
      const result = await syncOneProgram(program);
      succeeded += 1;
      created += result.created ? 1 : 0;
      updated += result.created ? 0 : 1;
      sessions += result.sessions;
      attachments += result.attachments;
    } catch (error) {
      failures.push({
        sourceType: program.sourceType,
        sourcePostId: program.sourcePostId,
        message: safeFailureMessage(error),
      });
    }
  }

  return {
    total: programs.length,
    succeeded,
    failed: failures.length,
    created,
    updated,
    sessions,
    attachments,
    failures,
    durationMs: Date.now() - startedAt,
  };
}
