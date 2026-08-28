import SiteHeader from '@/components/layout/SiteHeader';
import StudioVotingDetail from '@/components/studio/StudioVotingDetail';
import { getCurrentUser } from '@/lib/server-auth';

type Props = { params: Promise<{ id: string }> };

export default async function VoteDetailPage({ params }: Props) {
  const [{ id }, user] = await Promise.all([params, getCurrentUser()]);
  return <><SiteHeader user={user} activeMenu="community" /><StudioVotingDetail documentId={id} /></>;
}
