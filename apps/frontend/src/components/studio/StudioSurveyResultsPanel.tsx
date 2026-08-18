'use client';

import { useState } from 'react';
import type { StudioDocumentStage } from '@/lib/studio-draft';
import { defaultSurveyResult, normalizeSurveyResult, type StudioSurveyResult } from '@/lib/studio-survey';

type StudioSurveyResultsPanelProps = {
  stage: StudioDocumentStage;
  survey?: StudioSurveyResult;
};

export default function StudioSurveyResultsPanel({
  stage,
  survey,
}: StudioSurveyResultsPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const surveyResult = normalizeSurveyResult(survey) ?? defaultSurveyResult;

  if (stage !== '수요조사 중' && stage !== '수요조사 완료') {
    return null;
  }

  const palette = ['#2a7a57', '#8cc5a3', '#67a67e', '#dfeee4'];
  const labelLines: Record<string, string[]> = {
    '꼭 참여하고 싶어요': ['꼭 참여하고', '싶어요'],
    '일정이 맞으면 참여하고 싶어요': ['일정이 맞으면', '참여하고 싶어요'],
    '관심은 있지만 참여는 어려워요': ['관심은 있지만', '참여는 어려워요'],
    '관심이 없어요': ['관심이 없어요'],
  };

  const renderChart = (title: string, data: typeof surveyResult.intentionBreakdown) => (
    <div className="studioSurveyList" key={title}>
      <h3>{title}</h3>
      {data.map((choice, index) => (
        <div className="studioSurveyBarRow" key={choice.label}>
          <div className="studioSurveyBarLabelRow">
            <span className="studioSurveyChoiceLabel">
              {(labelLines[choice.label] ?? [choice.label]).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </span>
            <strong>{choice.ratio}% <small>{choice.count}명</small></strong>
          </div>
          <div className="studioSurveyBarTrack" aria-hidden="true">
            <span
              style={{
                width: `${choice.ratio}%`,
                background: `linear-gradient(90deg, ${palette[index % palette.length]} 0%, ${palette[(index + 1) % palette.length]} 100%)`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="studioSurveyResultsPanel" aria-label="수요조사 결과 요약">
      <div className="studioSurveySummary">
        <div className="studioSurveySummaryText">
          <span className={`studioSurveyLiveDot ${stage === '수요조사 완료' ? 'isComplete' : ''}`} aria-hidden="true" />
          <strong>{stage === '수요조사 완료' ? '수요조사 완료' : '수요조사 진행 중'}</strong>
          <span aria-hidden="true">·</span>
          <span>참여 {surveyResult.respondents}명</span>
        </div>
        <button
          type="button"
          className="studioSurveyResultsToggle"
          aria-expanded={isExpanded}
          aria-controls="studio-survey-results-details"
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? '결과 접기' : '결과 보기'}
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
            <polyline points={isExpanded ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
          </svg>
        </button>
      </div>

      {isExpanded ? (
        <div className="studioSurveyResultsDetails" id="studio-survey-results-details">
          <div className="studioSurveyResultsHeader">
            <div>
              <p className="uiEyebrow">수요조사 결과</p>
              <h2>응답 현황</h2>
            </div>
            <span className="studioSurveyStateBadge">
              {stage === '수요조사 완료' ? '조사 완료' : '응답 수집 중'}
            </span>
          </div>

          <div className="studioSurveyChartGrid">
            {renderChart('이 프로그램이 개설된다면 참여할 의향이 있나요?', surveyResult.intentionBreakdown)}
            {renderChart('선호하는 시간대가 있나요?', surveyResult.timeSlotBreakdown)}
          </div>

          {stage === '수요조사 완료' ? (
            <span className="studioSurveyCompletedNote">
              완료된 수요조사의 응답 결과입니다. 기획안을 다듬을 때 참고할 수 있습니다.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
