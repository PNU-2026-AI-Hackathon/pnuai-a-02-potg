import type { Metadata } from 'next';
import StudioGenerationLoading from '@/components/studio/StudioGenerationLoading';
import { requireStudioStaff } from '@/lib/studio-access';

export const metadata: Metadata = {
  title: 'MOIRA Studio | 기획안 생성 중',
  description: 'MOIRA Studio 프로그램 기획안 생성 준비 화면입니다.',
};

export default async function StudioGeneratingPage() {
  await requireStudioStaff('/studio');

  return <StudioGenerationLoading />;
}
