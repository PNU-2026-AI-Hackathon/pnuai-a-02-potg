import type { Metadata } from 'next';
import SiteHeader from '@/components/layout/SiteHeader';
import {
  StudioFeatureList,
  StudioPreview,
} from '@/components/home/StudioSection';
import StudioAccessCta from '@/components/studio/StudioAccessCta';
import { getCurrentUser } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'MOIRA Studio 소개 | 사서를 위한 AI 프로그램 기획 도구',
  description:
    '주민 의견과 수요조사를 분석해 사서의 도서관 문화·교육 프로그램 기획을 돕는 MOIRA Studio를 소개합니다.',
};

const studioValues = [
  {
    icon: '01',
    title: '주민의 목소리에서 시작',
    description: '지역 주민이 제안한 아이디어와 수요조사 결과를 기획의 출발점으로 활용합니다.',
  },
  {
    icon: 'AI',
    title: 'AI가 핵심 요구를 정리',
    description: '흩어진 의견에서 공통 관심사와 프로그램 기획에 필요한 조건을 빠르게 정리합니다.',
  },
  {
    icon: '✦',
    title: '사서의 전문성으로 완성',
    description: 'AI가 만든 초안을 사서가 직접 검토하고 수정해 실제 프로그램 기획에 활용합니다.',
  },
];

export default async function StudioAboutPage() {
  const user = await getCurrentUser();
  const accountType = user?.accountType ?? null;

  return (
    <div className="studioLandingPage">
      <SiteHeader user={user} activeMenu="studio" />
      <main>
        <section className="studioLandingHero" aria-labelledby="studio-landing-title">
          <div className="uiContainer studioLandingHeroInner">
            <div className="studioLandingHeroCopy">
              <p className="uiEyebrow">LIBRARIAN PLANNING TOOL</p>
              <h1 id="studio-landing-title">
                사서의 도서관 프로그램 기획을
                <span>더 빠르고 간편하게</span>
              </h1>
              <p className="studioLandingClaim">주민 의견을 기획으로 연결하는 AI 도구, MOIRA Studio</p>
              <p className="studioLandingLead">
                MOIRA Studio는 주민 의견과 수요조사 결과를 분석하여 사서와 도서관 프로그램
                기획 담당자가 지역에 필요한 문화·교육 프로그램의 기획 초안을 빠르게 작성할 수
                있도록 돕습니다.
              </p>
              <div className="studioLandingHeroActions">
                <StudioAccessCta accountType={accountType} />
              </div>
            </div>
            <div className="studioLandingHeroVisual">
              <span className="studioLandingVisualLabel" aria-hidden="true">AI DRAFT PREVIEW</span>
              <StudioPreview className="studioLandingPreview" />
            </div>
          </div>
        </section>

        <section className="studioLandingValue" aria-labelledby="studio-value-title">
          <div className="uiContainer">
            <div className="studioLandingSectionHeading">
              <p className="uiEyebrow">WHY MOIRA STUDIO</p>
              <h2 id="studio-value-title">지역의 필요와 사서의 전문성을 연결합니다</h2>
              <p>AI는 기획을 대신하는 것이 아니라, 주민의 목소리를 읽고 사서의 판단을 돕습니다.</p>
            </div>
            <div className="studioLandingValueGrid">
              {studioValues.map((value) => (
                <article key={value.title}>
                  <span aria-hidden="true">{value.icon}</span>
                  <strong>{value.title}</strong>
                  <p>{value.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          className="studioLandingWorkflow"
          id="studio-how-it-works"
          aria-labelledby="studio-workflow-title"
        >
          <div className="uiContainer studioLandingWorkflowInner">
            <div className="studioLandingSectionHeading">
              <p className="uiEyebrow">HOW IT WORKS</p>
              <h2 id="studio-workflow-title">4단계로 완성하는 프로그램 기획 초안</h2>
              <p>주민 의견을 선택하는 순간부터 사서의 검토까지, 기획 과정을 하나의 흐름으로 연결합니다.</p>
            </div>
            <StudioFeatureList className="studioLandingFeatureList" />
          </div>
        </section>

        <section className="studioLandingFinalCta" aria-labelledby="studio-final-title">
          <div className="uiContainer studioLandingFinalInner">
            <span className="studioTitleIcon" aria-hidden="true">✦</span>
            <p className="uiEyebrow">START WITH MOIRA</p>
            <h2 id="studio-final-title">주민의 아이디어에서 시작하는 다음 프로그램</h2>
            <p>MOIRA Studio와 함께 지역에 필요한 문화·교육 프로그램을 구체화해 보세요.</p>
            <StudioAccessCta accountType={accountType} compact />
          </div>
        </section>
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
