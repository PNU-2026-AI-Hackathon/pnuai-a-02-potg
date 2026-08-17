import Link from 'next/link';

export const studioFeatures = [
  {
    number: '01',
    title: '주민 의견 또는 수요조사 선택',
    description: '기획에 반영할 주민 아이디어와 주민 수요를 선택합니다.',
  },
  {
    number: '02',
    title: 'AI 기반 의견 분석',
    description: '모인 의견의 핵심 요구와 공통 관심사를 정리합니다.',
  },
  {
    number: '03',
    title: '프로그램 초안 생성',
    description: '대상, 활동 구성, 운영 방식이 포함된 초안을 만듭니다.',
  },
  {
    number: '04',
    title: '사서 검토 후 실제 기획에 활용',
    description: '사서가 내용을 검토하고 수정해 프로그램 기획에 활용합니다.',
  },
];

type ReusableStudioBlockProps = {
  className?: string;
  features?: typeof studioFeatures;
};

export function StudioPreview({ className = '' }: ReusableStudioBlockProps) {
  return (
    <div className={`studioPreview studioShowcasePreview ${className}`.trim()} aria-label="모이라 스튜디오 화면 미리보기">
      <div className="studioPreviewTop">
        <span className="uiTag uiTagAccent">MOIRA Studio</span>
        <span className="studioStatus">
          <i aria-hidden="true" /> AI 의견 분석 완료
        </span>
      </div>
      <div className="studioAgenda">
        <span>선택된 주민 아이디어</span>
        <strong>아이들의 안전한 방과 후 돌봄</strong>
      </div>
      <div className="studioDocument">
        <div className="studioDocumentHeading">
          <span className="studioSpark" aria-hidden="true">✦</span>
          <div>
            <small>AI 프로그램 기획 초안</small>
            <h3>책으로 여는 방과 후 창작소</h3>
          </div>
        </div>
        <dl>
          <div>
            <dt>대상</dt>
            <dd>초등 3~6학년</dd>
          </div>
          <div>
            <dt>구성</dt>
            <dd>그림책 · 연극 · 만들기</dd>
          </div>
          <div>
            <dt>운영</dt>
            <dd>주 1회, 총 6차시</dd>
          </div>
        </dl>
        <div className="studioProgress">
          <span style={{ width: '82%' }} />
        </div>
        <p>주민 의견을 바탕으로 대상과 활동 구성을 정리했어요.</p>
      </div>
      <p className="studioPreviewNote">
        생성된 내용은 초안이며, 사서가 직접 검토하고 수정한 뒤 활용합니다.
      </p>
    </div>
  );
}

export function StudioFeatureList({
  className = '',
  features = studioFeatures,
}: ReusableStudioBlockProps) {
  return (
    <ol className={`studioFeatureList ${className}`.trim()} aria-label="모이라 스튜디오 이용 과정">
      {features.map((feature) => (
        <li key={feature.number}>
          <span>{feature.number}</span>
          <div>
            <strong>{feature.title}</strong>
            <p>{feature.description}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function StudioSection() {
  return (
    <section className="homeSection studioSection" id="moira-studio">
      <div className="uiContainer">
        <div className="studioSectionHeader">
          <div className="studioSectionIntro">
            <p className="uiEyebrow">LIBRARIAN PLANNING TOOL</p>
            <h2>
              <span className="studioTitleIcon" aria-hidden="true">✦</span>
              MOIRA Studio
            </h2>
            <p className="studioSectionClaim">
              주민의 의견을 작은도서관 프로그램 기획안으로
            </p>
            <p className="studioSectionDescription">
              모이라 스튜디오는 주민 제안과 수요조사 결과를 분석하여 사서가 프로그램 초안을 빠르게 작성할 수 있도록 돕습니다.
            </p>
          </div>
          <aside className="studioSectionCta" aria-label="모이라 스튜디오 사서 안내">
            <span className="studioCtaEyebrow">사서라면 지금 바로</span>
            <strong>AI 프로그램 기획을 시작해보세요.</strong>
            <Link className="uiButton studioBrandButton" href="/studio/about">
              <span className="studioBrandButtonIcon" aria-hidden="true">✦</span>
              MOIRA Studio 시작하기
              <span className="studioBrandButtonArrow" aria-hidden="true">→</span>
            </Link>
          </aside>
        </div>

        <div className="studioShowcase" id="studio-details">
          <StudioPreview />
          <StudioFeatureList />
        </div>
      </div>
    </section>
  );
}
