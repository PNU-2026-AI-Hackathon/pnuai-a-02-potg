'use client';

import { useState } from 'react';
import SectionHeading from './SectionHeading';
import ProgramSurveyModal from './ProgramSurveyModal';
import { programSurveys } from './home-data';

export default function ProgramSurveySection() {
  const [selectedProgram, setSelectedProgram] =
    useState<(typeof programSurveys)[number] | null>(null);

  return (
    <section className="homeSection surveySection" id="program-survey">
      <div className="uiContainer">
        <SectionHeading
          eyebrow="PLANNING NOW"
          title="주민 의견을 기다리는 프로그램"
          description="사서가 준비 중인 프로그램 기획안을 확인하고, 투표로 참여 의사를 알려주세요."
          light
        />
        <div className="surveyGrid">
          {programSurveys.map((program) => (
            <article className="surveyCard" key={program.id}>
              <div className="surveyCardTop">
                <span className="uiTag uiTagPlanning">기획 중</span>
                <span>마감 {program.deadline}</span>
              </div>
              <h3>{program.title}</h3>
              <dl>
                <div>
                  <dt>대상</dt>
                  <dd>{program.audience}</dd>
                </div>
                <div>
                  <dt>관련 의제</dt>
                  <dd>{program.agenda}</dd>
                </div>
              </dl>
              <p>{program.description}</p>
              <div className="surveyCardFooter">
                <strong>
                  <span aria-hidden="true">●</span> {program.participants}명 참여 의향
                </strong>
                <button
                  className="uiButton uiButtonLight"
                  type="button"
                  onClick={() => setSelectedProgram(program)}
                >
                  수요조사 참여하기
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      {selectedProgram ? (
        <ProgramSurveyModal
          program={selectedProgram}
          onClose={() => setSelectedProgram(null)}
        />
      ) : null}
    </section>
  );
}
