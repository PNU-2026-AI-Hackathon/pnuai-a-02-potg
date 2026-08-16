'use client';

import { useRef } from 'react';
import {
  studioPlanFields, studioPlanGroups,
  type StudioPlan, type StudioPlanField, type StudioPlanFieldKey, type StudioPlanSession,
} from '@/lib/studio-plan';

/**
 * 기획서를 항목으로 보여주고, 사서가 직접 고치거나 AI에게 고쳐 달라고 시킨다.
 *
 * 두 가지 고치는 길을 함께 둔다. 한 글자 바꾸는 데까지 AI를 부를 이유가 없고,
 * 반대로 문단을 새로 쓰는 일을 손으로만 하게 두는 것도 이 도구를 쓰는 뜻이 없다.
 * 그래서 모든 항목은 바로 타이핑할 수 있고, AI에게 맡기고 싶을 때만 고를 수 있다.
 *
 * 고른 뒤의 수정 요청은 이 시트가 아니라 화면 오른쪽 패널이 받는다. 사서가 이미
 * 그 패널로 수정하던 흐름을 그대로 쓰는 편이 낫고, 시트 아래에 입력칸을 또 두면
 * 같은 일을 하는 자리가 둘이 된다.
 *
 * AI에게 맡길 곳을 고르는 방법은 셋이다. 항목을 누르면 그 항목 전체, 항목 안에서
 * 글을 끌면 그 문장, 회차 줄의 「AI 수정」을 누르면 그 회차다. 드래그를 항목 크기로
 * 넓히지는 않는다. 끄는 동작은 「여기만」이라는 뜻인데 시스템이 말없이 넓히면
 * 사서가 준 신호를 뒤집는 것이 된다.
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

/** 화면에 적은 글을 그 항목이 쓰는 모양으로 되돌린다. 줄 목록 항목은 줄마다 하나다. */
function textToValue(field: StudioPlanField, text: string) {
  if (field.kind !== 'lines') return text;
  return text.split('\n').map((line) => line.replace(/^[-·•]\s*/, '').trim()).filter(Boolean);
}

/** 회차 번호를 1부터 다시 매긴다. 지운 뒤 번호가 비면 결재 문서에서 빠뜨린 것처럼 보인다. */
function renumber(sessions: StudioPlanSession[]) {
  return sessions.map((row, index) => ({ ...row, session: index + 1 }));
}

export type StudioPlanSheetProps = {
  plan: StudioPlan;
  selection: PlanSelection | null;
  /** 고친 항목. 어디가 바뀌었는지 눈에 보이게 표시한다. */
  revisedFields: Set<StudioPlanFieldKey>;
  revisedSessions: Set<number>;
  onSelect: (selection: PlanSelection | null) => void;
  onChange: (plan: StudioPlan) => void;
};

export default function StudioPlanSheet({
  plan, selection, revisedFields, revisedSessions, onSelect, onChange,
}: StudioPlanSheetProps) {
  /**
   * 항목마다 입력칸을 기억해 둔다. 글을 끌어 고른 범위를 읽으려면 그 입력칸이 필요하다.
   * 입력칸 안의 선택은 window.getSelection으로 읽히지 않는다.
   */
  const inputRefs = useRef(new Map<StudioPlanFieldKey, HTMLTextAreaElement>());

  function setField(field: StudioPlanField, text: string) {
    onChange({ ...plan, [field.key]: textToValue(field, text) } as StudioPlan);
  }

  function setSessions(sessions: StudioPlanSession[]) {
    onChange({ ...plan, sessions });
  }

  function setSessionCell(session: number, key: keyof StudioPlanSession, value: string) {
    setSessions(plan.sessions.map((row) => (row.session === session ? { ...row, [key]: value } : row)));
  }

  function addSession() {
    setSessions([
      ...plan.sessions,
      { session: plan.sessions.length + 1, date: '', activity: '', materials: '', notes: '' },
    ]);
  }

  function removeSession(session: number) {
    setSessions(renumber(plan.sessions.filter((row) => row.session !== session)));
  }

  /** 항목 안에서 글을 끌면 그 문장만 고르되, 고른 범위는 그 항목을 벗어나지 않는다. */
  function chooseText(field: StudioPlanField) {
    const input = inputRefs.current.get(field.key);
    if (!input) return;
    const text = input.value.slice(input.selectionStart, input.selectionEnd).trim();
    if (text.length < 2) return;
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
                      {chosen && selection?.kind === 'field' ? '선택 해제' : 'AI에게 맡기기'}
                    </button>
                  )}
                </div>

                {field.kind === 'sessions' ? (
                  <>
                    <div className="programTableScroll">
                      <table className="programCurriculumTable studioPlanSessionTable">
                        <thead>
                          <tr>
                            <th>회차</th><th>일자</th><th>활동 내용</th><th>준비물</th><th>비고</th><th>수정</th>
                          </tr>
                        </thead>
                        <tbody>{plan.sessions.map((row) => {
                          const rowChosen = selection?.kind === 'session' && selection.session === row.session;
                          const rowRevised = revisedSessions.has(row.session);
                          return (
                            <tr
                              key={row.session}
                              className={`${rowChosen ? 'isChosen' : ''}${rowRevised ? ' isRevised' : ''}`.trim() || undefined}
                            >
                              <td>{row.session}</td>
                              <td>
                                <input
                                  value={row.date ?? ''}
                                  placeholder="-"
                                  aria-label={`${row.session}회차 일자`}
                                  onChange={(event) => setSessionCell(row.session, 'date', event.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.activity}
                                  placeholder="활동 내용"
                                  aria-label={`${row.session}회차 활동 내용`}
                                  onChange={(event) => setSessionCell(row.session, 'activity', event.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.materials ?? ''}
                                  placeholder="-"
                                  aria-label={`${row.session}회차 준비물`}
                                  onChange={(event) => setSessionCell(row.session, 'materials', event.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  value={row.notes ?? ''}
                                  placeholder="-"
                                  aria-label={`${row.session}회차 비고`}
                                  onChange={(event) => setSessionCell(row.session, 'notes', event.target.value)}
                                />
                              </td>
                              <td className="studioPlanSessionActions">
                                <button
                                  type="button"
                                  onClick={() => onSelect(rowChosen ? null : { kind: 'session', field, session: row.session })}
                                >
                                  {rowChosen ? '해제' : 'AI'}
                                </button>
                                <button
                                  type="button"
                                  className="studioPlanSessionRemove"
                                  aria-label={`${row.session}회차 삭제`}
                                  onClick={() => removeSession(row.session)}
                                >
                                  삭제
                                </button>
                              </td>
                            </tr>
                          );
                        })}</tbody>
                      </table>
                    </div>
                    <div className="studioPlanSessionFoot">
                      <button type="button" className="studioPlanSessionAdd" onClick={addSession}>
                        + 회차 추가
                      </button>
                      <p className="studioPlanHint">칸을 눌러 바로 고치고, 「AI」를 누르면 그 회차만 맡깁니다.</p>
                    </div>
                  </>
                ) : (
                  <textarea
                    className="studioPlanValueInput"
                    ref={(node) => {
                      if (node) inputRefs.current.set(field.key, node);
                      else inputRefs.current.delete(field.key);
                    }}
                    value={valueText(plan, field)}
                    rows={field.kind === 'lines' ? 3 : 2}
                    placeholder={field.manualOnly ? `${field.label}을(를) 적어 주세요` : field.hint}
                    aria-label={field.label}
                    onChange={(event) => setField(field, event.target.value)}
                    onMouseUp={() => !field.manualOnly && chooseText(field)}
                  />
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
