import Link from 'next/link';
import SiteHeader from '@/components/layout/SiteHeader';
import { getCurrentUser } from '@/lib/server-auth';

const authoredPosts = [
  {
    category: '우리동네 의제',
    title: '금정구 방과후 독서회 운영 시간 개선 제안',
    excerpt: '청소년도 참여할 수 있도록 평일 저녁 프로그램 확대를 제안했어요.',
    date: '2026.07.18',
    count: '댓글 8',
  },
  {
    category: '동네 광장',
    title: '장전동 작은도서관 이용 후기',
    excerpt: '조용한 열람 공간과 새로 들어온 어린이 도서를 소개합니다.',
    date: '2026.07.12',
    count: '댓글 5',
  },
];

const comments = [
  {
    category: '도서관 행사',
    title: '시니어 디지털 교육 일정 문의',
    excerpt: '주말반이 개설되면 부모님과 함께 신청하고 싶어요.',
    date: '2026.07.17',
    count: '공감 12',
  },
  {
    category: '우리동네 의제',
    title: '어린이 보호구역 개선 의견을 모읍니다',
    excerpt: '도서관 앞 횡단보도 조명 설치 의견에 공감합니다.',
    date: '2026.07.10',
    count: '공감 7',
  },
];

const savedPosts = [
  {
    category: '도서관 소식',
    title: '금샘마을 작은도서관 7월 신간 안내',
    excerpt: '이번 달 새로 들어온 인문·과학 분야 도서 42권을 확인해 보세요.',
    date: '2026.07.16',
    count: '저장됨',
  },
  {
    category: '동네 광장',
    title: '아이와 함께 가기 좋은 금정구 도서관',
    excerpt: '유아 열람실과 가족 프로그램이 잘 마련된 공간을 모았어요.',
    date: '2026.07.08',
    count: '저장됨',
  },
];

const likedPosts = [
  {
    category: '프로그램',
    title: '어르신 스마트폰 기초 교육 참여자 모집',
    excerpt: '사진 전송부터 공공 앱 사용까지 차근차근 배워요.',
    date: '2026.07.15',
    count: '좋아요 24',
  },
  {
    category: '도서관 행사',
    title: '초등 AI 독서 멘토링 체험',
    excerpt: '책 속 이야기를 바탕으로 나만의 AI 그림책을 만들어 봅니다.',
    date: '2026.07.07',
    count: '좋아요 18',
  },
];

const neighborhoodEvents = [
  {
    status: '신청중',
    date: '07.24',
    day: '금요일',
    title: '한여름 밤의 가족 독서 캠프',
    location: '금샘마을 작은도서관',
    time: '19:00 - 21:00',
  },
  {
    status: '모집예정',
    date: '07.27',
    day: '월요일',
    title: '우리 동네 그림책 작가와의 만남',
    location: '장전생활문화센터 작은도서관',
    time: '14:00 - 16:00',
  },
  {
    status: '신청중',
    date: '08.01',
    day: '토요일',
    title: '어린이 여름방학 과학 실험실',
    location: '부곡꿈 작은도서관',
    time: '10:30 - 12:00',
  },
];

const interestEvents = [
  {
    tag: 'AI · 디지털',
    title: 'AI와 함께 만드는 우리 동네 이야기',
    description: '생성형 AI를 활용해 지역의 이야기를 짧은 영상으로 만들어 봅니다.',
    location: '금정도서관',
    date: '7월 30일',
  },
  {
    tag: '교육',
    title: '청소년 미디어 리터러시 교실',
    description: '온라인 정보를 건강하게 읽고 활용하는 방법을 함께 배워요.',
    location: '서동예술창작공간',
    date: '8월 3일',
  },
  {
    tag: '환경',
    title: '책으로 만나는 제로웨이스트',
    description: '환경 도서를 읽고 일상에서 실천할 작은 행동을 나눕니다.',
    location: '은빛사랑채 작은도서관',
    date: '8월 8일',
  },
];

type ActivityItem = (typeof authoredPosts)[number];

