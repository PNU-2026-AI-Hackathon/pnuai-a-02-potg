'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { studioFields, type StudioConditionKey } from '@/components/studio/studio-options';
import { audienceFilter, buildSearchQuery, generationConditions, type StudioConditions } from '@/lib/studio-search-query';
import {
  studioPlanFields, studioPlanGroups, type StudioPlan, type StudioPlanField, type StudioPlanFieldKey,
} from '@/lib/studio-plan';

/**
 * 기획서를 항목 구조로 만들고 항목 하나씩 고치는 화면.
 *
 * 기존 문서 편집 화면은 기획서를 한 덩어리 글로 다루어 항목만 고칠 수 없다.
 * 그 화면을 바로 뜯지 않고 여기서 구조를 확인한 뒤 옮긴다.
 */

type SearchResult = { rank: number; sourceId: number; title: string; target: string | null; similarity: number };

function textOfField(plan: StudioPlan, field: StudioPlanField) {
  const value = plan[field.key];
  if (field.kind === 'lines') return (value as string[]).join('\n');
  return String(value ?? '');
}

export default function StudioPlanClient() {
  const [memo, setMemo] = useState('유아가 그림책을 읽고 만들기 활동을 하는 프로그램');
  const [conditions, setConditions] = useState<StudioConditions>({});
  const [plan, setPlan] = useState<StudioPlan | null>(null);
  const [references, setReferences] = useState<SearchResult[]>([]);
  const [markdown, setMarkdown] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  /** 지금 수정 중인 항목과 사서가 적은 지시. 한 번에 하나만 연다. */
  const [editing, setEditing] = useState<StudioPlanFieldKey | null>(null);
  const [instruction, setInstruction] = useState('');

  async function createPlan(event: FormEvent) {
    event.preventDefault();
    if (!memo.trim() || busy) return;
    setBusy('참고 사례를 찾는 중…'); setError(''); setPlan(null); setReferences([]); setMarkdown('');
    try {
      const query = buildSearchQuery(memo, conditions);
      const audience = audienceFilter(conditions);
      const params = new URLSearchParams({ q: query, limit: '5' });
      if (audience) params.set('audience', audience);
      const found = await fetch(`http://localhost:4000/api/program-board/search?${params}`);
      if (!found.ok) throw new Error('참고 사례를 찾지 못했습니다.');
      const search = await found.json() as { results: SearchResult[] };
      setReferences(search.results);

      setBusy('참고 자료를 정리하는 중…');
      const contextParams = new URLSearchParams({ q: query, limit: String(Math.max(search.results.length, 1)) });
      if (audience) contextParams.set('audience', audience);
      const contextResponse = await fetch(`http://localhost:4000/api/program-board/context?${contextParams}`);
      const context = contextResponse.ok ? (await contextResponse.json() as { markdown: string }).markdown : '';
      setMarkdown(context);

      setBusy('기획서를 쓰는 중…');
      const response = await fetch('/api/studio/generate-plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo, conditions: generationConditions(conditions), referencesMarkdown: context }),
      });
      const payload = await response.json() as { plan?: StudioPlan; error?: string };
      if (!response.ok || !payload.plan) throw new Error(payload.error || '기획서를 만들지 못했습니다.');
      setPlan(payload.plan);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '기획서 생성 중 문제가 발생했습니다.');
    } finally { setBusy(''); }
  }

  /** 사서가 직접 적는 항목은 그 자리에서 값을 바꾼다. */
  function editManually(key: StudioPlanFieldKey, value: string) {
    setPlan((current) => (current ? { ...current, [key]: value } : current));
  }

  async function reviseField(field: StudioPlanField) {
    if (!plan || !instruction.trim() || busy) return;
    setBusy(`${field.label}을(를) 고치는 중…`); setError('');
    try {
      const response = await fetch('/api/studio/revise-field', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldKey: field.key, currentValue: plan[field.key], instruction,
          planTitle: plan.title, planTarget: plan.target,
        }),
      });
      const payload = await response.json() as { value?: unknown; error?: string };
      if (!response.ok || payload.value === undefined) throw new Error(payload.error || '항목을 고치지 못했습니다.');
      setPlan({ ...plan, [field.key]: payload.value } as StudioPlan);
      setEditing(null); setInstruction('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '항목 수정 중 문제가 발생했습니다.');
    } finally { setBusy(''); }
  }

  return (
    <main className="studioPlanPage">
      <section className="studioPlanShell">
        <nav className="programSearchBreadcrumb"><Link href="/studio">MOIRA Studio</Link><span>/</span><span>기획서 틀 검증</span></nav>
        <header className="programSearchHeader">
          <p>STUDIO PLAN</p>
          <h1>기획서를 항목으로 만들고 항목만 고칩니다</h1>
          <span>정제한 351건에서 참고 사례를 찾아 기획서를 쓰고, 마음에 들지 않는 항목만 다시 씁니다.</span>
        </header>

        <form className="programSearchForm" onSubmit={createPlan}>
          <label><span>기획 메모</span><textarea value={memo} maxLength={1000} onChange={(event) => setMemo(event.target.value)} /></label>
          <div className="programSearchOptions">
            {studioFields.map((field) => (
              <label key={field.key}>
                <span>{field.label}</span>
                <select
                  value={conditions[field.key]?.[0] ?? ''}
                  onChange={(event) => setConditions((current) => ({
                    ...current,
                    [field.key as StudioConditionKey]: event.target.value ? [event.target.value] : [],
                  }))}
                >
                  <option value="">{field.placeholder}</option>
                  {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            ))}
            <button disabled={Boolean(busy) || !memo.trim()}>{busy || '기획서 만들기'}</button>
          </div>
        </form>

        {error && <p className="programSearchError" role="alert">{error}</p>}

        {references.length > 0 && (
          <details className="studioPlanReferences">
            <summary>참고한 프로그램 {references.length}건</summary>
            <ol>{references.map((item) => (
              <li key={item.sourceId}>
                <Link href={`/programs/attachment-review/${item.sourceId}`}>{item.title}</Link>
                <small>{item.target || '대상 정보 없음'} · 유사도 {item.similarity.toFixed(3)}</small>
              </li>
            ))}</ol>
            {markdown && <><h4>LLM에 전달한 참고 자료</h4><pre>{markdown}</pre></>}
          </details>
        )}

        {plan && (
          <article className="studioPlanSheet">
            {studioPlanGroups.map((group) => (
              <section key={group} className="studioPlanGroup">
                <h2>{group}</h2>
                {studioPlanFields.filter((field) => field.group === group).map((field) => (
                  <div className="studioPlanField" key={field.key}>
                    <div className="studioPlanFieldHead">
                      <h3>{field.label}{field.manualOnly && <em>직접 입력</em>}</h3>
                      {!field.manualOnly && (
                        <button
                          type="button"
                          onClick={() => { setEditing(editing === field.key ? null : field.key); setInstruction(''); }}
                        >
                          {editing === field.key ? '닫기' : '이 항목만 수정'}
                        </button>
                      )}
                    </div>

                    {field.kind === 'sessions' ? (
                      <div className="programTableScroll">
                        <table className="programCurriculumTable">
                          <thead><tr><th>회차</th><th>일자</th><th>활동 내용</th><th>준비물</th><th>비고</th></tr></thead>
                          <tbody>{plan.sessions.map((session) => (
                            <tr key={session.session}>
                              <td>{session.session}</td>
                              <td>{session.date || '-'}</td>
                              <td>{session.activity}</td>
                              <td>{session.materials || '-'}</td>
                              <td>{session.notes || '-'}</td>
                            </tr>
                          ))}</tbody>
                        </table>
                      </div>
                    ) : field.manualOnly ? (
                      <input
                        className="studioPlanManualInput"
                        value={String(plan[field.key] ?? '')}
                        placeholder={`${field.label}을(를) 적어 주세요`}
                        onChange={(event) => editManually(field.key, event.target.value)}
                      />
                    ) : (
                      <p className="studioPlanValue">{textOfField(plan, field) || '내용 없음'}</p>
                    )}

                    {editing === field.key && (
                      <div className="studioPlanRevise">
                        <input
                          value={instruction}
                          placeholder="어떻게 고칠까요? 예: 더 친근하게, 회차를 6회로"
                          onChange={(event) => setInstruction(event.target.value)}
                        />
                        <button type="button" disabled={Boolean(busy) || !instruction.trim()} onClick={() => reviseField(field)}>
                          이 항목만 다시 쓰기
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </article>
        )}
      </section>
    </main>
  );
}
