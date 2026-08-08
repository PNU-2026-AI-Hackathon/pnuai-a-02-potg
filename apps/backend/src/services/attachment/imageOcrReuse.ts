import { ProgramCaseAttachment } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export type OcrDonor = Pick<ProgramCaseAttachment,
  'id' | 'rawText' | 'cleanedText' | 'extractorType' | 'extractorVersion' | 'extractedAt'>;

export type DonorResolution =
  | { kind: 'NONE' }
  | { kind: 'REUSABLE'; donor: OcrDonor }
  | { kind: 'CONFLICT' };

export async function findOcrDonors(checksumSha256: string, excludeId: string): Promise<OcrDonor[]> {
  return prisma.programCaseAttachment.findMany({
    where: {
      id: { not: excludeId },
      isActive: true,
      extractionStatus: 'COMPLETED',
      checksumSha256,
      rawText: { not: null },
      cleanedText: { not: null },
      failureCode: null,
      extractorType: 'CLOVA_OCR_GENERAL',
      extractorVersion: { not: null },
    },
    select: {
      id: true, rawText: true, cleanedText: true, extractorType: true,
      extractorVersion: true, extractedAt: true,
    },
    orderBy: [{ extractedAt: 'asc' }, { id: 'asc' }],
  });
}

export function resolveOcrDonors(donors: OcrDonor[]): DonorResolution {
  if (donors.length === 0) return { kind: 'NONE' };
  const first = donors[0];
  const consistent = donors.every((donor) =>
    donor.rawText === first.rawText
    && donor.cleanedText === first.cleanedText
    && donor.extractorType === first.extractorType
    && donor.extractorVersion === first.extractorVersion);
  return consistent ? { kind: 'REUSABLE', donor: first } : { kind: 'CONFLICT' };
}
