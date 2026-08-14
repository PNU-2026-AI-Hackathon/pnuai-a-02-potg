import type { Metadata } from 'next';
import StudioDocumentsManager from '@/components/studio/StudioDocumentsManager';

export const metadata: Metadata = {
  title: 'MOIRA STUDIO | 기획서 관리',
  description: 'MOIRA STUDIO에서 저장된 AI 프로그램 기획서 목록을 확인하고 관리합니다.',
};

export default function StudioDocumentsPage() {
  return <StudioDocumentsManager />;
}
