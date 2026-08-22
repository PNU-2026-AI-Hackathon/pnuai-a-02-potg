import type { Metadata } from 'next';
import StudioDocumentsManager from '@/components/studio/StudioDocumentsManager';
import { requireStudioStaff } from '@/lib/studio-access';

export const metadata: Metadata = {
  title: 'MOIRA STUDIO | 기획서 관리',
  description: 'MOIRA STUDIO에서 저장된 AI 프로그램 기획서 목록을 확인하고 관리합니다.',
};

export default async function StudioDocumentsPage() {
  await requireStudioStaff('/studio/documents');

  return <StudioDocumentsManager />;
}
