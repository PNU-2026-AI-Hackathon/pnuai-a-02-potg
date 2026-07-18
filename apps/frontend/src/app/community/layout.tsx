import Link from 'next/link';
import AuthActions from '@/components/auth/AuthActions';
import { getCurrentUser } from '@/lib/server-auth';

export default async function CommunityLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <div className="page">
      <div className="topBar">
        <div className="shell">
          <p>모이라 | 모두가 이어지는 라이브러리</p>
          <div className="topActions">
            <AuthActions initialUser={user} />
            <button type="button" disabled>
              사이트맵
            </button>
          </div>
        </div>
      </div>

      <header className="header">
        <div className="shell headerInner">
          <Link className="brandArea" href="/">
            <div className="logo" aria-hidden="true">
              📚
            </div>
            <div>
              <p className="brandTitle">모이라</p>
              <p className="brandSubtitle">모두가 이어지는 라이브러리</p>
            </div>
          </Link>

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

      <nav className="nav" aria-label="주요 메뉴">
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
          <Link className="active" href="/community/library-news">
            지역 커뮤니티
          </Link>
          <button type="button" disabled>
            봉사자 연계
          </button>
        </div>
      </nav>

      {children}
    </div>
  );
}
