import Link from 'next/link';

type Summary = {
  libraries: number;
  programs: number;
  agendaItems: number;
  volunteerMatches: number;
};

type Announcement = {
  id: string | number;
  title: string;
  date: string;
};

const backendUrl = 'http://localhost:4000';

async function getSummary(): Promise<Summary> {
  const res = await fetch(`${backendUrl}/api/summary`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to fetch summary');
  }
  return res.json();
}

async function getAnnouncements(): Promise<Announcement[]> {
  const res = await fetch(`${backendUrl}/api/announcements`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error('Failed to fetch announcements');
  }
  return res.json();
}

export default async function Home() {
  const summary = await getSummary().catch(() => ({
    libraries: 40,
    programs: 24,
    agendaItems: 18,
    volunteerMatches: 7,
  }));
  const announcements = await getAnnouncements().catch(() => []);

  return (
    <main className="page">
      <div className="topBar">
        <div className="shell">
          <p>모이라 | 모두가 이어지는 라이브러리</p>
          <div className="topActions">
            <Link href="/login">
              로그인
            </Link>
            <button type="button" disabled>
              회원가입
            </button>
            <button type="button" disabled>
              사이트맵
            </button>
          </div>
        </div>
      </div>

      <header className="header">
        <div className="shell headerInner">
          <div className="brandArea">
            <div className="logo" aria-hidden="true">
              📚
            </div>
            <div>
              <p className="brandTitle">모이라</p>
              <p className="brandSubtitle">모두가 이어지는 라이브러리</p>
            </div>
          </div>

          <div className="searchArea" aria-label="통합검색 placeholder">
            <p className="searchLabel">통합검색</p>
            <div className="searchRow">
              <select aria-hidden="true" disabled defaultValue="통합검색">
                <option>통합검색</option>
                <option>도서관명</option>
                <option>프로그램명</option>
              </select>
              <input
                aria-label="검색 placeholder"
                disabled
                placeholder="도서명, 프로그램명, 지역 의제 등을 검색해 주세요."
              />
              <button type="button" disabled>
                검색
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="nav" aria-label="주요 메뉴 placeholder">
        <div className="shell navInner">
          <button type="button" disabled className="active">
            자료검색
          </button>
          <button type="button" disabled className="active">
            도서관이용
          </button>
          <button type="button" disabled className="active">
            문화행사
          </button>
          <button type="button" disabled className="active">
            우리동네 도서관
          </button>
          <button type="button" disabled>
            지역 의제
          </button>
          <button type="button" disabled>
            봉사자 연계
          </button>
        </div>
      </nav>

      <div className="content shell">
        <section className="heroGrid">
          <section className="panel panelHero">
            <div className="panelHeading">
              <div>
                <h1>작은도서관 통합 안내</h1>
                <p>
                  지역 작은도서관, 프로그램, 주민 제안 의제를 한곳에서 확인하는 홈 화면
                  스켈레톤입니다.
                </p>
              </div>
            </div>

            <div className="heroBody">
              <div className="heroMapBlock">
                <h2>우리동네 작은도서관 찾기</h2>
                <div className="mapShell" aria-hidden="true">
                  <span className="mapTag tag1">금샘마을 작은도서관</span>
                  <span className="mapTag tag2">부곡꿈 작은도서관</span>
                  <span className="mapTag tag3">서동누리 작은도서관</span>
                  <span className="mapTag tag4">장전책마을 작은도서관</span>
                  <span className="mapCaption">금정구 기준 예시 지도 화면</span>
                </div>
              </div>

              <div className="heroInfoBlock">
                <h2>이용자 맞춤 안내</h2>
                <div className="statsList">
                  <div className="statRow">
                    <span>운영 중 작은도서관</span>
                    <strong>총 {summary.libraries}개관</strong>
                  </div>
                  <div className="statRow">
                    <span>이번 주 프로그램</span>
                    <strong>{summary.programs}건</strong>
                  </div>
                  <div className="statRow">
                    <span>주민 제안 의제</span>
                    <strong>{summary.agendaItems}건</strong>
                  </div>
                  <div className="statRow">
                    <span>봉사자 연계 가능 프로그램</span>
                    <strong>{summary.volunteerMatches}건</strong>
                  </div>
                </div>

                <div className="guideBox">
                  <p className="guideTitle">서비스 안내</p>
                  <ul>
                    <li>도서관별 프로그램과 공지사항을 한눈에 확인</li>
                    <li>지역 문제와 필요한 프로그램 아이디어를 제안하는 자리</li>
                    <li>AI 기반 추천 프로그램과 봉사자 연계 서비스의 placeholder</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <aside className="panel quickPanel">
            <div className="panelBar">
              <h2>바로가기</h2>
            </div>
            <div className="quickGrid" aria-hidden="true">
              <button type="button" disabled>
                <span>▣</span>
                <span>통합자료검색</span>
              </button>
              <button type="button" disabled>
                <span>▣</span>
                <span>희망도서 신청</span>
              </button>
              <button type="button" disabled>
                <span>▣</span>
                <span>프로그램 신청</span>
              </button>
              <button type="button" disabled>
                <span>▣</span>
                <span>도서관 찾기</span>
              </button>
              <button type="button" disabled>
                <span>▣</span>
                <span>이용안내</span>
              </button>
              <button type="button" disabled>
                <span>▣</span>
                <span>공지사항</span>
              </button>
            </div>
          </aside>
        </section>

        <section className="twoCol">
          <section className="panel">
            <div className="panelBar">
              <h2>공지사항</h2>
              <button type="button" disabled>
                더보기 +
              </button>
            </div>
            <div className="listBox">
              {announcements.length > 0 ? (
                announcements.map((item) => (
                  <div className="rowItem" key={item.id}>
                    <span>{item.title}</span>
                    <span>{item.date}</span>
                  </div>
                ))
              ) : (
                <div className="rowItem">
                  <span>공지사항을 불러오는 중입니다.</span>
                  <span>잠시만 기다려 주세요.</span>
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panelBar">
              <h2>추천 프로그램</h2>
              <button type="button" disabled>
                더보기 +
              </button>
            </div>
            <div className="programGrid">
              <article className="miniCard">
                <span className="badge">모집중</span>
                <h3>초등 AI 독서 멘토링</h3>
                <p>대상 : 초등 4~6학년</p>
                <p>장소 : 금샘마을 작은도서관</p>
              </article>
              <article className="miniCard">
                <span className="badge">접수중</span>
                <h3>어르신 스마트폰 기초 교육</h3>
                <p>대상 : 성인·시니어</p>
                <p>장소 : 부곡꿈 작은도서관</p>
              </article>
              <article className="miniCard">
                <span className="badge">운영예정</span>
                <h3>우리동네 환경 토론회</h3>
                <p>대상 : 청소년·주민</p>
                <p>장소 : 서동누리 작은도서관</p>
              </article>
            </div>
          </section>
        </section>

        <section className="bottomGrid">
          <section className="panel">
            <div className="panelBar">
              <h2>우리동네 도서관 안내</h2>
            </div>
            <div className="districtBox">
              <div className="districtTabs" aria-hidden="true">
                <button type="button" disabled className="active">
                  금정구
                </button>
                <button type="button" disabled>
                  부산진구
                </button>
                <button type="button" disabled>
                  해운대구
                </button>
                <button type="button" disabled>
                  동래구
                </button>
                <button type="button" disabled>
                  북구
                </button>
                <button type="button" disabled>
                  남구
                </button>
              </div>

              <div className="libraryCard">
                <h3>금정도서관 / 금샘마을 작은도서관</h3>
                <p>지역 : 금정구</p>
                <p>주소 : 부산광역시 금정구 장전동</p>
                <p>전화 : 051-000-0001</p>
              </div>
              <div className="libraryCard">
                <h3>시민도서관 / 서면꿈 작은도서관</h3>
                <p>지역 : 부산진구</p>
                <p>주소 : 부산광역시 부산진구 부전동</p>
                <p>전화 : 051-000-0002</p>
              </div>
              <div className="libraryCard">
                <h3>해운대도서관 / 우동누리 작은도서관</h3>
                <p>지역 : 해운대구</p>
                <p>주소 : 부산광역시 해운대구 우동</p>
                <p>전화 : 051-000-0003</p>
              </div>
            </div>
          </section>

          <section className="panel">
            <div className="panelBar">
              <h2>주민 제안 의제 요약</h2>
            </div>
            <div className="agendaBox">
              <article className="agendaCard">
                <span className="badge">교육</span>
                <h3>방과후 학습 지원 프로그램이 필요해요</h3>
                <p>
                  맞벌이 가정 증가로 인해 초등학생 대상 방과후 학습·돌봄 연계 프로그램 수요가
                  높습니다.
                </p>
              </article>
              <article className="agendaCard">
                <span className="badge">복지</span>
                <h3>어르신 디지털 기기 활용 교육이 필요합니다</h3>
                <p>
                  스마트폰 사용, 키오스크 이용, 공공앱 활용을 돕는 반복형 교육 프로그램이
                  필요합니다.
                </p>
              </article>
              <article className="agendaCard">
                <span className="badge">환경</span>
                <h3>분리배출과 자원순환 주제 프로그램이 있었으면 좋겠어요</h3>
                <p>
                  주민 참여형 환경 교육과 어린이 대상 체험형 프로그램 수요가 확인되었습니다.
                </p>
              </article>
              <div className="aiBox">
                <strong>AI 분석 결과</strong>
                <p>
                  최근 등록된 주민 의제는 교육, 복지, 환경 분야에 집중되어 있으며, 아동 대상
                  방과후 프로그램과 시니어 디지털 교육 수요가 높게 나타났습니다.
                </p>
              </div>
            </div>
          </section>
        </section>

        <footer className="footer">
          <div className="footerLinks" aria-hidden="true">
            <button type="button" disabled>
              개인정보처리방침
            </button>
            <button type="button" disabled>
              이용약관
            </button>
            <button type="button" disabled>
              이메일무단수집거부
            </button>
            <button type="button" disabled>
              오시는 길
            </button>
          </div>
          <p className="address">
            부산광역시 금정구 예시로 123 | 대표전화 051-000-0000
            <br />
            ⓒ Moira Library Platform. All Rights Reserved.
          </p>
        </footer>
      </div>
    </main>
  );
}
