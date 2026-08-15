'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { AuthUser } from '@/lib/auth-config';

type StudioAccessCtaProps = {
  accountType: AuthUser['accountType'] | null;
  compact?: boolean;
};

export default function StudioAccessCta({
  accountType,
  compact = false,
}: StudioAccessCtaProps) {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const isStaff = accountType === 'LIBRARIAN' || accountType === 'ADMIN';
  const isLoggedOut = accountType === null;

  function handleAccess() {
    if (isStaff) {
      router.push('/studio');
      return;
    }

    setIsModalOpen(true);
  }

  useEffect(() => {
    if (!isModalOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsModalOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => modalRef.current?.focus());

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.removeProperty('overflow');
      previouslyFocused?.focus();
    };
  }, [isModalOpen]);

  return (
    <div className={`studioAccessCta ${compact ? 'isCompact' : ''}`}>
      <button className="uiButton studioLandingPrimary" type="button" onClick={handleAccess}>
        <span aria-hidden="true">✦</span>
        MOIRA Studio 사용하기 →
      </button>
      {isModalOpen ? (
        <div
          className="studioAccessModalBackdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsModalOpen(false);
          }}
        >
          <div
            ref={modalRef}
            className="studioAccessModal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="studio-access-modal-title"
            aria-describedby="studio-access-modal-description"
            tabIndex={-1}
          >
            <span className="studioAccessModalIcon" aria-hidden="true">✦</span>
            <p className="uiEyebrow">MOIRA STUDIO</p>
            <h2 id="studio-access-modal-title">
              {isLoggedOut ? '로그인이 필요합니다' : 'MOIRA Studio 이용 안내'}
            </h2>
            <p id="studio-access-modal-description">
              {isLoggedOut
                ? 'MOIRA Studio는 사서와 도서관 프로그램 기획 담당자를 위한 기능입니다. 로그인 후 이용해주세요.'
                : 'MOIRA Studio는 사서와 도서관 프로그램 기획 담당자를 위한 기능입니다. 사서 계정으로 로그인해주세요.'}
            </p>
            <div className="studioAccessModalActions">
              {isLoggedOut ? (
                <>
                  <button type="button" onClick={() => setIsModalOpen(false)}>취소</button>
                  <button
                    className="isPrimary"
                    type="button"
                    onClick={() => router.push('/login?next=/studio/about')}
                  >
                    로그인하기
                  </button>
                </>
              ) : (
                <button className="isPrimary" type="button" onClick={() => setIsModalOpen(false)}>
                  확인
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
