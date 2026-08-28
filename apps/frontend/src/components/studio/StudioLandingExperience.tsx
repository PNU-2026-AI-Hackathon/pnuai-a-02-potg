'use client';

import { animate, inView, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';

const revealEase = [0.22, 1, 0.36, 1] as const;

type RevealGroup = {
  section: string;
  items: string;
  stagger?: number;
  delay?: number;
};

const revealGroups: RevealGroup[] = [
  {
    section: '.studioLandingHero',
    items: '.studioLandingHeroCopy > .uiEyebrow, .studioLandingHeroCopy > h1, .studioLandingClaim, .studioLandingLead, .studioLandingHeroActions, .studioLandingHeroVisual',
    stagger: 0.07,
  },
  {
    section: '.studioLandingValue',
    items: '.studioLandingSectionHeading, .studioLandingValueGrid article',
    stagger: 0.09,
  },
  {
    section: '.studioLandingWorkflow',
    items: '.studioLandingSectionHeading, .studioLandingFeatureList li',
    stagger: 0.08,
  },
  {
    section: '.studioLandingFinalCta',
    items: '.studioLandingFinalInner > .studioTitleIcon, .studioLandingFinalInner > .uiEyebrow, .studioLandingFinalInner > h2, .studioLandingFinalInner > p, .studioLandingFinalInner > .studioAccessCta',
    stagger: 0.06,
  },
];

export default function StudioLandingExperience() {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return;

    const controls: Array<{ stop: () => void }> = [];
    const cleanups: Array<() => void> = [];
    const animatedElements = new Set<HTMLElement>();

    revealGroups.forEach((group) => {
      const section = document.querySelector<HTMLElement>(group.section);
      if (!section) return;

      const items = Array.from(section.querySelectorAll<HTMLElement>(group.items));
      if (!items.length) return;

      let hasPlayed = false;
      const stop = inView(
        section,
        () => {
          if (hasPlayed) return;
          hasPlayed = true;

          items.forEach((item, index) => {
            animatedElements.add(item);
            const animation = animate(
              item,
              { opacity: [0, 1], y: [14, 0] },
              {
                duration: 0.46,
                delay: (group.delay ?? 0) + index * (group.stagger ?? 0.07),
                ease: revealEase,
              },
            );

            void animation.then(() => {
              item.style.removeProperty('opacity');
              item.style.removeProperty('transform');
            });
            controls.push(animation);
          });
        },
        { amount: 0.08, margin: '0px 0px -7% 0px' },
      );

      cleanups.push(stop);
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      controls.forEach((control) => control.stop());
      animatedElements.forEach((element) => {
        element.style.removeProperty('opacity');
        element.style.removeProperty('transform');
      });
    };
  }, [shouldReduceMotion]);

  return null;
}
