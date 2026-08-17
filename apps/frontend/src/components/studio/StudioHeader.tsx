'use client';

import Image from 'next/image';
import Link from 'next/link';

type StudioHeaderProps = {
  onIntroOpen: () => void;
  onTutorialOpen: () => void;
};

export default function StudioHeader({
  onIntroOpen,
  onTutorialOpen,
}: StudioHeaderProps) {
  return (
    <header className="studioHeader">
      <div className="uiContainer studioHeaderInner">
        <Link className="studioHeaderBrand" href="/" aria-label="MOIRA 홈으로 이동">
          <Image
            src="/moira-logo-mark-no-ai.png"
            alt=""
            width={75}
            height={58}
            priority
          />
          <span>
            <strong>MOIRA Studio</strong>
            <small>사서를 위한 AI 프로그램 기획 도구</small>
          </span>
        </Link>
        <nav className="studioHeaderActions" aria-label="MOIRA Studio 도움말">
          <button type="button" onClick={onTutorialOpen}>
            기능 설명
          </button>
          <button type="button" onClick={onIntroOpen}>
            Studio 소개
          </button>
        </nav>
      </div>
    </header>
  );
}
