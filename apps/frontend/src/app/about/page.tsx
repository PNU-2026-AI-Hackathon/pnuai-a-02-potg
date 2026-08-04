import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import { getCurrentUser } from '@/lib/server-auth';
import SectionHeading from '@/components/home/SectionHeading';

const valueItems = [
  {
    icon: '🗣️',
    title: '주민 의견을 반영할 창구가 부족합니다.',
    description: '기존 도서관 홈페이지는 문화·교육 프로그램 안내와 신청 중심으로 운영되어 주민이 필요한 프로그램을 제안하고 기획에 참여하기 어렵습니다.',
  },
  {
    icon: '⏱️',
    title: '프로그램 기획에는 많은 시간과 노력이 필요합니다.',
    description: '사서는 다양한 업무와 함께 문화·교육 프로그램을 기획해야 하므로 주민 수요를 지속적으로 반영하기 어렵습니다.',
  },
  {
    icon: '🔗',
    title: '의견 수렴부터 수요조사까지 연결되지 않습니다.',
    description: '주민 의견 수렴, AI 프로그램 기획, 운영 전 수요조사가 하나의 흐름으로 이어지는 서비스가 부족합니다.',
  },
];

const serviceSteps = [
  {
    number: '01',
    title: '주민 아이디어',
    description: '주민이 우리 동네에 필요한 문화·교육 프로그램과 지역 의견을 자유롭게 제안합니다.',
  },
  {
    number: '02',
    title: '지역 의제 도출',
    description: 'AI가 주민 의견을 분석·분류하여 주요 관심 주제와 지역 의제를 정리합니다.',
  },
  {
    number: '03',
    title: 'MOIRA Studio',
    description: '사서가 주민 의견과 기존 프로그램 사례를 바탕으로 AI 기획안 초안을 만들고 검토·보완합니다.',
  },
  {
    number: '04',
    title: '주민 수요조사',
    description: '기획안을 공개하여 참여 의향, 희망 요일·시간대와 주민 의견을 확인합니다.',
  },
  {
    number: '05',
    title: '프로그램 운영',
    description: '수요조사 결과를 반영해 기획안을 보완하고 실제 도서관 문화·교육 프로그램으로 운영합니다.',
  },
];

const featureItems = [
  {
    icon: '📝',
    title: '지역 의제 제안 게시판',
    description: '주민이 동네 변화와 필요한 프로그램을 쉽게 제안할 수 있습니다.',
  },
  {
    icon: '⚙️',
    title: 'AI 프로그램 기획(MOIRA Studio)',
    description: 'AI가 의견을 분석해 도서관 운영에 맞는 기획안을 빠르게 작성합니다.',
  },
  {
    icon: '📈',
    title: '주민 수요조사 및 투표',
    description: '주민 의견을 수치로 확인해 프로그램 우선순위를 정합니다.',
  },
  {
    icon: '🗂️',
    title: '행사 및 소식 / 자유게시판',
    description: '지역 소통과 정보 공유를 위한 커뮤니티 기능을 제공합니다.',
  },
  {
    icon: '📍',
    title: '금정구 작은도서관 위치 정보',
    description: '우리 동네 작은도서관 정보를 한눈에 확인할 수 있습니다.',
  },
];

const audienceList = [
  {
    label: '지역 주민',
    items: [
      '지역 의제 제안',
      '수요조사 참여',
      '프로그램 참여',
      '커뮤니티 이용',
    ],
  },
  {
    label: '사서',
    items: [
      '모이라 스튜디오 이용',
      'AI 프로그램 기획',
      '수요조사 결과 확인',
      '프로그램 운영',
    ],
  },
];

