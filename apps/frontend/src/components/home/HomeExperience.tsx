'use client';

import { useEffect, useState } from 'react';

const homeSections = [
  { id: 'about', label: '메인 소개' },
  { id: 'moira-studio', label: '모이라 스튜디오' },
  { id: 'neighborhood-stories', label: '동네 이야기' },
  { id: 'program-survey', label: '프로그램 설문' },
  { id: 'recruiting-programs', label: '모집 중인 프로그램' },
  { id: 'library-finder', label: '도서관 찾기' },
] as const;

type HomeSectionId = (typeof homeSections)[number]['id'];

export default function HomeExperience() {
  const [activeSection, setActiveSection] = useState<HomeSectionId>(homeSections[0].id);

  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('.moiraPage main > section'),
    );

    if (!sections.length) return;

    sections.forEach((section) => section.classList.add('isRevealReady'));

    const hero = sections[0];
    hero.classList.add('isHeroIntro');
    const heroFrame = window.requestAnimationFrame(() => {
      hero.classList.add('isInView');
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          entry.target.classList.add('isInView');
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: '0px 0px -10% 0px',
        threshold: 0.14,
      },
    );

    sections.slice(1).forEach((section) => observer.observe(section));

    const sectionNavigationObserver = new IntersectionObserver(
      (entries) => {
        const visibleSection = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

        const visibleSectionId = visibleSection?.target.id;
        if (homeSections.some((section) => section.id === visibleSectionId)) {
          setActiveSection(visibleSectionId as HomeSectionId);
        }
      },
      {
        rootMargin: '-35% 0px -35% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      },
    );

    sections.forEach((section) => sectionNavigationObserver.observe(section));

    const desktopMedia = window.matchMedia(
      '(min-width: 981px) and (hover: hover) and (pointer: fine)',
    );
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const interactiveSelector =
      'input, textarea, select, button, a, [contenteditable="true"], [role="dialog"]';
    let isScrollLocked = false;
    let unlockTimer: number | undefined;
    let settleTimer: number | undefined;
    let wheelResetTimer: number | undefined;
    let pendingTargetTop: number | null = null;
    let wheelAccumulator = 0;
    let wheelDirection = 0;
    let lastWheelAt = 0;

    function getHeaderHeight() {
      const header = document.querySelector<HTMLElement>('.moiraPage .siteHeader');
      const renderedHeight = header?.getBoundingClientRect().height;
      if (renderedHeight) return renderedHeight;

      return (
        Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--site-header-height',
          ),
        ) || 88
      );
    }

    function getCurrentSectionIndex() {
      const marker = getHeaderHeight() + 8;
      const containingIndex = sections.findIndex((section) => {
        const rect = section.getBoundingClientRect();
        return rect.top <= marker && rect.bottom > marker;
      });

      if (containingIndex >= 0) return containingIndex;

      return sections.reduce((nearestIndex, section, index) => {
        const nearestDistance = Math.abs(
          sections[nearestIndex].getBoundingClientRect().top - getHeaderHeight(),
        );
        const distance = Math.abs(
          section.getBoundingClientRect().top - getHeaderHeight(),
        );
        return distance < nearestDistance ? index : nearestIndex;
      }, 0);
    }

    function canScrollInsideTarget(target: EventTarget | null, direction: number) {
      if (!(target instanceof Element)) return false;
      if (
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], .surveyModalBackdrop',
        )
      ) {
        return true;
      }

      let element: Element | null = target;
      while (element && element !== document.body) {
        const node = element as HTMLElement;
        const { overflowY } = getComputedStyle(node);
        const isScrollable =
          /(auto|scroll)/.test(overflowY) && node.scrollHeight > node.clientHeight + 1;

        if (isScrollable) {
          const canScrollDown =
            direction > 0 &&
            node.scrollTop + node.clientHeight < node.scrollHeight - 1;
          const canScrollUp = direction < 0 && node.scrollTop > 1;
          if (canScrollDown || canScrollUp) return true;
        }
        element = element.parentElement;
      }

      return false;
    }

    function hasMoreSectionContent(index: number, direction: number) {
      const rect = sections[index].getBoundingClientRect();
      const availableHeight = window.innerHeight - getHeaderHeight();
      const isLongSection = rect.height > availableHeight + 24;

      if (!isLongSection) return false;
      if (direction > 0) return rect.bottom > window.innerHeight + 2;
      return rect.top < getHeaderHeight() - 2;
    }

    function unlockScroll(alignTarget = false) {
      if (
        alignTarget &&
        pendingTargetTop !== null &&
        Math.abs(window.scrollY - pendingTargetTop) > 1
      ) {
        window.scrollTo({ top: pendingTargetTop, behavior: 'auto' });
      }

      isScrollLocked = false;
      pendingTargetTop = null;
      wheelAccumulator = 0;
      wheelDirection = 0;
      if (unlockTimer) window.clearTimeout(unlockTimer);
      if (settleTimer) window.clearTimeout(settleTimer);
      if (wheelResetTimer) window.clearTimeout(wheelResetTimer);
      window.removeEventListener('scroll', handleScrollSettle);
    }

    function unlockAfterWheelIdle() {
      const remainingIdleTime = 180 - (performance.now() - lastWheelAt);
      if (remainingIdleTime > 0) {
        if (settleTimer) window.clearTimeout(settleTimer);
        settleTimer = window.setTimeout(unlockAfterWheelIdle, remainingIdleTime);
        return;
      }

      unlockScroll(true);
    }

    function handleScrollSettle() {
      if (settleTimer) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(unlockAfterWheelIdle, 140);
    }

    function moveToSection(index: number) {
      if (index < 0 || index >= sections.length || isScrollLocked) return false;

      isScrollLocked = true;
      const behavior: ScrollBehavior = reducedMotion.matches ? 'auto' : 'smooth';
      const headerHeight = getHeaderHeight();
      const targetTop = Math.max(
        0,
        sections[index].getBoundingClientRect().top +
          window.scrollY -
          headerHeight,
      );
      pendingTargetTop = targetTop;

      window.scrollTo({ top: targetTop, behavior });

      if (behavior === 'auto') {
        settleTimer = window.setTimeout(unlockAfterWheelIdle, 180);
      } else {
        window.addEventListener('scroll', handleScrollSettle, { passive: true });
        unlockTimer = window.setTimeout(unlockAfterWheelIdle, 1200);
      }

      return true;
    }

    function handleWheel(event: WheelEvent) {
      if (!desktopMedia.matches || event.ctrlKey) return;

      lastWheelAt = performance.now();

      if (isScrollLocked) {
        event.preventDefault();
        return;
      }

      const deltaY =
        event.deltaY *
        (event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? window.innerHeight
            : 1);

      if (deltaY === 0) return;

      const direction = deltaY > 0 ? 1 : -1;
      if (canScrollInsideTarget(event.target, direction)) return;

      const currentIndex = getCurrentSectionIndex();
      if (hasMoreSectionContent(currentIndex, direction)) {
        wheelAccumulator = 0;
        wheelDirection = 0;
        return;
      }

      const targetIndex = currentIndex + direction;
      if (targetIndex < 0 || targetIndex >= sections.length) return;

      event.preventDefault();

      if (wheelDirection !== direction) {
        wheelAccumulator = 0;
        wheelDirection = direction;
      }

      wheelAccumulator += deltaY;
      if (wheelResetTimer) window.clearTimeout(wheelResetTimer);
      wheelResetTimer = window.setTimeout(() => {
        wheelAccumulator = 0;
        wheelDirection = 0;
      }, 160);

      if (Math.abs(wheelAccumulator) < 48) return;

      wheelAccumulator = 0;
      wheelDirection = 0;
      moveToSection(targetIndex);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!desktopMedia.matches || event.defaultPrevented) return;
      if (
        event.target instanceof Element &&
        event.target.closest(interactiveSelector)
      ) {
        return;
      }

      const direction =
        event.key === 'ArrowDown' || event.key === 'PageDown'
          ? 1
          : event.key === 'ArrowUp' || event.key === 'PageUp'
            ? -1
            : 0;

      if (!direction) return;
      if (isScrollLocked) {
        event.preventDefault();
        return;
      }

      const currentIndex = getCurrentSectionIndex();
      if (hasMoreSectionContent(currentIndex, direction)) return;

      if (moveToSection(currentIndex + direction)) {
        event.preventDefault();
      }
    }

    function syncDesktopMode() {
      document.documentElement.classList.toggle(
        'isFullPageScroll',
        desktopMedia.matches,
      );
      if (!desktopMedia.matches) unlockScroll();
    }

    syncDesktopMode();
    desktopMedia.addEventListener('change', syncDesktopMode);
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      observer.disconnect();
      sectionNavigationObserver.disconnect();
      window.cancelAnimationFrame(heroFrame);
      unlockScroll();
      desktopMedia.removeEventListener('change', syncDesktopMode);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('keydown', handleKeyDown);
      document.documentElement.classList.remove('isFullPageScroll');
    };
  }, []);

  return (
    <nav
      className={`homeSectionNavigation ${activeSection === 'program-survey' ? 'isInverted' : ''}`}
      aria-label="메인페이지 섹션 이동"
    >
      <ol>
        {homeSections.map((section) => (
          <li key={section.id}>
            <a
              className={activeSection === section.id ? 'isActive' : ''}
              href={`#${section.id}`}
              aria-label={`${section.label} 섹션으로 이동`}
              aria-current={activeSection === section.id ? 'true' : undefined}
              title={section.label}
            >
              <span aria-hidden="true" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
