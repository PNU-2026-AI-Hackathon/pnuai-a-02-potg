import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MOIRA STUDIO | 기획안 생성 중',
  description: 'MOIRA STUDIO 프로그램 기획안 생성 준비 화면입니다.',
};

export default function StudioGeneratingPage() {
  return (
    <main className="studioGeneratingPage">
      <section className="studioGeneratingCard" aria-labelledby="studio-generating-title">
        <p className="uiEyebrow">MOIRA STUDIO</p>
        <div className="studioGeneratingMark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h1 id="studio-generating-title">AI 프로그램 기획안을 생성하고 있습니다</h1>
        <p>
          현재 이슈 범위에서는 실제 AI 생성 API 대신 다음 단계 화면 이동만 확인합니다.
          이후 생성 결과 편집 화면과 백엔드 연동이 이어질 예정입니다.
        </p>
        <Link className="uiButton uiButtonSecondary" href="/studio">
          조건 다시 선택하기
        </Link>
      </section>
    </main>
  );
}
