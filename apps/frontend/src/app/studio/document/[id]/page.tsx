import type { Metadata } from 'next';
import StudioDocumentEditor from '@/components/studio/StudioDocumentEditor';
import { requireStudioStaff } from '@/lib/studio-access';

export const metadata: Metadata = {
  title: 'MOIRA STUDIO | AI 프로그램 기획서 편집',
  description: 'MOIRA STUDIO에서 AI가 생성한 프로그램 기획서 초안을 확인하고 직접 편집합니다.',
};

type StudioDocumentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StudioDocumentPage({ params }: StudioDocumentPageProps) {
  await requireStudioStaff('/studio/documents');

  const { id } = await params;

  return <StudioDocumentEditor documentId={id} />;
}
