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

const flowSteps = [
  {
    icon: '📌',
    title: '지역 주민이 지역 의제를 제안',
  },
  {
    icon: '💡',
    title: '사서가 모이라 스튜디오에서 AI 기획안 생성',
  },
  {
    icon: '📊',
    title: '주민 대상 수요조사 진행',
  },
  {
    icon: '📚',
    title: '실제 프로그램 개설 및 운영',
  },
  {
    icon: '🤝',
    title: '지역사회 참여 확대',
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
            <p className="uiEyebrow">금정구 작은도서관을 위한 AI 기반 지역 커뮤니티 플랫폼</p>
            <h1>
              모이라,
              <br />
              모두가 이어지는 라이브러리
            </h1>
            <p className="homeHeroLead">
              모이라는 지역 주민과 작은도서관을 연결해,
              <br />
              생활 속 의제를 프로그램으로 바꾸는 커뮤니티 경험을 만듭니다.
            </p>
            <div className="homeHeroActions">
              <Link className="uiButton uiButtonPrimary" href="/community">
                지역 커뮤니티 둘러보기
                <span aria-hidden="true">→</span>
              </Link>
              <Link className="uiButton uiButtonSecondary" href="#why-moira">
                모이라 스튜디오 알아보기
              </Link>
            </div>
          </div>

          <div className="introHeroVisual" aria-hidden="true">
            <div className="introHeroBadge">
              <span>MOIRA</span>
              <small>지역 커뮤니티를 잇는 플랫폼</small>
            </div>
            <div className="introHeroCard">
              <div className="introHeroCardHeader">
                <p>금정구 작은도서관</p>
                <strong>AI 기반 기획 흐름</strong>
              </div>
              <ul className="introHeroKeypoints">
                <li>주민 제안 → AI 기획 → 수요조사 → 운영</li>
                <li>사서 검토로 지역 특성에 맞게 조정</li>
                <li>커뮤니티 참여가 다시 새로운 프로그램으로</li>
              </ul>
            </div>
            <div className="introHeroStats">
              <div>
                <strong>5</strong>
                <span>단계로 연결되는 서비스</span>
              </div>
              <div>
                <strong>금정구</strong>
                <span>작은도서관 전용</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="homeSection whySection" id="why-moira">
        <div className="uiContainer">
          <SectionHeading
            eyebrow="WHY MOIRA"
            title="작은도서관이 지금 더 필요한 이유"
            description="금정구 작은도서관은 주민과 프로그램을 잇는 연결고리이지만, 기획과 참여 사이에서 어려움을 겪고 있습니다. 모이라는 그 간극을 메우는 플랫폼입니다."
          />
          <div className="problemGrid">
            {problemItems.map((item) => (
              <article key={item.title} className="introCard">
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
          <div className="whyNarrative">
            <p>
              작은도서관은 지역 커뮤니티의 중심입니다. 하지만 주민의 목소리를
              프로그램으로 연결하는 일은 사서의 부담으로 남았습니다.
              모이라는 AI와 지역 데이터를 결합하여 이 과정을 단순화하고,
              사서와 주민이 함께 만들어가는 선순환을 지원합니다.
            </p>
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
            title="모이라는 이렇게 동작합니다"
            description="지역 의제 제안부터 프로그램 운영까지, 5단계로 이어지는 서비스 흐름을 시각적으로 보여줍니다."
          />
          <ol className="flowGrid">
            {flowSteps.map((step, index) => (
              <li key={step.title}>
                <span className="flowIcon" aria-hidden="true">
                  {step.icon}
                </span>
                <strong>{step.title}</strong>
                {index < flowSteps.length - 1 ? (
                  <span className="flowArrow" aria-hidden="true">→</span>
                ) : null}
              </li>
            ))}
          </ol>
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
