'use client';

import {
  studioPlanFields, studioPlanGroups,
  type StudioPlan, type StudioPlanField, type StudioPlanFieldKey,
} from '@/lib/studio-plan';

/**
 * 기획서를 항목으로 보여주고 무엇을 고칠지 고르게 한다.
 *
 * 고른 뒤의 수정 요청은 이 시트가 아니라 화면 오른쪽 패널이 받는다. 사서가 이미
 * 그 패널로 수정하던 흐름을 그대로 쓰는 편이 낫고, 시트 아래에 입력칸을 또 두면
 * 같은 일을 하는 자리가 둘이 된다.
 *
 * 고르는 방법은 셋이다. 항목을 누르면 그 항목 전체, 항목 안에서 글을 끌면 그 문장,
 * 회차 표의 행을 누르면 그 회차다. 드래그를 항목 크기로 넓히지는 않는다. 끄는 동작은
 * 「여기만」이라는 뜻인데 시스템이 말없이 넓히면 사서가 준 신호를 뒤집는 것이 된다.
 */

/** 무엇을 고칠지. 항목 전체이거나, 항목 안의 문장이거나, 회차 한 줄이다. */
export type PlanSelection =
  | { kind: 'field'; field: StudioPlanField }
  | { kind: 'text'; field: StudioPlanField; text: string }
  | { kind: 'session'; field: StudioPlanField; session: number };

export function planSelectionLabel(selection: PlanSelection) {
  if (selection.kind === 'session') return `회차별 활동 · ${selection.session}회차`;
  if (selection.kind === 'text') return `${selection.field.label} · 선택한 문장`;
  return `${selection.field.label} 전체`;
}

/** 고른 곳의 지금 값. 요청에 이 값만 실어 보낸다. */
export function planSelectionValue(plan: StudioPlan, selection: PlanSelection): unknown {
  if (selection.kind === 'text') return selection.text;
  if (selection.kind === 'session') return plan.sessions.find((row) => row.session === selection.session);
  return plan[selection.field.key];
}

/** 고친 값을 원래 자리에 돌려놓는다. */
export function applyPlanRevision(plan: StudioPlan, selection: PlanSelection, value: unknown): StudioPlan {
  if (selection.kind === 'session') {
    const revised = String(value ?? '').trim();
    if (!revised) return plan;
    return {
      ...plan,
      sessions: plan.sessions.map((row) => (row.session === selection.session ? { ...row, activity: revised } : row)),
    };
  }
  if (selection.kind === 'text') {
    const revised = String(value ?? '').trim();
    const field = selection.field;
    if (!revised) return plan;
    if (field.kind === 'lines') {
      const lines = (plan[field.key] as string[])
        .map((line) => (line.includes(selection.text) ? line.replace(selection.text, revised) : line));
      return { ...plan, [field.key]: lines };
    }
    return { ...plan, [field.key]: String(plan[field.key] ?? '').replace(selection.text, revised) };
  }
  return { ...plan, [selection.field.key]: value } as StudioPlan;
}

function valueText(plan: StudioPlan, field: StudioPlanField) {
  const value = plan[field.key];
  if (field.kind === 'lines') return (value as string[]).join('\n');
  return String(value ?? '');
}

export type StudioPlanSheetProps = {
  plan: StudioPlan;
  selection: PlanSelection | null;
  /** 고친 항목. 어디가 바뀌었는지 눈에 보이게 표시한다. */
  revisedFields: Set<StudioPlanFieldKey>;
  revisedSessions: Set<number>;
  onSelect: (selection: PlanSelection | null) => void;
  onManualChange: (key: StudioPlanFieldKey, value: string) => void;
};

export default function StudioPlanSheet({
  plan, selection, revisedFields, revisedSessions, onSelect, onManualChange,
}: StudioPlanSheetProps) {
  /** 항목 안에서 글을 끌면 그 문장만 고르되, 고른 범위는 그 항목을 벗어나지 않는다. */
  function chooseText(field: StudioPlanField) {
    const text = window.getSelection()?.toString().trim() ?? '';
    if (!text || text.length < 2) return;
    onSelect({ kind: 'text', field, text });
  }

  return (
    <div className="studioPlanSheet">
      {studioPlanGroups.map((group) => (
        <section className="studioPlanGroup" key={group}>
          <h3>{group}</h3>
          {studioPlanFields.filter((field) => field.group === group).map((field) => {
            const chosen = selection?.field.key === field.key;
            const revised = revisedFields.has(field.key);
            return (
              <div
                className={`studioPlanField${chosen ? ' isChosen' : ''}${revised ? ' isRevised' : ''}`}
                key={field.key}
              >
                <div className="studioPlanFieldHead">
                  <h4>
                    {field.label}
                    {field.manualOnly && <em>직접 입력</em>}
                    {revised && <b className="studioPlanRevisedBadge">수정됨</b>}
                  </h4>
                  {!field.manualOnly && (
                    <button
                      type="button"
                      onClick={() => onSelect(chosen && selection?.kind === 'field' ? null : { kind: 'field', field })}
                    >
                      {chosen && selection?.kind === 'field' ? '선택 해제' : '이 항목 수정'}
                    </button>
                  )}
                </div>

                {field.kind === 'sessions' ? (
                  <div className="programTableScroll">
                    <table className="programCurriculumTable">
                      <thead><tr><th>회차</th><th>일자</th><th>활동 내용</th><th>준비물</th><th>비고</th></tr></thead>
                      <tbody>{plan.sessions.map((row) => {
                        const rowChosen = selection?.kind === 'session' && selection.session === row.session;
                        const rowRevised = revisedSessions.has(row.session);
                        return (
                          <tr
                            key={row.session}
                            className={`${rowChosen ? 'isChosen' : ''}${rowRevised ? ' isRevised' : ''}`.trim() || undefined}
                            onClick={() => onSelect({ kind: 'session', field, session: row.session })}
                          >
                            <td>{row.session}</td><td>{row.date || '-'}</td><td>{row.activity}</td>
                            <td>{row.materials || '-'}</td><td>{row.notes || '-'}</td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                    <p className="studioPlanHint">회차를 누르면 그 회차만 고칩니다.</p>
                  </div>
                ) : field.manualOnly ? (
                  <input
                    className="studioPlanManualInput"
                    value={String(plan[field.key] ?? '')}
                    placeholder={`${field.label}을(를) 적어 주세요`}
                    onChange={(event) => onManualChange(field.key, event.target.value)}
                  />
                ) : (
                  <p className="studioPlanValue" onMouseUp={() => chooseText(field)}>
                    {valueText(plan, field) || '내용 없음'}
                  </p>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
