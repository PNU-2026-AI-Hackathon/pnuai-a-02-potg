import SiteHeader from '@/components/layout/SiteHeader';
import { getCurrentUser } from '@/lib/server-auth';

export default async function CommunityLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <div className="page">
      <SiteHeader user={user} activeMenu="community" />
      {children}
    </div>
  );
}
