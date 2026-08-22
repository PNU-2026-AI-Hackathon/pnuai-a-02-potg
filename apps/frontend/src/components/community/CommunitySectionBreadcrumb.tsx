import Link from 'next/link';

export default function CommunitySectionBreadcrumb({ current }: { current: string }) {
  return (
    <nav className="communitySectionBreadcrumb" aria-label="현재 위치">
      <Link href="/" aria-label="홈">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M9 20v-6h6v6" />
        </svg>
        <span>홈</span>
      </Link>
      <svg className="communitySectionBreadcrumbChevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
      <Link href="/community">우리동네 이야기</Link>
      <svg className="communitySectionBreadcrumbChevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 18 6-6-6-6" />
      </svg>
      <span aria-current="page">{current}</span>
    </nav>
  );
}
