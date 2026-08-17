import SiteHeader from '@/components/layout/SiteHeader';
import StudioVotingBoard from '@/components/studio/StudioVotingBoard';
import { getCurrentUser } from '@/lib/server-auth';

export default async function VotesPage() {
  const user = await getCurrentUser();
  return <><SiteHeader user={user} activeMenu="community" /><StudioVotingBoard /></>;
}