function ActivitySection({
  id,
  eyebrow,
  title,
  description,
  icon,
  items,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: string;
  items: ActivityItem[];
}) {
  return (
    <section className="mypageActivityCard" id={id}>
      <div className="mypageSectionHeading">
        <span className="mypageSectionIcon" aria-hidden="true">{icon}</span>
        <div>
          <p className="uiEyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <button className="mypageMoreButton" type="button" disabled>
          전체보기 <span aria-hidden="true">→</span>
        </button>
      </div>
      <div className="mypagePostList">
        {items.map((item) => (
          <article className="mypagePostItem" key={item.title}>
            <span className="uiTag">{item.category}</span>
            <div className="mypagePostCopy">
              <h3>{item.title}</h3>
              <p>{item.excerpt}</p>
              <div className="mypagePostMeta">
                <span>{item.date}</span>
                <span>{item.count}</span>
              </div>
            </div>
            <span className="mypageRowArrow" aria-hidden="true">›</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export default async function MyPage() {
  const user = await getCurrentUser();
  const displayName = user?.name ?? '김모이라';

  return (
    <div className="moiraPage mypageRoot">
      <SiteHeader user={user} />

      <main className="mypageMain">
        <section className="mypageIntro">
          <div className="uiContainer">
            <nav className="mypageBreadcrumb" aria-label="현재 위치">
              <Link href="/">홈</Link>
              <span aria-hidden="true">/</span>
              <strong>마이페이지</strong>
            </nav>

            <div className="mypageWelcome">
              <div>
                <p className="uiEyebrow">MY MOIRA</p>
                <h1>{displayName}님, 반가워요!</h1>
                <p>나의 활동과 관심 소식을 한곳에서 편하게 확인해 보세요.</p>
              </div>
              <span className="mypageMockNotice">더미 데이터 미리보기</span>
            </div>

            <div className="mypageProfileCard">
              <div className="mypageIdentity">
                <div className="mypageAvatar" aria-hidden="true">
                  {displayName.slice(0, 1)}
                </div>
                <div>
                  <strong>{displayName}</strong>
                  <p>부산광역시 금정구 주민</p>
                  <div className="mypageInterestTags" aria-label="나의 관심 분야">
                    <span>교육</span>
                    <span>AI · 디지털</span>
                    <span>환경</span>
                  </div>
                </div>
              </div>

              <dl className="mypageStats">
                <div>
                  <dt>작성글</dt>
                  <dd>18</dd>
                </div>
                <div>
                  <dt>댓글</dt>
                  <dd>32</dd>
                </div>
                <div>
                  <dt>관심글</dt>
                  <dd>12</dd>
                </div>
                <div>
                  <dt>좋아요</dt>
                  <dd>24</dd>
                </div>
              </dl>

              <button className="uiButton uiButtonSecondary mypageEditButton" type="button" disabled>
                내 정보 관리
              </button>
            </div>
          </div>
        </section>

        <div className="uiContainer mypageContent">
          <div className="mypageActivityGrid">
            <ActivitySection
              id="my-posts"
              eyebrow="MY POSTS"
              title="내가 작성한 글"
              description="커뮤니티에 직접 작성한 이야기를 모았어요."
              icon="✎"
              items={authoredPosts}
            />
            <ActivitySection
              id="my-comments"
              eyebrow="MY COMMENTS"
              title="내가 작성한 댓글"
              description="다른 주민의 이야기에 남긴 의견이에요."
              icon="💬"
              items={comments}
            />
            <ActivitySection
              id="saved-posts"
              eyebrow="BOOKMARKS"
              title="관심글"
              description="나중에 다시 보고 싶은 글을 저장했어요."
              icon="☆"
              items={savedPosts}
            />
            <ActivitySection
              id="liked-posts"
              eyebrow="LIKES"
              title="좋아요 표시글"
              description="공감하고 응원한 우리 동네 이야기예요."
              icon="♥"
              items={likedPosts}
            />
          </div>

          <section className="mypageEventSection">
            <div className="mypageEventHeading">
              <div>
                <p className="uiEyebrow">NEARBY EVENTS</p>
                <h2>금정구 주변 도서관 이벤트</h2>
                <p>내가 속한 지역에서 곧 열리는 프로그램을 확인해 보세요.</p>
              </div>
              <button className="mypageMoreButton" type="button" disabled>
                전체보기 <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="mypageEventGrid">
              {neighborhoodEvents.map((event) => (
                <article className="mypageLocalEvent" key={event.title}>
                  <div className="mypageEventDate">
                    <strong>{event.date}</strong>
                    <span>{event.day}</span>
                  </div>
                  <div>
                    <span className="uiTag uiTagRecruiting">{event.status}</span>
                    <h3>{event.title}</h3>
                    <p>{event.location}</p>
                    <p>{event.time}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="mypageEventSection mypageInterestSection">
            <div className="mypageEventHeading">
              <div>
                <p className="uiEyebrow">FOR YOUR INTERESTS</p>
                <h2>관심분야 맞춤 이벤트</h2>
                <p>선택한 관심분야를 바탕으로 모이라가 골라봤어요.</p>
              </div>
              <button className="mypageMoreButton" type="button" disabled>
                관심분야 설정 <span aria-hidden="true">→</span>
              </button>
            </div>
            <div className="mypageInterestGrid">
              {interestEvents.map((event) => (
                <article className="mypageInterestEvent" key={event.title}>
                  <span className="uiTag uiTagAccent">{event.tag}</span>
                  <h3>{event.title}</h3>
                  <p>{event.description}</p>
                  <div>
                    <span>{event.location}</span>
                    <strong>{event.date}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
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
