import type { Metadata } from 'next';
import IdeaKanbanBoard from '@/components/ideas/IdeaKanbanBoard';

export const metadata: Metadata = { title: 'Kanban 아이디어 게시판 | 모이라' };
export default function KanbanIdeasPage() { return <IdeaKanbanBoard />; }
