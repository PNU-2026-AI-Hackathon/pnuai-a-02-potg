import { redirect } from 'next/navigation';
import SiteHeader from '@/components/layout/SiteHeader';
import MyPageDashboard from '@/components/mypage/MyPageDashboard';
import { getCurrentUser } from '@/lib/server-auth';

export default async function MyPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/mypage');

  return (
    <div className="moiraPage mypageRoot">
      <SiteHeader user={user} />
      <MyPageDashboard initialUser={user} />
    </div>
  );
}
