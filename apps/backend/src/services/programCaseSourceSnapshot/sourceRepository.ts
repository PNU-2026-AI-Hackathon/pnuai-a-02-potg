import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type SourceProgramRow = Prisma.ProgramCaseGetPayload<{
  include: { sessions: true; attachments: true };
}>;

export type SourceSnapshotRows = {
  databaseName: string;
  programs: SourceProgramRow[];
};

const READ_ONLY_ROLLBACK = new Error('PROGRAM_CASE_SOURCE_READ_ONLY_ROLLBACK');

export async function loadSourceRowsReadOnly(): Promise<SourceSnapshotRows> {
  let result: SourceSnapshotRows | undefined;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const databaseRows = await tx.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
      const programs = await tx.programCase.findMany({
        include: {
          sessions: { orderBy: [{ sortOrder: 'asc' }, { sessionNumber: 'asc' }, { id: 'asc' }] },
          attachments: { where: { isActive: true }, orderBy: [{ id: 'asc' }] },
        },
        orderBy: { id: 'asc' },
      });
      result = { databaseName: databaseRows[0]?.name ?? '', programs };
      throw READ_ONLY_ROLLBACK;
    }, { timeout: 30_000 });
  } catch (error) {
    if (error !== READ_ONLY_ROLLBACK) throw error;
  }
  if (!result?.databaseName) throw new Error('DATABASE_IDENTITY_UNAVAILABLE');
  return result;
}