export default async function AboutPage() {
  const user = await getCurrentUser();

  return (
    <div className="introPage">
      <SiteHeader user={user} activeMenu="about" />
      <section className="introHero">
        <div className="uiContainer introHeroGrid">
          <div className="introHeroCopy">
            <p className="uiEyebrow">도서관 프로그램 특화 플랫폼</p>
            <h1>
              주민의 아이디어가
              <span className="h1LineBreak">도서관 프로그램이 되는 곳</span>
            </h1>
            <p className="introHeroLead">
              모이라는 주민이 제안한 프로그램 아이디어와 지역 의견을 AI가 분석해
              사서의 문화·교육 프로그램 기획을 지원하는 AI 기반 도서관 프로그램
              특화 플랫폼입니다. 프로그램 수요조사와 통합 정보 제공을 통해
              주민과 도서관이 함께 지역 맞춤형 프로그램을 만들어갑니다.
            </p>

            <div className="homeHeroActions">
              <Link className="uiButton uiButtonPrimary" href="/community/proposals">
                우리 동네 아이디어 제안하기
                <span aria-hidden="true">→</span>
              </Link>
              <Link className="uiButton uiButtonSecondary" href="/#library-finder">
                프로그램 둘러보기
              </Link>
            </div>

            <div className="introHeroPills" aria-label="모이라 핵심 키워드">
              <span># 주민 아이디어</span>
              <span># AI 기획 지원</span>
              <span># MOIRA Studio</span>
              <span># 프로그램 수요 조사</span>
            </div>
          </div>

          <div className="introHeroVisual" aria-label="MOIRA Studio 목업">
            <div className="studioMockupShell">
              <div className="studioMockupInner">
                <p className="studioMockupEyebrow">LIBRARIAN PLANNING TOOL</p>
                <h2 className="studioMockupTitle">MOIRA STUDIO</h2>
                <p className="studioMockupSubtitle">
                  주민의 이야기에서 시작하는 도서관 프로그램 기획을 짧은 메모로 시작하세요.
                </p>

                <div className="studioMockupCard">
                  <div className="studioModeTabs" role="tablist" aria-label="기획 모드">
                    <button type="button" className="isActive">
                      프로그램 기획
                    </button>
                    <button type="button">지역 의제</button>
                  </div>

                  <div className="studioFieldGroup">
                    <label className="studioFieldLabel">기획 메모</label>
                    <div className="studioTextBlock">
                      예: 초등 고학년과 함께 우리 동네 기억을 수집하는 4회차 프로그램
                    </div>
                  </div>

                  <div className="studioSelectRow">
                    <div className="studioSelectBox">
                      <span>프로그램 분야</span>
                      <strong>문화예술</strong>
                    </div>
                    <div className="studioSelectBox">
                      <span>대상</span>
                      <strong>초등학생</strong>
                    </div>
                    <div className="studioSelectBox">
                      <span>운영 기간</span>
                      <strong>8주</strong>
                    </div>
                  </div>

                  <div className="studioActionBar">
                    <span>만들고 싶은 프로그램을 한 줄로 적어주세요.</span>
                    <button type="button">기획안 만들기</button>
                  </div>
                </div>

                <p className="studioMockupFootnote">
                  기획 초안은 사서의 검토와 지역 상황에 맞춘 조정을 전제로 합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="homeSection valueSection">
        <div className="uiContainer">
          <SectionHeading
            eyebrow="MOIRA VALUE"
            title={'주민의 의견을 반영한\n도서관 문화·교육 프로그램 기획, 더 쉽게 할 수 없을까요?'}
            description={'도서관의 문화·교육 프로그램은 점점 중요해지고 있지만,\n주민 의견을 반영하면서 새로운 프로그램을 기획하기에는 현실적인 어려움이 있습니다.'}
          />
          <div className="valueGrid">
            {valueItems.map((item) => (
              <article key={item.title} className="introCard valueCard">
                <div className="introCardIcon" aria-hidden="true">
                  {item.icon}
                </div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
          <aside className="valueConclusion">
            <span className="valueConclusionIcon" aria-hidden="true">“</span>
            <div>
              <strong>모이라는 이 모든 과정을 하나의 플랫폼에서 연결합니다.</strong>
              <p>주민 아이디어 제안부터 AI 기반 프로그램 기획, 수요조사까지 모두 모이라에서 가능합니다.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="homeSection flowSection">
        <div className="uiContainer">
          <SectionHeading
            eyebrow="HOW MOIRA WORKS"
            title="주민의 아이디어가 프로그램이 되기까지"
            description="주민이 제안한 아이디어는 AI 분석과 사서의 기획, 주민 수요조사를 거쳐 실제 도서관 문화·교육 프로그램으로 이어집니다."
          />
          <div className="pipeline" aria-label="모이라는 이렇게 작동합니다.">
            {serviceSteps.map((step, index) => {
              const isStudio = step.title === 'MOIRA Studio';

              return (
                <div key={step.number} className={`pipelineItem ${isStudio ? 'isStudioHighlight' : ''}`}>
                  <div className="pipelineStep">
                    <span className={`pipelineNumber ${isStudio ? 'isStudioNumber' : ''}`}>
                      {step.number}
                    </span>
                    {index < serviceSteps.length - 1 && (
                      <span className="pipelineConnector" aria-hidden="true" />
                    )}
                  </div>

                  <div className="pipelineMeta">
                    <h3 className={isStudio ? 'studioHighlightTitle' : ''}>
                      {isStudio ? (
                        <>
                          <span className="flowStudioBrand">MOIRA Studio</span>
                        </>
                      ) : (
                        step.title
                      )}
                    </h3>
                    <p>{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="homeSection featureSection">
        <div className="uiContainer">
          <SectionHeading
            eyebrow="KEY FEATURES"
            title="모이라의 주요 기능"
            description="지역 커뮤니티와 도서관 프로그램을 자연스럽게 연결하는 기능을 카드로 만나보세요."
          />
          <div className="featureGrid">
            {featureItems.map((item) => (
              <article key={item.title} className="introCard featureCard">
                <div className="introCardIcon" aria-hidden="true">
                  {item.icon}
                </div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="homeSection audienceSection">
        <div className="uiContainer">
          <SectionHeading
            eyebrow="WHO IT'S FOR"
            title="이용 대상"
            description="모이라는 지역 주민과 사서를 모두 위한 서비스입니다. 각 사용자는 서로 다른 방식으로 참여합니다."
          />
          <div className="audienceGrid">
            {audienceList.map((audience) => (
              <article key={audience.label} className="introCard audienceCard">
                <strong>{audience.label}</strong>
                <ul>
                  {audience.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="aboutCtaSection">
        <div className="uiContainer aboutCtaInner">
          <p className="uiEyebrow">CONNECT WITH MOIRA</p>
          <h2>주민과 사서를 연결하는<br />지역 도서관 프로그램 플랫폼</h2>
          <p>우리 동네에 필요한 아이디어를 나누고, 함께할 프로그램을 만나보세요.</p>
          <div className="aboutCtaActions">
            <Link className="uiButton uiButtonPrimary" href="/community/proposals">
              우리 동네 아이디어 제안하기
            </Link>
            <Link className="uiButton uiButtonSecondary" href="/#library-finder">
              프로그램 둘러보기
            </Link>
          </div>
        </div>
      </section>
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
