import type { Metadata } from 'next';
import IdeaWhiteboard from '@/components/ideas/IdeaWhiteboard';

export const metadata: Metadata = { title: 'Whiteboard 아이디어 게시판 | 모이라' };
export default function WhiteboardIdeasPage() { return <IdeaWhiteboard />; }
