import SiteHeader from '@/components/layout/SiteHeader';
import { getCurrentUser } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export default async function StudioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <div className="studioAppShell">
      <SiteHeader user={user} activeMenu="studio" />
      {children}
    </div>
  );
}
