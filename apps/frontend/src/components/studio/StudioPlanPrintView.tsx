import { Fragment } from 'react';
import { studioPlanFieldMap, type StudioPlan } from '@/lib/studio-plan';

/**
 * 내보낼 기획서. 화면에서는 숨기고 인쇄할 때만 나온다.
 *
 * 브라우저 인쇄로 PDF를 만든다. 한글 글꼴을 번들에 넣지 않아도 되고 표가 그대로
 * 나오기 때문이다. PDF 라이브러리로 그리면 한글 글꼴 파일을 몇 MB씩 싣고 표도
 * 직접 그려야 한다.
 *
 * 도서관이 실제로 쓰는 강의계획서를 따라, 정보를 테두리 하나로 묶은 표에 담는다.
 * 표를 여러 개 쌓으면 결재 문서가 아니라 인쇄물 묶음처럼 보인다.
 *
 * 화면용 시트를 그대로 인쇄하지 않고 따로 그리는 이유는 결재 문서로 쓸 모양이
 * 다르기 때문이다. 수정 단추와 선택 표시는 종이에 필요 없다.
 */

/** 두 칸씩 나란히 놓을 항목. 짧은 값이라 한 줄에 둘이 들어간다. */
const PAIRED_ROWS: Array<Array<keyof StudioPlan>> = [
  ['target', 'capacity'],
  ['period', 'sessionCount'],
  ['classTime', 'applicationPeriod'],
  ['location', 'instructor'],
];

/** 한 줄을 다 쓰는 항목. 문장이라 두 칸으로 쪼개면 읽기 어렵다. */
const WIDE_ROWS: Array<keyof StudioPlan> = ['intent', 'goal', 'expectedEffects', 'promotion'];

/** 「준비 사항」 라벨 하나로 세로로 묶을 항목. 원본 계획서가 쓰는 묶음이다. */
const PREPARATION_ROWS: Array<keyof StudioPlan> = ['materials', 'materialFee', 'roomSetup'];

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
  const programName = title || plan.title || '프로그램 계획서';

  return (
    <article className="studioPlanPrint" aria-hidden="true">
      <h1 className="studioPlanPrintTitle">프로그램 계획서</h1>

      <table className="studioPlanPrintTable">
        <colgroup>
          <col className="studioPlanPrintLabelCol" />
          <col />
          <col className="studioPlanPrintLabelCol" />
          <col />
        </colgroup>
        <tbody>
          {/* 프로그램명은 문서 제목이 아니라 표 첫 칸에 둔다. 결재 문서의 차례다. */}
          <tr>
            <th>프로그램명</th>
            <td className="studioPlanPrintName" colSpan={3}>{programName}</td>
          </tr>

          {/* 짧은 값은 가운데로 모은다. 왼쪽에 붙여 두면 넓은 칸에 글자 두어 개만 떠 있다. */}
          {PAIRED_ROWS.map((row) => (
            <tr key={row.join('-')}>
              {row.map((key) => (
                <Fragment key={key}>
                  <th>{label(key)}</th>
                  <td className="studioPlanPrintTerm">{text(plan, key)}</td>
                </Fragment>
              ))}
            </tr>
          ))}

          {WIDE_ROWS.map((key) => (
            <tr key={key}>
              <th>{label(key)}</th>
              <td colSpan={3}>{text(plan, key)}</td>
            </tr>
          ))}

          {/* 준비 사항 셋은 라벨 하나로 세로로 묶는다. 라벨 칸이 세 번 반복되지 않는다. */}
          {PREPARATION_ROWS.map((key, index) => (
            <tr key={key}>
              {index === 0 ? <th className="studioPlanPrintGroupLabel" rowSpan={PREPARATION_ROWS.length}>준비 사항</th> : null}
              <th className="studioPlanPrintSubLabel">{label(key)}</th>
              <td className={key === 'materialFee' ? 'studioPlanPrintTerm' : undefined} colSpan={2}>{text(plan, key)}</td>
            </tr>
          ))}

          {plan.cautions.length ? (
            <tr>
              <th>{label('cautions')}</th>
              <td colSpan={3}>
                <ul>{plan.cautions.map((line) => <li key={line}>{line}</li>)}</ul>
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <h2 className="studioPlanPrintHeading">회차별 활동</h2>
      {plan.sessions.length ? (
        <table className="studioPlanPrintTable studioPlanPrintSessions">
          <thead>
            <tr>
              <th>회차</th><th>일자</th><th>활동 내용</th><th>준비물</th><th>비고</th>
            </tr>
          </thead>
          <tbody>
            {plan.sessions.map((session) => (
              <tr key={session.session}>
                <td>{session.session}</td>
                <td className="studioPlanPrintTerm">{session.date || '-'}</td>
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

      {/* 원본 계획서들이 맨 아래에 두는 한 줄. 확정본이 아님을 종이에서도 알 수 있다. */}
      <p className="studioPlanPrintFooter">
        ※ 도서관 또는 강사 사정에 따라 차시 및 내용은 변경될 수 있습니다.
      </p>
    </article>
  );
}
