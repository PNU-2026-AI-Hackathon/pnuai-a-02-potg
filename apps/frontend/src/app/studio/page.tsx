import type { Metadata } from 'next';
import ProgramConditionForm from '@/components/studio/ProgramConditionForm';

export const metadata: Metadata = {
  title: 'MOIRA STUDIO | 프로그램 기획 조건 선택',
  description: 'MOIRA STUDIO에서 도서관 프로그램 기획 조건을 선택합니다.',
};

export default function StudioPage() {
  return <ProgramConditionForm />;
}
