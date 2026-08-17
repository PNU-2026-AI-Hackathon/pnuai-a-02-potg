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

  return (
    <div className="studioSurveyResultsPanel" aria-label="수요조사 결과 요약">
      <div className="studioSurveyResultsHeader">
        <div>
          <p className="uiEyebrow">수요조사 결과</p>
          <h2>주민 참여 반응 요약</h2>
        </div>
        <span className="studioSurveyStateBadge">
          {stage === '수요조사 완료' ? '검토 완료' : '검토 중'}
        </span>
      </div>

      <div className="studioSurveyStatsGrid">
        <div className="studioSurveyStatCard">
          <span>참여 인원</span>
          <strong>{surveyResult.respondents}명</strong>
          <small>
            대상 {surveyResult.totalTarget}명 중 {Math.round((surveyResult.respondents / surveyResult.totalTarget) * 100)}% 응답
          </small>
        </div>
        <div className="studioSurveyStatCard">
          <span>프로그램 선호</span>
          <strong>{surveyResult.topChoices[0]?.label ?? '결과 없음'}</strong>
          <small>{surveyResult.topChoices[0]?.ratio ?? 0}% 선호</small>
        </div>
        <div className="studioSurveyStatCard">
          <span>시간대 선호</span>
          <strong>주말·오후</strong>
          <small>참여 편의성 높은 시간대</small>
        </div>
        <div className="studioSurveyStatCard">
          <span>만족도</span>
          <strong>{surveyResult.satisfaction}%</strong>
          <small>기획 방향 적합도</small>
        </div>
      </div>

      <div className="studioSurveyContent">
        <div className="studioSurveyList">
          <h3>선호 프로그램 TOP 5</h3>
          {surveyResult.topChoices.map((choice) => (
            <div className="studioSurveyBarRow" key={choice.label}>
              <div className="studioSurveyBarLabelRow">
                <span>{choice.label}</span>
                <strong>{choice.ratio}%</strong>
              </div>
              <div className="studioSurveyBarTrack" aria-hidden="true">
                <span style={{ width: `${choice.ratio}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="studioSurveyComments">
          <h3>대표 의견</h3>
          <ul>
            {surveyResult.comments.map((comment) => (
              <li key={comment}>{comment}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="studioSurveyActionBox">
        <strong>기획안 반영 포인트</strong>
        <ul>
          {surveyResult.actionPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
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
    </div>
  );
}
