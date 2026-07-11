import Link from 'next/link';

const recentPosts = [
  {
    title: '금정구 방과후 독서회 개선 제안',
    meta: '작성글 · 2026.07.09',
    description: '지역 청소년 대상 독서 활동이 더 늘어나길 희망합니다.',
  },
  {
    title: '시니어 디지털 교육 일정 문의',
    meta: '댓글 · 2026.07.08',
    description: '주말 시간대 프로그램 운영 여부를 확인하고 싶습니다.',
  },
  {
    title: '주민 의견 수렴 문구 보완 요청',
    meta: '작성글 · 2026.07.06',
    description: '의제 등록 폼의 설명 문구를 더 친절하게 바꾸면 좋겠습니다.',
  },
];

const likedPosts = [
  {
    title: '어르신 스마트폰 기초 교육 프로그램',
    meta: '관심/좋아요 표시글 · 24',
    description: '부곡꿈 작은도서관 · 7월 18일',
  },
  {
    title: '초등 AI 독서 멘토링 체험',
    meta: '관심/좋아요 표시글 · 18',
    description: '금샘마을 작은도서관 · 7월 21일',
  },
];

const neighborhoodEvents = [
  {
    title: '금정구 작은도서관 여름 독서 캠프',
    date: '7월 20일',
    location: '금샘마을 작은도서관',
  },
  {
    title: '부산진구 주민 북클럽 특강',
    date: '7월 24일',
    location: '부전꿈 작은도서관',
  },
  {
    title: '해운대구 도서관 체험 행사',
    date: '7월 27일',
    location: '우동누리 작은도서관',
  },
];

const interestEvents = [
  {
    title: 'AI 코딩 체험 워크숍',
    date: '7월 22일',
    category: '인공지능',
  },
  {
    title: '청소년 미디어 교육 세미나',
    date: '7월 26일',
    category: '교육',
  },
  {
    title: '환경 보호 전시 및 참여 프로그램',
    date: '7월 29일',
    category: '환경',
  },
];

export default function MyPage() {
  return (
    <main className="page">
      <div className="topBar">
        <div className="shell">
          <p>모이라 | 모두가 이어지는 라이브러리</p>
          <div className="topActions">
            <Link href="/login">로그인</Link>
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

      <div className="content shell mypagePage">
        <section className="mypageHero">
          <article className="mypagePanel mypageProfile">
            <div className="panelBar">
              <h2>마이페이지</h2>
              <span className="badge">회원 정보 요약</span>
            </div>
            <div className="profileSummary">
              <div className="profileAvatar" aria-hidden="true">
                👤
              </div>
              <div>
                <h1>김도서님</h1>
                <p>금정구 · 관심분야: 교육, 디지털, 환경</p>
              </div>
            </div>
            <div className="summaryGrid">
              <div className="summaryCard">
                <span>작성글</span>
                <strong>18</strong>
              </div>
              <div className="summaryCard">
                <span>댓글</span>
                <strong>32</strong>
              </div>
              <div className="summaryCard">
                <span>관심글</span>
                <strong>12</strong>
              </div>
              <div className="summaryCard">
                <span>이벤트</span>
                <strong>09</strong>
              </div>
            </div>
          </article>

          <article className="mypagePanel">
            <div className="panelBar">
              <h2>나의 활동 요약</h2>
            </div>
            <div className="activityList">
              <div className="activityItem">
                <span>최근 작성</span>
                <strong>금정구 방과후 독서회 개선 제안</strong>
              </div>
              <div className="activityItem">
                <span>최근 댓글</span>
                <strong>시니어 디지털 교육 일정 문의</strong>
              </div>
              <div className="activityItem">
                <span>관심 분야</span>
                <strong>교육 · IT · 환경</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="mypageGrid">
          <article className="mypagePanel">
            <div className="panelBar">
              <h2>작성글 / 댓글</h2>
            </div>
            <div className="listBlock">
              {recentPosts.map((item) => (
                <div className="listRow" key={item.title}>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.meta}</p>
                  </div>
                  <span>{item.description}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="mypagePanel">
            <div className="panelBar">
              <h2>관심/좋아요 표시글</h2>
            </div>
            <div className="listBlock">
              {likedPosts.map((item) => (
                <div className="listRow" key={item.title}>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.meta}</p>
                  </div>
                  <span>{item.description}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="mypagePanel">
            <div className="panelBar">
              <h2>속한 구 주변 도서관 이벤트</h2>
            </div>
            <div className="eventList">
              {neighborhoodEvents.map((item) => (
                <div className="eventCard" key={item.title}>
                  <span className="badge">{item.date}</span>
                  <h3>{item.title}</h3>
                  <p>{item.location}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="mypagePanel">
            <div className="panelBar">
              <h2>관심분야 관련 이벤트</h2>
            </div>
            <div className="eventList">
              {interestEvents.map((item) => (
                <div className="eventCard" key={item.title}>
                  <span className="badge">{item.category}</span>
                  <h3>{item.title}</h3>
                  <p>{item.date}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
