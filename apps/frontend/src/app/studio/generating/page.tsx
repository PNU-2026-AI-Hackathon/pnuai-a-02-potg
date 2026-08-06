import type { Metadata } from 'next';
import StudioGenerationLoading from '@/components/studio/StudioGenerationLoading';

export const metadata: Metadata = {
  title: 'MOIRA STUDIO | 기획안 생성 중',
  description: 'MOIRA STUDIO 프로그램 기획안 생성 준비 화면입니다.',
};

export default function StudioGeneratingPage() {
  return <StudioGenerationLoading />;
}
