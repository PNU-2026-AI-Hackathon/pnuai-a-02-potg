'use client';

import { animate, inView, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

const revealEase = [0.22, 1, 0.36, 1] as const;

const sections = [
  { id: 'intro', label: '소개' },
  { id: 'value', label: '가치' },
  { id: 'flow', label: '서비스 흐름' },
  { id: 'features', label: '주요 기능' },
  { id: 'audience', label: '이용자' },
  { id: 'vision', label: '비전' },
] as const;

export default function AboutExperience() {
  const shouldReduceMotion = useReducedMotion();
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]['id']>(
    sections[0].id,
  );

  useEffect(() => {
    const observedSections = sections
      .map(({ id }) => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    const updateActiveSection = () => {
      const focusLine = window.innerHeight * 0.42;
      let current = observedSections[0]?.id ?? sections[0].id;

      observedSections.forEach((section) => {
        if (section.getBoundingClientRect().top <= focusLine) current = section.id;
      });

      setActiveSection(current as (typeof sections)[number]['id']);
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);

    return () => {
      window.removeEventListener('scroll', updateActiveSection);
      window.removeEventListener('resize', updateActiveSection);
    };
  }, []);

  useEffect(() => {
    if (shouldReduceMotion) return;

    const animationControls: Array<{ stop: () => void }> = [];
    const observerCleanups: Array<() => void> = [];
    const animatedElements = new Set<HTMLElement>();

    const reveal = (
      elements: HTMLElement[],
      options: { delay?: number; stagger?: number; distance?: number } = {},
    ) => {
      const { delay = 0, stagger = 0.12, distance = 22 } = options;

      elements.forEach((element, index) => {
        animatedElements.add(element);
        const controls = animate(
          element,
          { y: [distance, 0] },
          {
            duration: 0.58,
            delay: delay + index * stagger,
            ease: revealEase,
          },
        );

        void controls.then(() => {
          element.style.removeProperty('transform');
        });
        animationControls.push(controls);
      });
    };

    const revealOnce = (
      sectionSelector: string,
      itemSelector: string,
      stagger = 0.12,
    ) => {
      const section = document.querySelector<HTMLElement>(sectionSelector);
      if (!section) return;

      const items = Array.from(section.querySelectorAll<HTMLElement>(itemSelector));
      if (!items.length) return;

      let hasPlayed = false;
      const stop = inView(
        section,
        () => {
          if (hasPlayed) return;
          hasPlayed = true;
          reveal(items, { stagger });
        },
        { amount: 0.15, margin: '0px 0px -8% 0px' },
      );
      observerCleanups.push(stop);
    };

    const heroCopy = document.querySelector<HTMLElement>('.introHeroCopy');
    const heroVisual = document.querySelector<HTMLElement>('.introHeroVisual');

    const heroFrame = window.requestAnimationFrame(() => {
      if (heroCopy) {
        animatedElements.add(heroCopy);
        const controls = animate(
          heroCopy,
          { x: [-18, 0], y: [8, 0] },
          { duration: 0.72, ease: revealEase },
        );
        void controls.then(() => heroCopy.style.removeProperty('transform'));
        animationControls.push(controls);
      }

      if (heroVisual) {
        animatedElements.add(heroVisual);
        const controls = animate(
          heroVisual,
          { x: [34, 0], rotate: [0.8, 0] },
          { duration: 0.86, delay: 0.12, ease: revealEase },
        );
        void controls.then(() => heroVisual.style.removeProperty('transform'));
        animationControls.push(controls);
      }
    });

    revealOnce('.valueSection', '.homeSectionHeading, .valueCard, .valueConclusion', 0.1);
    revealOnce('.audienceSection', '.homeSectionHeading, .audienceCard', 0.12);

    const featureSection = document.querySelector<HTMLElement>('.featureSection');
    if (featureSection) {
      const heading = Array.from(
        featureSection.querySelectorAll<HTMLElement>('.homeSectionHeading'),
      );
      const cards = Array.from(
        featureSection.querySelectorAll<HTMLElement>('.featureCard'),
      );
      let hasPlayed = false;
      const stop = inView(
        featureSection,
        () => {
          if (hasPlayed) return;
          hasPlayed = true;
          reveal(heading, { distance: 16 });
          reveal(cards, { delay: 0.1, stagger: 0.08, distance: 18 });
        },
        { amount: 0.12, margin: '0px 0px -6% 0px' },
      );
      observerCleanups.push(stop);
    }

    const vision = document.querySelector<HTMLElement>('.visionSection');
    if (vision) {
      const title = Array.from(
        vision.querySelectorAll<HTMLElement>('.uiEyebrow, h2'),
      );
      const connectionParts = Array.from(
        vision.querySelectorAll<HTMLElement>('.visionNode, .visionArrow'),
      );
      const body = Array.from(
        vision.querySelectorAll<HTMLElement>(
          '.visionLead, .visionClosing, .visionPromise, .visionSparkle',
        ),
      );
      let hasPlayed = false;
      const stop = inView(
        vision,
        () => {
          if (hasPlayed) return;
          hasPlayed = true;
          reveal(title, { stagger: 0.08 });
          connectionParts.forEach((part, index) => {
            animatedElements.add(part);
            const isArrow = part.classList.contains('visionArrow');
            const controls = animate(
              part,
              isArrow
                ? { scaleX: [0, 1] }
                : { y: [10, 0], scale: [0.94, 1] },
              {
                duration: isArrow ? 0.42 : 0.5,
                delay: 0.18 + index * 0.12,
                ease: revealEase,
              },
            );
            void controls.then(() => part.style.removeProperty('transform'));
            animationControls.push(controls);
          });
          reveal(body, { delay: 0.38, stagger: 0.1 });
        },
        { amount: 0.18, margin: '0px 0px -8% 0px' },
      );
      observerCleanups.push(stop);
    }

    return () => {
      window.cancelAnimationFrame(heroFrame);
      observerCleanups.forEach((cleanup) => cleanup());
      animationControls.forEach((controls) => controls.stop());
      animatedElements.forEach((element) => {
        element.style.removeProperty('transform');
      });
    };
  }, [shouldReduceMotion]);

  useEffect(() => {
    const hero = document.querySelector<HTMLElement>('.introHero');
    const card = hero?.querySelector<HTMLElement>('.studioMockupCard');
    if (!hero || !card) return;

    const stages = [
      card.querySelector<HTMLElement>('.studioModeTabs'),
      card.querySelector<HTMLElement>('.studioFieldGroup'),
      card.querySelector<HTMLElement>('.studioSelectRow'),
      card.querySelector<HTMLElement>('.studioActionBar'),
    ].filter((stage): stage is HTMLElement => Boolean(stage));
    const timers: number[] = [];

    const completeHeroMotion = () => {
      card.style.setProperty('--hero-progress', '1');
      stages.forEach((stage) => stage.classList.add('isHeroStepReached'));
    };

    if (shouldReduceMotion) {
      completeHeroMotion();
      return () => {
        card.style.removeProperty('--hero-progress');
        stages.forEach((stage) => stage.classList.remove('isHeroStepReached'));
      };
    }

    let hasPlayed = false;
    const stop = inView(
      hero,
      () => {
        if (hasPlayed) return;
        hasPlayed = true;
        stages.forEach((stage, index) => {
          const timer = window.setTimeout(() => {
            stage.classList.add('isHeroStepReached');
            card.style.setProperty('--hero-progress', String((index + 1) / stages.length));
          }, 360 + index * 430);
          timers.push(timer);
        });
      },
      { amount: 0.28 },
    );

    return () => {
      stop();
      timers.forEach((timer) => window.clearTimeout(timer));
      card.style.removeProperty('--hero-progress');
      stages.forEach((stage) => stage.classList.remove('isHeroStepReached'));
    };
  }, [shouldReduceMotion]);

  useEffect(() => {
    const pipeline = document.querySelector<HTMLElement>('.pipeline');
    if (!pipeline) return;

    const items = Array.from(pipeline.querySelectorAll<HTMLElement>('.pipelineItem'));
    let animationFrame = 0;

    const applyProgress = (progress: number) => {
      pipeline.style.setProperty('--flow-progress', String(progress));
      items.forEach((item, index) => {
        const threshold = items.length > 1 ? (index + 0.15) / items.length : 0;
        item.classList.toggle('isFlowReached', progress >= threshold);
      });
    };

    if (shouldReduceMotion) {
      applyProgress(1);
      return () => {
        pipeline.style.removeProperty('--flow-progress');
        items.forEach((item) => item.classList.remove('isFlowReached'));
      };
    }

    const updateProgress = () => {
      animationFrame = 0;
      const rect = pipeline.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const travel = window.innerWidth <= 980
        ? Math.max(rect.height * 0.82, viewportHeight * 0.65)
        : viewportHeight * 0.58;
      const progress = Math.min(1, Math.max(0, (viewportHeight * 0.8 - rect.top) / travel));
      applyProgress(progress);
    };

    const requestUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      pipeline.style.removeProperty('--flow-progress');
      items.forEach((item) => item.classList.remove('isFlowReached'));
    };
  }, [shouldReduceMotion]);

  const moveToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
      block: 'start',
    });
  };

  return (
    <nav
      className={`introSectionNav ${activeSection === 'vision' ? 'isOnDark' : ''}`}
      aria-label="소개 페이지 섹션"
    >
      <span className="introSectionNavTrack" aria-hidden="true" />
      {sections.map((section, index) => {
        const isActive = activeSection === section.id;

        return (
          <button
            key={section.id}
            type="button"
            className={isActive ? 'isActive' : ''}
            aria-current={isActive ? 'location' : undefined}
            aria-label={`${section.label} 섹션으로 이동`}
            onClick={() => moveToSection(section.id)}
          >
            <span className="introSectionNavIndex">{String(index + 1).padStart(2, '0')}</span>
            <span className="introSectionNavDot" aria-hidden="true" />
            <span className="introSectionNavLabel">{section.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
