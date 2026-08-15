import type { Metadata } from 'next';
import ProgramBoardSearchClient from './ProgramBoardSearchClient';

export const metadata: Metadata = {
  title: '프로그램 의미 검색 파일럿',
  description: '정제 프로그램 37건의 의미 검색과 AI 기획서 생성을 검수합니다.',
};

export default function ProgramBoardSearchPilotPage() {
  return <ProgramBoardSearchClient />;
}
