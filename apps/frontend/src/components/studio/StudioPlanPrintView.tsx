import { Fragment } from 'react';
import { studioPlanFieldMap, type StudioPlan } from '@/lib/studio-plan';

/**
 * 내보낼 기획서. 화면에서는 숨기고 인쇄할 때만 나온다.
 *
 * 브라우저 인쇄로 PDF를 만든다. 한글 글꼴을 번들에 넣지 않아도 되고 표가 그대로
 * 나오기 때문이다. PDF 라이브러리로 그리면 한글 글꼴 파일을 몇 MB씩 싣고 표도
 * 직접 그려야 한다.
 *
 * 화면용 시트를 그대로 인쇄하지 않고 따로 그리는 이유는 결재 문서로 쓸 모양이
 * 다르기 때문이다. 수정 단추와 선택 표시는 종이에 필요 없고, 개요는 줄글보다
 * 표로 있어야 결재판에서 읽힌다.
 */

const OVERVIEW_ROWS: Array<Array<keyof StudioPlan>> = [
  ['target', 'capacity'],
  ['period', 'sessionCount'],
  ['location', 'instructor'],
];

function label(key: keyof StudioPlan) {
  return studioPlanFieldMap.get(key as never)?.label ?? String(key);
}

function text(plan: StudioPlan, key: keyof StudioPlan) {
  const value = plan[key];
  return typeof value === 'string' && value.trim() ? value : '-';
}

export type StudioPlanPrintViewProps = {
  plan: StudioPlan;
  title: string;
};

export default function StudioPlanPrintView({ plan, title }: StudioPlanPrintViewProps) {
  const hasSessions = plan.sessions.length > 0;
  return (
    <article className="studioPlanPrint" aria-hidden="true">
      <h1 className="studioPlanPrintTitle">{title || plan.title || '프로그램 기획서'}</h1>

      <table className="studioPlanPrintTable">
        <tbody>
          {OVERVIEW_ROWS.map((row) => (
            <tr key={row.join('-')}>
              {row.map((key) => (
                <Fragment key={key}>
                  <th>{label(key)}</th>
                  <td>{text(plan, key)}</td>
                </Fragment>
              ))}
            </tr>
          ))}
          <tr>
            <th>{label('intent')}</th>
            <td colSpan={3}>{text(plan, 'intent')}</td>
          </tr>
          <tr>
            <th>{label('goal')}</th>
            <td colSpan={3}>{text(plan, 'goal')}</td>
          </tr>
        </tbody>
      </table>

      <h2 className="studioPlanPrintHeading">{label('sessions')}</h2>
      {hasSessions ? (
        <table className="studioPlanPrintTable studioPlanPrintSessions">
          <thead>
            <tr><th>회차</th><th>일자</th><th>활동 내용</th><th>준비물</th><th>비고</th></tr>
          </thead>
          <tbody>
            {plan.sessions.map((session) => (
              <tr key={session.session}>
                <td>{session.session}</td>
                <td>{session.date || '-'}</td>
                <td>{session.activity}</td>
                <td>{session.materials || '-'}</td>
                <td>{session.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="studioPlanPrintEmpty">회차별 활동이 아직 없습니다.</p>
      )}

      <h2 className="studioPlanPrintHeading">준비 사항</h2>
      <table className="studioPlanPrintTable">
        <tbody>
          <tr><th>{label('materials')}</th><td>{text(plan, 'materials')}</td></tr>
          <tr><th>{label('materialFee')}</th><td>{text(plan, 'materialFee')}</td></tr>
          <tr><th>{label('roomSetup')}</th><td>{text(plan, 'roomSetup')}</td></tr>
        </tbody>
      </table>

      <h2 className="studioPlanPrintHeading">기대 효과와 안내</h2>
      <table className="studioPlanPrintTable">
        <tbody>
          <tr><th>{label('expectedEffects')}</th><td>{text(plan, 'expectedEffects')}</td></tr>
          <tr><th>{label('promotion')}</th><td>{text(plan, 'promotion')}</td></tr>
          <tr>
            <th>{label('cautions')}</th>
            <td>
              {plan.cautions.length ? (
                <ul>{plan.cautions.map((line) => <li key={line}>{line}</li>)}</ul>
              ) : '-'}
            </td>
          </tr>
        </tbody>
      </table>

      {/* 초안임을 종이에도 남긴다. 결재판에 올라간 뒤에는 화면 안내가 보이지 않는다. */}
      <p className="studioPlanPrintFooter">
        이 문서는 MOIRA Studio가 만든 기획 초안입니다. 최종 내용은 담당 사서가 검토·확정합니다.
      </p>
    </article>
  );
}
