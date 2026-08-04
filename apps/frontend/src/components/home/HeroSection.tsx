import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="homeHero" id="about">
      <div className="uiContainer homeHeroGrid">
        <div className="homeHeroCopy">
          <p className="uiEyebrow">
            금정구 주민의 제안에서 시작되는 우리 동네 작은도서관
          </p>
          <h1>
            주민의 이야기가
            <br />
            <span className="homeHeroTitleLine">
              <span className="homeHeroTitleAccent">도서관 프로그램</span>이 됩니다.
            </span>
          </h1>
          <p className="homeHeroLead">
            지역 주민의 의견과 관심사를 바탕으로,
            <br />
            모이라 스튜디오가 사서의 프로그램 기획을 지원합니다.
          </p>
          <div className="homeHeroActions">
            <Link className="uiButton uiButtonPrimary" href="/community">
              우리동네 이야기 둘러보기 <span aria-hidden="true">→</span>
            </Link>
            <Link className="uiButton uiButtonSecondary" href="/about">
              모이라 알아보기
            </Link>
          </div>
        </div>

        <div className="moiraServicePreview" aria-label="모이라 서비스 진행 과정">
          <div className="moiraServicePreviewHeader">
            <span>MOIRA FLOW</span>
            <h2>
              지역의 이야기에서
              <br />
              <em>도서관 프로그램</em>까지
            </h2>
          </div>

          <ol className="moiraServicePath">
            <li>
              <span aria-hidden="true">01</span>
              <div>
                <strong>지역 의제 제안</strong>
                <p>주민이 동네에 필요한 변화와 관심사를 나눕니다.</p>
              </div>
            </li>
            <li className="isStudio">
              <span aria-hidden="true">02</span>
              <div>
                <strong>MOIRA Studio 기획</strong>
                <p>사서가 주민 의견을 실행 가능한 프로그램으로 구체화합니다.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">03</span>
              <div>
                <strong>주민 수요조사</strong>
                <p>기획안을 주민과 공유하고 실제 수요를 확인합니다.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">04</span>
              <div>
                <strong>프로그램 운영</strong>
                <p>검증된 기획을 우리 동네 도서관에서 운영합니다.</p>
              </div>
            </li>
            <li>
              <span aria-hidden="true">05</span>
              <div>
                <strong>지역 커뮤니티 활성화</strong>
                <p>프로그램의 경험이 새로운 이야기와 참여로 이어집니다.</p>
              </div>
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
