'use client';

import { useState } from 'react';
import {
  studioPlanFields, studioPlanGroups,
  type StudioPlan, type StudioPlanField, type StudioPlanFieldKey,
} from '@/lib/studio-plan';

/**
 * 기획서를 항목으로 보여주고 항목 하나씩 고치는 시트.
 *
 * 고르는 방법을 둘로 나눈다. 항목을 누르면 그 항목 전체를, 항목 안에서 글을 끌면
 * 그 문장만 고친다. 드래그를 항목 크기로 넓히지는 않는다. 끄는 동작은 「여기만」이라는
 * 뜻인데 시스템이 말없이 넓히면 사서가 준 신호를 뒤집는 것이 된다.
 *
 * 어느 쪽으로 골랐든 고친 결과는 그 항목으로 돌아간다. 항목이 그릇이라 구조가 깨지지 않는다.
 *
 * 회차는 글이 아니라 표라서 드래그로 「3회차만」을 집을 수 없다. 행을 눌러 고른다.
 */

const quickInstructions = [
  '더 공공기관 문서답게 다듬어',
  '문장을 짧고 명확하게 정리해',
  '더 구체적으로 보이게 다듬어',
  '홍보 문구처럼 참여하고 싶게 바꿔',
];

/** 무엇을 고칠지. 항목 전체이거나, 항목 안의 문장이거나, 회차 한 줄이다. */
type Selection =
  | { kind: 'field'; field: StudioPlanField }
  | { kind: 'text'; field: StudioPlanField; text: string }
  | { kind: 'session'; field: StudioPlanField; session: number };

function valueText(plan: StudioPlan, field: StudioPlanField) {
  const value = plan[field.key];
  if (field.kind === 'lines') return (value as string[]).join('\n');
  return String(value ?? '');
}

function selectionLabel(selection: Selection) {
  if (selection.kind === 'session') return `회차별 활동 · ${selection.session}회차`;
  if (selection.kind === 'text') return `${selection.field.label} · 선택한 문장`;
  return `${selection.field.label} 전체`;
}

export type StudioPlanSheetProps = {
  plan: StudioPlan;
  onChange: (plan: StudioPlan) => void;
};

export default function StudioPlanSheet({ plan, onChange }: StudioPlanSheetProps) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [instruction, setInstruction] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function chooseField(field: StudioPlanField) {
    setSelection((current) => (current?.kind === 'field' && current.field.key === field.key ? null : { kind: 'field', field }));
    setInstruction(''); setError('');
  }

  /** 항목 안에서 글을 끌면 그 문장만 고르되, 고른 범위는 그 항목을 벗어나지 않는다. */
  function chooseText(field: StudioPlanField) {
    const text = window.getSelection()?.toString().trim() ?? '';
    if (!text || text.length < 2) return;
    setSelection({ kind: 'text', field, text });
    setInstruction(''); setError('');
  }

  async function submit() {
    if (!selection || !instruction.trim() || busy) return;
    setBusy(true); setError('');
    const { field } = selection;
    // 고른 범위만 보낸다. 항목 전체를 고를 때만 항목 값을 통째로 보낸다.
    const currentValue = selection.kind === 'text'
      ? selection.text
      : selection.kind === 'session'
        ? plan.sessions.find((row) => row.session === selection.session)
        : plan[field.key];
    try {
      const response = await fetch('/api/studio/revise-field', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldKey: field.key,
          currentValue,
          instruction,
          // 항목 전체가 아닐 때만 붙인다. 고친 글 하나만 돌려받아 제자리에 끼운다.
          scopeLabel: selection.kind === 'field' ? undefined : selectionLabel(selection),
          planTitle: plan.title, planTarget: plan.target,
        }),
      });
      const payload = await response.json() as { value?: unknown; error?: string };
      if (!response.ok || payload.value === undefined) throw new Error(payload.error || '고치지 못했습니다.');
      onChange(applyRevision(plan, selection, payload.value));
      setSelection(null); setInstruction('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '항목 수정 중 문제가 발생했습니다.');
    } finally { setBusy(false); }
  }

  return (
    <div className="studioPlanSheet">
      {studioPlanGroups.map((group) => (
        <section className="studioPlanGroup" key={group}>
          <h3>{group}</h3>
          {studioPlanFields.filter((field) => field.group === group).map((field) => {
            const chosen = selection?.field.key === field.key;
            return (
              <div className={`studioPlanField${chosen ? ' isChosen' : ''}`} key={field.key}>
                <div className="studioPlanFieldHead">
                  <h4>{field.label}{field.manualOnly && <em>직접 입력</em>}</h4>
                  {!field.manualOnly && (
                    <button type="button" onClick={() => chooseField(field)}>
                      {chosen && selection?.kind === 'field' ? '선택 해제' : '이 항목 수정'}
                    </button>
                  )}
                </div>

                {field.kind === 'sessions' ? (
                  <div className="programTableScroll">
                    <table className="programCurriculumTable">
                      <thead><tr><th>회차</th><th>일자</th><th>활동 내용</th><th>준비물</th><th>비고</th></tr></thead>
                      <tbody>{plan.sessions.map((row) => (
                        <tr
                          key={row.session}
                          className={selection?.kind === 'session' && selection.session === row.session ? 'isChosen' : undefined}
                          onClick={() => { setSelection({ kind: 'session', field, session: row.session }); setInstruction(''); setError(''); }}
                        >
                          <td>{row.session}</td><td>{row.date || '-'}</td><td>{row.activity}</td>
                          <td>{row.materials || '-'}</td><td>{row.notes || '-'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                    <p className="studioPlanHint">회차를 누르면 그 회차만 고칩니다.</p>
                  </div>
                ) : field.manualOnly ? (
                  <input
                    className="studioPlanManualInput"
                    value={String(plan[field.key] ?? '')}
                    placeholder={`${field.label}을(를) 적어 주세요`}
                    onChange={(event) => onChange({ ...plan, [field.key]: event.target.value })}
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

      {selection && (
        <aside className="studioPlanRevisePanel" aria-label="수정 요청">
          <p className="studioPlanReviseTarget">고칠 곳: <strong>{selectionLabel(selection)}</strong></p>
          {selection.kind === 'text' && <blockquote>{selection.text}</blockquote>}
          <textarea
            value={instruction}
            placeholder="어떻게 고칠까요?"
            onChange={(event) => setInstruction(event.target.value)}
          />
          <div className="studioPlanQuickChips">
            {quickInstructions.map((text) => (
              <button type="button" key={text} onClick={() => setInstruction(text)}>{text}</button>
            ))}
          </div>
          {error && <p className="studioDocumentError" role="alert">{error}</p>}
          <div className="studioPlanReviseActions">
            <button type="button" className="uiButton uiButtonSecondary" onClick={() => setSelection(null)}>취소</button>
            <button type="button" className="uiButton uiButtonPrimary" disabled={busy || !instruction.trim()} onClick={submit}>
              {busy ? '고치는 중…' : '수정 요청'}
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

/** 고친 값을 원래 자리에 돌려놓는다. */
function applyRevision(plan: StudioPlan, selection: Selection, value: unknown): StudioPlan {
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
      const lines = (plan[field.key] as string[]).map((line) => (line.includes(selection.text) ? line.replace(selection.text, revised) : line));
      return { ...plan, [field.key]: lines };
    }
    return { ...plan, [field.key]: String(plan[field.key] ?? '').replace(selection.text, revised) };
  }
  return { ...plan, [selection.field.key]: value } as StudioPlan;
}

export type { StudioPlanFieldKey };
