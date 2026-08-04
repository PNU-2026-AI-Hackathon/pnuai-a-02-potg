import Link from 'next/link';
import Image from 'next/image';
import AuthActions from '@/components/auth/AuthActions';
import type { AuthUser } from '@/lib/auth-config';

type SiteHeaderProps = {
  user: AuthUser | null;
  activeMenu?: 'home' | 'community';
};

export default function SiteHeader({
  user,
  activeMenu,
}: SiteHeaderProps) {
  return (
    <header className="siteHeader">
      <div className="uiContainer siteHeaderInner">
        <Link className="siteBrand" href="/" aria-label="모이라 홈">
          <Image
            className="siteBrandLogo"
            src="/moira-logo-mark-no-ai.png"
            alt=""
            width={75}
            height={58}
            priority
          />
          <span>
            <strong>모이라</strong>
            <small>모두가 이어지는 라이브러리</small>
          </span>
        </Link>

        <nav className="siteNav" aria-label="주요 메뉴">
          <div className="siteNavPrimary">
            <Link className={activeMenu === 'home' ? 'isActive' : ''} href="/#about">
              모이라 소개
            </Link>
            <Link href="/#library-finder">우리동네 도서관</Link>
            <div className="siteNavDropdown">
              <Link
                className={activeMenu === 'community' ? 'isActive' : ''}
                href="/community"
              >
                우리동네 이야기
                <svg
                  className="siteNavChevron"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="m5 7.5 5 5 5-5" />
                </svg>
              </Link>
              <div className="siteNavSubmenu">
                <Link href="/community/library-news">도서관 행사 및 소식</Link>
                <Link href="/community/proposals">우리동네 의제</Link>
                <Link href="/community/ideas">함께 만드는 행사</Link>
                <Link href="/community/free">동네 광장</Link>
              </div>
            </div>
            <Link className="siteStudioLink" href="/studio">
              <span className="siteStudioIcon" aria-hidden="true">✦</span>
              MOIRA Studio
            </Link>
          </div>
          <AuthActions initialUser={user} />
        </nav>
      </div>
    </header>
  );
}
