import CommunityPostEditForm from '@/components/community/CommunityPostEditForm';

export default async function CommunityPostEditPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return <CommunityPostEditForm postId={postId} />;
}
