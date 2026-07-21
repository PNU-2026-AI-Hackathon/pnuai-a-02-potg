import type { ReactNode } from 'react';

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  light?: boolean;
};

export default function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  light = false,
}: SectionHeadingProps) {
  return (
    <div className={`homeSectionHeading${light ? ' isLight' : ''}`}>
      <div>
        <p className="uiEyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <p className="homeSectionDescription">{description}</p>
      </div>
      {action ? <div className="homeSectionAction">{action}</div> : null}
    </div>
  );
}
