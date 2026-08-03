import type { Metadata } from 'next';
import IdeaThreadBoard from '@/components/ideas/IdeaThreadBoard';

export const metadata: Metadata = { title: 'Thread 아이디어 게시판 | 모이라' };
export default function ThreadIdeasPage() { return <IdeaThreadBoard />; }
