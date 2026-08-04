'use client';

import { animate, inView, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';

const revealEase = [0.22, 1, 0.36, 1] as const;

export default function AboutExperience() {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return;

    const animationControls: Array<{ stop: () => void }> = [];
    const observerCleanups: Array<() => void> = [];

    const prepare = (elements: HTMLElement[], distance = 22) => {
      elements.forEach((element) => {
        element.style.opacity = '0';
        element.style.transform = `translateY(${distance}px)`;
      });
    };

    const reveal = (
      elements: HTMLElement[],
      options: { delay?: number; stagger?: number; distance?: number } = {},
    ) => {
      const { delay = 0, stagger = 0.12 } = options;

      elements.forEach((element, index) => {
        const controls = animate(
          element,
          { opacity: 1, y: 0 },
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

      prepare(items);
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

    const heroItems = [
      document.querySelector<HTMLElement>('.introHeroCopy'),
      document.querySelector<HTMLElement>('.introHeroVisual'),
    ].filter((element): element is HTMLElement => Boolean(element));

    prepare(heroItems, 26);
    const heroFrame = window.requestAnimationFrame(() => {
      reveal(heroItems, { stagger: 0.18 });
    });

    revealOnce('.valueSection', '.valueCard');
    revealOnce('.featureSection', '.featureCard');
    revealOnce('.audienceSection', '.audienceCard', 0.14);
    revealOnce('.flowSection', '.pipelineItem', 0.11);

    const vision = document.querySelector<HTMLElement>('.visionSection');
    if (vision) {
      const title = Array.from(
        vision.querySelectorAll<HTMLElement>('.uiEyebrow, h2'),
      );
      const connection = Array.from(
        vision.querySelectorAll<HTMLElement>('.visionConnection'),
      );
      const body = Array.from(
        vision.querySelectorAll<HTMLElement>(
          '.visionLead, .visionClosing, .visionPromise, .visionSparkle',
        ),
      );
      const visionItems = [...title, ...connection, ...body];

      prepare(visionItems, 18);
      let hasPlayed = false;
      const stop = inView(
        vision,
        () => {
          if (hasPlayed) return;
          hasPlayed = true;
          reveal(title, { stagger: 0.08 });
          reveal(connection, { delay: 0.2, stagger: 0 });
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
    };
  }, [shouldReduceMotion]);

  return null;
}
