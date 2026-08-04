import { redirect } from 'next/navigation';
import SiteHeader from '@/components/layout/SiteHeader';
import MyPageProfileClient from '@/components/mypage/MyPageProfileClient';
import { getMyPageData } from '@/lib/mypage-data';

export default async function MyPage() {
  const data = await getMyPageData();
  if (!data) redirect('/login?next=/mypage');

  return (
    <div className="moiraPage mypageRoot">
      <SiteHeader user={data.profile} />
      <main className="mypageMain">
        <MyPageProfileClient
          initialProfile={data.profile}
          availableInterests={data.interests}
          initialInterests={data.selectedInterests}
          interestsAvailable={data.interestsAvailable}
        />
      </main>
      <footer className="moiraFooter">
        <div className="uiContainer moiraFooterInner">
          <div>
            <strong>MOIRA</strong>
            <p>주민의 목소리와 작은도서관을 잇는 지역 커뮤니티 플랫폼</p>
          </div>
          <p>부산광역시 금정구 예시로 123 · 대표전화 051-000-0000</p>
        </div>
      </footer>
    </div>
  );
}
