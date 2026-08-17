import type { Metadata } from 'next';
import ProgramConditionForm from '@/components/studio/ProgramConditionForm';
import { getCommunityPost, getCommunityPosts, type CommunityPost } from '@/lib/community-boards';
import type { StudioAgendaOption } from '@/components/studio/ProgramConditionForm';
import { requireStudioStaff } from '@/lib/studio-access';

export const metadata: Metadata = {
  title: 'MOIRA Studio | 프로그램 기획 조건 선택',
  description: 'MOIRA Studio에서 도서관 프로그램 기획 조건을 선택합니다.',
};

/**
 * 선택창에 실을 의제 수.
 *
 * 여기는 읽는 곳이 아니라 고르는 곳이다. 전부 실으면 사서가 끝까지 내려보지 않고
 * 아무거나 고르게 된다. 더 보고 싶으면 게시판으로 가서 거기서 고르면 된다.
 */
const AGENDA_PICK_LIMIT = 5;

function toAgendaOption(post: CommunityPost): StudioAgendaOption {
  return { id: post.id, title: post.title, content: post.content, tags: post.tags };
}

type StudioPageProps = {
  searchParams: Promise<{ agenda?: string }>;
};

export default async function StudioPage({ searchParams }: StudioPageProps) {
  await requireStudioStaff('/studio');

  const { agenda } = await searchParams;
  const [posts, pickedPost] = await Promise.all([
    getCommunityPosts('ideas'),
    agenda ? getCommunityPost(agenda) : Promise.resolve(null),
  ]);

  const options = posts.slice(0, AGENDA_PICK_LIMIT).map(toAgendaOption);

  /**
   * 게시판에서 고른 글이 상위 목록 밖일 수 있다. 그러면 선택창에 없는 것을 고른 셈이 되어
   * 화면에 아무 표시도 남지 않으므로, 그 글은 목록 맨 앞에 끼워 넣는다.
   */
  if (pickedPost && !options.some((option) => option.id === pickedPost.id)) {
    options.unshift(toAgendaOption(pickedPost));
  }

  return (
    <ProgramConditionForm
      agendaOptions={options}
      initialAgendaId={pickedPost ? pickedPost.id : null}
    />
  );
}
