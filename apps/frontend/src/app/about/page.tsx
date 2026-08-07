import Link from 'next/link';
import Image from 'next/image';
import SiteHeader from '@/components/layout/SiteHeader';
import { getCurrentUser } from '@/lib/server-auth';
import SectionHeading from '@/components/home/SectionHeading';
import AboutExperience from '@/components/about/AboutExperience';

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
    title: '우리 동네 아이디어',
    description: '주민이 우리 동네에 필요한 문화·교육 프로그램이나 지역 의견을 자유롭게 제안하고 다른 주민과 함께 의견을 나눌 수 있습니다.',
  },
  {
    icon: '⚙️',
    title: 'AI 기반 프로그램 기획 (MOIRA Studio)',
    description: '주민 의견과 기존 프로그램 사례를 바탕으로 AI가 문화·교육 프로그램 기획안을 생성하고 사서의 기획을 지원합니다.',
  },
  {
    icon: '📈',
    title: '프로그램 수요조사',
    description: '생성된 기획안을 주민에게 공개하여 참여 의향, 희망 요일·시간 등 운영 전 필요한 의견을 수집합니다.',
  },
  {
    icon: '🗂️',
    title: '문화·교육 프로그램 정보',
    description: '금정구 공공도서관과 작은도서관의 문화·교육 프로그램을 한곳에서 검색하고 확인할 수 있습니다.',
  },
  {
    icon: '📍',
    title: '우리 동네 도서관',
    description: '가까운 공공도서관과 작은도서관의 위치와 운영 정보를 확인하고 해당 도서관의 프로그램까지 바로 살펴볼 수 있습니다.',
  },
];

const audienceList = [
  {
    icon: '👥',
    label: '지역 주민',
    description: '우리 동네 문화·교육 프로그램을 찾고, 필요한 프로그램을 제안하며 다양한 도서관 서비스에 참여합니다.',
    items: [
      {
        icon: '▦',
        label: '프로그램 정보 확인',
        description: '프로그램 검색, 필터, 캘린더를 통해 원하는 문화·교육 프로그램을 쉽게 찾아볼 수 있습니다.',
      },
      {
        icon: '✎',
        label: '아이디어 제안',
        description: '우리 동네에 필요한 문화·교육 프로그램이나 지역 아이디어를 자유롭게 제안합니다.',
      },
      {
        icon: '✓',
        label: '수요조사 참여',
        description: '프로그램 기획안에 의견을 남기고 참여 의향을 표시합니다.',
      },
    ],
  },
  {
    icon: '🧑‍💻',
    label: '사서 및 프로그램 기획 담당자',
    description: '주민 의견을 바탕으로 AI의 도움을 받아 지역 맞춤형 문화·교육 프로그램을 기획하고 운영합니다.',
    items: [
      {
        icon: 'AI',
        label: 'MOIRA Studio',
        description: '주민 의견과 기존 프로그램 사례를 분석하여 AI가 프로그램 기획 초안을 생성합니다.',
      },
      {
        icon: '◔',
        label: '수요조사 및 프로그램 관리',
        description: '수요조사를 진행하고 결과를 반영하여 프로그램을 확정·운영합니다.',
      },
      {
        icon: '▤',
        label: '행사·소식 관리',
        description: '공지사항을 등록·수정하고 프로그램 정보를 통합 관리합니다.',
      },
    ],
  },
];

export default async function AboutPage() {
  const user = await getCurrentUser();

  return (
    <div className="introPage">
      <AboutExperience />
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
              <Link className="uiButton uiButtonPrimary" href="/community/free/write">
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
            description="주민 의견 수렴부터 AI 기반 문화·교육 프로그램 기획, 수요 조사, 프로그램 정보 제공까지 하나의 플랫폼에서 지원합니다."
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
            title="누구나 참여하고, 함께 만들어갑니다"
            description="주민은 필요한 문화·교육 프로그램을 제안하고, 프로그램 기획 담당자는 AI의 도움을 받아 지역 맞춤형 프로그램을 기획합니다."
          />
          <div className="audienceGrid">
            {audienceList.map((audience) => (
              <article key={audience.label} className="introCard audienceCard">
                <div className="audienceCardHeader">
                  <span className="audienceCardIcon" aria-hidden="true">{audience.icon}</span>
                  <div>
                    <strong>{audience.label}</strong>
                    <p>{audience.description}</p>
                  </div>
                </div>
                <ul>
                  {audience.items.map((item) => (
                    <li key={item.label}>
                      <span aria-hidden="true">{item.icon}</span>
                      <strong>{item.label}</strong>
                      <p>{item.description}</p>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="visionSection">
        <div className="uiContainer visionInner">
          <p className="uiEyebrow">MOIRA VISION</p>
          <h2>더 나은 도서관은 주민의 목소리에서 시작됩니다.</h2>
          <p className="visionLead">
            도서관이 지역사회의 커뮤니티 거점으로 자리 잡고,<br />
            주민의 의견이 지역에 꼭 필요한 문화·교육 프로그램으로 이어질 수 있도록.
          </p>
          <div className="visionConnection" role="img" aria-label="주민의 의견이 모이라를 통해 사서의 전문성과 연결됩니다">
            <span className="visionNode">
              <svg className="visionNodeSymbol" viewBox="0 0 32 32" aria-hidden="true">
                <circle cx="12" cy="10" r="4" />
                <circle cx="22" cy="12" r="3" />
                <path d="M4.5 25c.7-5 3.2-7.5 7.5-7.5s6.8 2.5 7.5 7.5M19 18.5c4.7 0 7.3 2.1 8 6.5" />
              </svg>
              <span>주민</span>
            </span>
            <span className="visionArrow" aria-hidden="true" />
            <span className="visionNode isMoira">
              <Image
                className="visionNodeLogo"
                src="/moira-logo-mark-no-ai.png"
                alt=""
                width={54}
                height={42}
              />
              <span>MOIRA</span>
            </span>
            <span className="visionArrow" aria-hidden="true" />
            <span className="visionNode">
              <svg className="visionNodeSymbol" viewBox="0 0 32 32" aria-hidden="true">
                <path d="M4.5 6.5h7.2c2.2 0 3.8.8 4.3 2.1.5-1.3 2.1-2.1 4.3-2.1h7.2v18h-7.2c-2.2 0-3.8.7-4.3 2-.5-1.3-2.1-2-4.3-2H4.5zM16 8.6v17.9" />
              </svg>
              <span>사서</span>
            </span>
          </div>
          <p className="visionClosing">
            모이라는 주민과 사서를 연결하며,<br />
            함께 만드는 지역 도서관의 새로운 시작이 되고자 합니다.
          </p>
          <p className="visionPromise">더 많은 주민의 목소리가 더 좋은 프로그램으로 이어질 수 있도록, 모이라가 함께하겠습니다.</p>
          <span className="visionSparkle" aria-hidden="true">✦</span>
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
