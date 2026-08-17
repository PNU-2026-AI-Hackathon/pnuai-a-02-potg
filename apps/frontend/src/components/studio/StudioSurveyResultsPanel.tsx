'use client';

import type { StudioDocumentStage } from '@/lib/studio-draft';
import { defaultSurveyResult, normalizeSurveyResult, type StudioSurveyResult } from '@/lib/studio-survey';

type StageSaveState = 'idle' | 'saving' | 'failed';

type StudioSurveyResultsPanelProps = {
  stage: StudioDocumentStage;
  stageSaveState: StageSaveState;
  survey?: StudioSurveyResult;
  onMarkSurveyComplete: () => void;
};

export default function StudioSurveyResultsPanel({
  stage,
  stageSaveState,
  survey,
  onMarkSurveyComplete,
}: StudioSurveyResultsPanelProps) {
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
      <div className="studioSurveyResultsHeader">
        <div>
          <p className="uiEyebrow">수요조사 결과</p>
          <h2>응답 현황</h2>
        </div>
        <div className="studioSurveyHeaderMeta">
          <span className="studioSurveyRespondents">참여 인원 <strong>{surveyResult.respondents}명</strong></span>
          <span className="studioSurveyStateBadge">
            {stage === '수요조사 완료' ? '검토 완료' : '검토 중'}
          </span>
        </div>
      </div>

      <div className="studioSurveyChartGrid">
        {renderChart('이 프로그램이 개설된다면 참여할 의향이 있나요?', surveyResult.intentionBreakdown)}
        {renderChart('선호하는 시간대가 있나요?', surveyResult.timeSlotBreakdown)}
      </div>

      {stage === '수요조사 중' ? (
        <button
          type="button"
          className="uiButton uiButtonPrimary"
          disabled={stageSaveState === 'saving'}
          onClick={onMarkSurveyComplete}
        >
          수요조사 결과 반영 완료
        </button>
      ) : (
        <span className="studioSurveyCompletedNote">
          수요조사 결과를 반영해 기획안을 이어서 다듬을 수 있습니다.
        </span>
      )}
    </div>
  );
}
