import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import { getCurrentUser } from '@/lib/server-auth';
import SectionHeading from '@/components/home/SectionHeading';

const problemItems = [
  {
    title: '사서의 프로그램 기획 부담 증가',
    description:
      '작은도서관 사서가 지역 의제와 참여를 모두 고려해 프로그램을 기획하기 어렵습니다.',
  },
  {
    title: '다양한 프로그램, 낮은 주민 참여',
    description:
      '좋은 프로그램이 있어도 주민 참여가 부족해 지속 가능한 운영이 힘듭니다.',
  },
  {
    title: '작은도서관의 지역 커뮤니티 기능 약화',
    description:
      '지역 주민 활동과 도서관 프로그램이 쉽게 연결되지 않아 공동체 성장이 멈춥니다.',
  },
];

const valueItems = [
  {
    icon: '🗣️',
    title: '주민의 의견에서 시작됩니다.',
    description: '동네 사람들이 제안한 이야기들이 모이라의 출발점입니다.',
  },
  {
    icon: '🤖',
    title: 'AI가 프로그램 기획을 돕습니다.',
    description: '모이라 스튜디오가 제안을 분석하고 실현 가능한 기획을 만듭니다.',
  },
  {
    icon: '🧑‍💼',
    title: '사서가 지역 상황에 맞게 검토합니다.',
    description: '사서는 AI 기획안을 지역에 맞게 다듬어 실제 운영으로 연결합니다.',
  },
  {
    icon: '✅',
    title: '주민이 다시 프로그램에 참여합니다.',
    description: '수요조사와 참여 기회를 통해 주민들이 직접 프로그램을 만들어갑니다.',
  },
  {
    icon: '🌱',
    title: '지역 공동체가 활성화됩니다.',
    description: '작은도서관 중심으로 선순환하는 지역 커뮤니티를 만듭니다.',
  },
];

const serviceSteps = [
  {
    number: '01',
    title: '주민 아이디어',
    description: '주민이 필요한 프로그램이나 지역 이야기를 제안합니다.',
  },
  {
    number: '02',
    title: '지역 의제 도출',
    description: 'AI가 주민 의견을 분류해 지역 의제를 도출합니다.',
  },
  {
    number: '03',
    title: 'MOIRA Studio',
    description: '사서가 AI 기획안을 검토하고 보완합니다.',
  },
  {
    number: '04',
    title: '주민 수요조사',
    description: '기획안을 공개해 주민 참여 의향을 확인합니다.',
  },
  {
    number: '05',
    title: '프로그램 운영',
    description: '확정된 프로그램을 실제 도서관 운영으로 연결합니다.',
  },
];

const exampleSteps = [
  {
    title: '주민 제안 등록',
    description: '“청소년을 위한 AI 교육 프로그램이 있었으면 좋겠어요.”',
  },
  {
    title: '사서가 의제 선택',
    description: '작은도서관 사서가 제안을 확인하고 기획 후보로 올립니다.',
  },
  {
    title: 'MOIRA Studio가 기획안 생성',
    description: '기존 사례와 주민 요구를 바탕으로 프로그램 초안을 만듭니다.',
  },
  {
    title: '수요조사 참여',
    description: '많은 주민이 참여 의사를 표시하며 프로그램 실행 가능성을 확인합니다.',
  },
  {
    title: '작은도서관 프로그램 운영',
    description: '검증된 기획이 실제 라이브러리 프로그램으로 이어집니다.',
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
            title="지역 주민과 작은도서관을 연결하는 플랫폼"
            description="모이라는 단순한 AI 도구가 아니라, 주민의 참여와 사서의 실행력이 만나는 커뮤니티 허브입니다."
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
        </div>
      </section>

      <section className="homeSection flowSection">
        <div className="uiContainer">
          <SectionHeading
            eyebrow="HOW MOIRA WORKS"
            title="모이라는 이렇게 작동합니다."
            description="지역 의제 제안부터 프로그램 운영까지, 5단계로 이어지는 서비스 흐름을 시각적으로 보여줍니다."
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

      <section className="homeSection exampleSection">
        <div className="uiContainer">
          <SectionHeading
            eyebrow="REAL EXAMPLE"
            title="실제 이용 예시로 보는 모이라의 연결 과정"
            description="한 건의 지역 제안이 작은도서관 프로그램으로 운영되기까지의 흐름을 타임라인으로 정리했습니다."
          />
          <div className="timelineShell">
            <ol className="timelineList">
              {exampleSteps.map((step, index) => (
                <li key={step.title}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
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

      <section className="homeSection futureSection">
        <div className="uiContainer">
          <SectionHeading
            eyebrow="WHAT'S NEXT"
            title="앞으로의 계획"
            description="현재 금정구 작은도서관을 시작으로, 공공도서관과 부산 지역, 전국 작은도서관으로 확장하는 것을 목표로 합니다."
          />
          <div className="futureContent">
            <div className="futureText">
              <p>
                현재 모이라는 금정구 작은도서관을 중심으로 지역 주민의 참여와
                도서관 프로그램을 연결하는 실험을 진행하고 있습니다. 향후에는
                공공도서관과 부산 전역, 전국 작은도서관까지 서비스를 확장하여
                더 많은 지역 커뮤니티가 함께 성장할 수 있도록 합니다.
              </p>
            </div>
            <div className="futureList">
              <article className="introCard futureCard">
                <span>01</span>
                <strong>공공도서관</strong>
                <p>지역 의제를 반영한 공공도서관 프로그램 운영 지원</p>
              </article>
              <article className="introCard futureCard">
                <span>02</span>
                <strong>부산 지역</strong>
                <p>금정구를 넘어 부산 전체 작은도서관 커뮤니티로 확장</p>
              </article>
              <article className="introCard futureCard">
                <span>03</span>
                <strong>전국 작은도서관</strong>
                <p>전국 작은도서관이 주민과 함께 프로그램을 기획하고 운영하는 플랫폼</p>
              </article>
            </div>
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
