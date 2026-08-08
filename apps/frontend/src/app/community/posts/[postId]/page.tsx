import CommunityPostDetail from '@/components/community/CommunityPostDetail';

export default async function CommunityPostDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  return <CommunityPostDetail postId={postId} />;
}
