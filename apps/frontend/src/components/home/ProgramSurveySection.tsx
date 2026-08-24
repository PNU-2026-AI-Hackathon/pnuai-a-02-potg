'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import SectionHeading from './SectionHeading';
import ProgramSurveyModal from './ProgramSurveyModal';

export type HomeVotingDocument = {
  id: string;
  title: string;
  content: string;
  voteCount: number;
  hasVoted: boolean;
  myIntention: string | null;
  myTimeSlot: string | null;
};

function fieldValue(content: string, label: string) {
  const match = content.match(new RegExp(`(?:^|\\n)${label}\\n([^\\n]+)`));
  return match?.[1]?.trim() || '미정';
}

function description(content: string) {
  return fieldValue(content, '기획 의도');
}

function randomPrograms(programs: HomeVotingDocument[], count: number) {
  const shuffled = [...programs];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled.slice(0, count);
}

export default function ProgramSurveySection() {
  const [programs, setPrograms] = useState<HomeVotingDocument[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<HomeVotingDocument | null>(null);

  useEffect(() => {
    fetch('/api/studio/votes', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setPrograms(randomPrograms(data.documents ?? [], 3)))
      .catch(() => setPrograms([]));
  }, []);

  function updateProgram(document: HomeVotingDocument) {
    setPrograms((current) => current.map((item) => item.id === document.id ? document : item));
    setSelectedProgram(document);
  }

  return (
    <section className="homeSection surveySection" id="program-survey">
      <div className="uiContainer">
        <SectionHeading
          eyebrow="PLANNING NOW"
          title="주민의 선택을 기다리는 프로그램"
          description="사서가 준비 중인 프로그램 기획서를 확인하고, 투표로 참여 의사를 알려주세요."
          light
          action={
            <Link className="uiTextLink mobileOnlySectionLink" href="/survey">
              전체 수요조사 보기 <span aria-hidden="true">→</span>
            </Link>
          }
        />
        <div className="surveyGrid">
          {programs.map((program) => (
            <article className="surveyCard" key={program.id}>
              <div className="surveyCardTop">
                <span className="uiTag uiTagPlanning">수요조사 중</span>
              </div>
              <h3>{program.title}</h3>
              <dl><div><dt>대상</dt><dd>{fieldValue(program.content, '대상')}</dd></div><div><dt>운영 기간</dt><dd>{fieldValue(program.content, '운영 기간')}</dd></div></dl>
              <p>{description(program.content)}</p>
              <div className="surveyCardFooter">
                <strong><span aria-hidden="true">●</span> {program.voteCount}명 참여</strong>
                <button className="uiButton uiButtonLight" type="button" onClick={() => setSelectedProgram(program)}>{program.hasVoted ? '내 응답 확인·수정' : '수요조사 참여하기'}</button>
              </div>
            </article>
          ))}
        </div>
      </div>
      {selectedProgram ? <ProgramSurveyModal program={selectedProgram} onUpdated={updateProgram} onClose={() => setSelectedProgram(null)} /> : null}
    </section>
  );
}
