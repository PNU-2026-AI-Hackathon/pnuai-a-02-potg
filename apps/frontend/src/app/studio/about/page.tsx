import type { Metadata } from 'next';
import {
  StudioFeatureList,
  StudioPreview,
} from '@/components/home/StudioSection';
import StudioAccessCta from '@/components/studio/StudioAccessCta';
import StudioLandingExperience from '@/components/studio/StudioLandingExperience';
import { getCurrentUser } from '@/lib/server-auth';

export const metadata: Metadata = {
  title: 'MOIRA STUDIO 소개 | 사서를 위한 AI 프로그램 기획 도구',
  description:
    '주민 의견과 수요조사를 분석해 사서의 도서관 문화·교육 프로그램 기획을 돕는 MOIRA STUDIO를 소개합니다.',
};

const studioValues = [
  {
    icon: 'community',
    title: '지역 수요를 반영한 프로그램 기획',
    description: '주민 의견과 수요조사를 바탕으로 지역에 필요한 프로그램을 기획할 수 있습니다.',
  },
  {
    icon: 'sparkles',
    title: '기획 과정의 부담 완화',
    description: '의견 분석과 초안 작성을 AI가 지원하여 프로그램 기획에 필요한 시간과 부담을 줄입니다.',
  },
  {
    icon: 'review',
    title: '담당자의 전문성을 중심으로',
    description: 'AI가 생성한 초안을 사서와 프로그램 기획 담당자가 직접 검토하고 수정하여 완성합니다.',
  },
];

function StudioValueIcon({ type }: { type: string }) {
  if (type === 'community') {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M4.5 5.5h13v9h-7l-4.5 3v-3H4.5v-9Z" />
        <path d="M11 17.5h6l4.5 3v-3h2v-8h-3M8 9h6M8 11.8h4" />
      </svg>
    );
  }

  if (type === 'sparkles') {
    return (
      <svg viewBox="0 0 28 28" aria-hidden="true">
        <path d="M13.5 3.5c.7 4.5 2.8 6.6 7.2 7.2-4.4.7-6.5 2.8-7.2 7.2-.7-4.4-2.8-6.5-7.2-7.2 4.4-.6 6.5-2.7 7.2-7.2Z" />
        <path d="M21.5 17.5c.3 2.1 1.3 3.1 3.4 3.4-2.1.3-3.1 1.3-3.4 3.4-.3-2.1-1.3-3.1-3.4-3.4 2.1-.3 3.1-1.3 3.4-3.4ZM5.5 18.5v4M3.5 20.5h4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="10.5" cy="8.5" r="4" />
      <path d="M3.5 22c.7-5 3-7.5 7-7.5 2.5 0 4.3 1 5.5 3" />
      <circle cx="20.5" cy="19.5" r="5" />
      <path d="m18.2 19.5 1.5 1.5 3.1-3.2" />
    </svg>
  );
}

const studioLandingFeatures = [
  {
    number: '01',
    title: '주민 의견 및 수요조사 선택',
    description: '아이디어 게시판에 등록된 주민 의견이나 수요조사 결과 중 프로그램 기획에 반영할 지역 수요를 선택합니다.',
  },
  {
    number: '02',
    title: 'AI 기반 주민 의견 분석',
    description: '선택한 주민 의견과 수요조사 결과를 AI가 분석하여 주요 요구와 관심 주제를 파악하고, 프로그램 기획에 필요한 내용을 정리합니다.',
  },
  {
    number: '03',
    title: '프로그램 기획 초안 생성',
    description: '분석한 지역 수요를 바탕으로 대상, 운영 방식, 주요 활동 등 프로그램 구성 요소가 포함된 기획 초안을 생성합니다.',
  },
  {
    number: '04',
    title: '담당자 검토·수정 및 활용',
    description: '사서와 프로그램 기획 담당자가 생성된 초안을 검토하고 필요한 내용을 수정해 실제 프로그램 기획에 활용합니다.',
  },
];

/**
 * 이 화면은 로그인 상태에 따라 버튼이 다르게 움직인다. 미리 만들어 둔 화면을 내주면
 * 로그인한 사서에게 로그아웃 상태로 만든 화면이 그대로 갈 수 있어, 매번 새로 그린다.
 */
export const dynamic = 'force-dynamic';

export default async function StudioAboutPage() {
  const user = await getCurrentUser();
  const accountType = user?.accountType ?? null;

  return (
    <div className="studioLandingPage">
      <StudioLandingExperience />
      <main>
        <section className="studioLandingHero" aria-labelledby="studio-landing-title">
          <div className="uiContainer studioLandingHeroInner">
            <div className="studioLandingHeroCopy">
              <p className="uiEyebrow">LIBRARIAN PLANNING TOOL</p>
              <h1 id="studio-landing-title">
                사서의 도서관 프로그램 기획을
                <span>더 빠르고 간편하게</span>
              </h1>
              <p className="studioLandingClaim">주민 의견을 기획으로 연결하는 AI 도구, MOIRA STUDIO</p>
              <p className="studioLandingLead">
                MOIRA STUDIO는 주민 의견과 수요조사 결과를 분석하여 사서와 도서관 프로그램
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
              <h2 id="studio-value-title">프로그램 기획의 부담은 줄이고, 지역의 필요는 더 가까이</h2>
              <p>AI는 기획을 대신하는 것이 아니라, 주민의 목소리를 읽고 사서의 판단을 돕습니다.</p>
            </div>
            <div className="studioLandingValueGrid">
              {studioValues.map((value) => (
                <article key={value.title}>
                  <span aria-hidden="true"><StudioValueIcon type={value.icon} /></span>
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
            <StudioFeatureList
              className="studioLandingFeatureList"
              features={studioLandingFeatures}
            />
          </div>
        </section>

        <section className="studioLandingFinalCta" aria-labelledby="studio-final-title">
          <div className="uiContainer studioLandingFinalInner">
            <span className="studioTitleIcon" aria-hidden="true">✦</span>
            <p className="uiEyebrow">START WITH MOIRA</p>
            <h2 id="studio-final-title">
              MOIRA STUDIO와 함께<br />
              프로그램 기획을 시작해보세요
            </h2>
            <p>주민 의견과 수요조사를 바탕으로 지역에 필요한 문화·교육 프로그램의 기획 초안을 만들어보세요.</p>
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
