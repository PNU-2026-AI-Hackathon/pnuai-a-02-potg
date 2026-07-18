import { getCurrentUser } from '@/lib/server-auth';
import SiteHeader from '@/components/layout/SiteHeader';
import HeroSection from '@/components/home/HeroSection';
import StudioSection from '@/components/home/StudioSection';
import PopularAgendaSection from '@/components/home/PopularAgendaSection';
import ProgramSurveySection from '@/components/home/ProgramSurveySection';
import RecruitingProgramSection from '@/components/home/RecruitingProgramSection';
import LibraryFinderSection from '@/components/home/LibraryFinderSection';

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="moiraPage">
      <SiteHeader user={user} activeMenu="home" />
      <main>
        <HeroSection />
        <StudioSection />
        <PopularAgendaSection />
        <ProgramSurveySection />
        <RecruitingProgramSection />
        <LibraryFinderSection />
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
