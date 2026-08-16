import type { Metadata } from 'next';
import StudioPlanClient from './StudioPlanClient';

export const metadata: Metadata = {
  title: '기획서 틀 검증 | MOIRA Studio',
  description: '정제한 프로그램에서 참고 사례를 찾아 기획서를 항목 구조로 만들고 항목만 고칩니다.',
};

export default function StudioPlanPage() {
  return <StudioPlanClient />;
}
