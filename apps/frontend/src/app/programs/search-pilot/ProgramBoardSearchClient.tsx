'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import type { StudioDraft } from '@/lib/studio-draft';
import { studioFields, type StudioConditionKey } from '@/components/studio/studio-options';
import { audienceFilter, buildSearchQuery, generationConditions, type StudioConditions } from '@/lib/studio-search-query';

type Profile = 'title' | 'title+intro' | 'title+intro+target' | 'title+intro+target+curriculum';
type SearchResult = {
  rank: number; sourceId: number; sourceUrl: string; title: string;
  target: string | null; libraryName: string | null; summary: string; similarity: number;
  rankingScore: number; audienceAdjustment: number; audienceMatch: string;
  conceptAdjustment: number; conceptCoverage: number; matchedConcepts: string[]; missingConcepts: string[];
  detailLevel: 'detailed' | 'partial' | 'basic'; detailReason: string; sessionCount: number; seriesCount: number;
  sourceType: 'text' | 'attachment';
};
type SearchResponse = { query: string; limit: number; model: string; profile: Profile; candidateCount: number; eligibleCount: number; requestedAudience: string | null; requestedAudienceFilter: string | null; filteredOutByAudience: number; reranking: string; results: SearchResult[] };

const examples = [
  '초등 저학년이 환경과 기후를 배우면서 만들기도 하는 수업',
  '아이와 함께 그림책을 읽고 클레이 활동을 하는 프로그램',
  '성인이 한 권의 책을 읽고 이야기를 나누는 독서 모임',
  '어린이가 관람할 수 있는 토끼 인형극',
  '초등 저학년이 직접 만들며 배우는 과학 실험 수업',
  '성인이 영상과 일상 표현으로 배우는 생활 영어',
  '초등 고학년이 친구들과 하는 보드게임 수업',
  '성인이 그림책으로 감정을 이해하는 테라피',
  '초등 저학년을 위한 파닉스 영어 읽기',
];

export default function ProgramBoardSearchClient() {
  const [query, setQuery] = useState(examples[0]);
  // 스튜디오와 같은 조건을 써야 여기서 확인한 결과가 스튜디오에서도 같게 나온다.
  const [conditions, setConditions] = useState<StudioConditions>({});
  const [limit, setLimit] = useState(5);
  const [profile, setProfile] = useState<Profile>('title+intro+target');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [context, setContext] = useState('');
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [generationModel, setGenerationModel] = useState('gemini-3.6-flash');
  const [usedModel, setUsedModel] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true); setError(''); setContext(''); setDraft(null);
    try {
      const params = new URLSearchParams({ q: buildSearchQuery(query, conditions), limit: String(limit), profile });
      const audience = audienceFilter(conditions);
      if (audience) params.set('audience', audience);
      const response = await fetch(`http://localhost:4000/api/program-board/search?${params}`);
      if (!response.ok) throw new Error('검색에 실패했습니다. 백엔드와 임베딩 산출물을 확인해 주세요.');
      setData(await response.json() as SearchResponse);
    } catch (reason) {
      setData(null); setError(reason instanceof Error ? reason.message : '검색 중 오류가 발생했습니다.');
    } finally { setLoading(false); }
  }

  async function createContext() {
    if (!data || contextLoading) return;
    setContextLoading(true); setError(''); setDraft(null);
    try {
      // 화면에 보인 만큼 그대로 넘긴다. 사서가 본 것과 LLM이 받은 것이 다르면
      // 왜 그런 기획안이 나왔는지 설명할 수 없다.
      const params = new URLSearchParams({ q: data.query, limit: String(data.results.length) });
      const audience = audienceFilter(conditions);
      if (audience) params.set('audience', audience);
      const response = await fetch(`http://localhost:4000/api/program-board/context?${params}`);
      if (!response.ok) throw new Error('참고 컨텍스트 생성에 실패했습니다.');
      const payload = await response.json() as { markdown: string };
      setContext(payload.markdown);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '컨텍스트 생성 오류'); }
    finally { setContextLoading(false); }
  }

  async function createDraft() {
    if (!context || draftLoading) return;
    setDraftLoading(true); setError('');
    try {
      const response = await fetch('/api/studio/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query.trim(),
          // 운영 기간처럼 검색에 쓰지 않은 조건도 여기서는 지침으로 넘긴다.
          conditions: generationConditions(conditions),
          agenda: null,
          referencesMarkdown: context,
          model: generationModel,
        }),
      });
      const payload = await response.json() as { draft?: StudioDraft; error?: string; model?: string };
      if (!response.ok || !payload.draft) throw new Error(payload.error || '기획서 생성에 실패했습니다.');
      setDraft(payload.draft);
      setUsedModel(payload.model || generationModel);
    } catch (reason) { setError(reason instanceof Error ? reason.message : '기획서 생성 오류'); }
    finally { setDraftLoading(false); }
  }

  return (
    <main className="programSearchPilotPage">
      <section className="programSearchPilotShell">
        <nav className="programSearchBreadcrumb"><Link href="/programs">프로그램 게시판</Link><span>/</span><span>의미 검색 파일럿</span></nav>
        <header className="programSearchHeader">
          <p>SEMANTIC SEARCH PILOT</p>
          <h1>어떤 프로그램을 찾고 있나요?</h1>
          <span>정제한 351건(검색 대상 300건)에서 유사 사례를 찾아 Markdown으로 만들고 기획서를 생성해 보는 화면입니다.</span>
        </header>
        <form className="programSearchForm" onSubmit={submit}>
          <label><span>자연어 검색</span><textarea value={query} maxLength={1000} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="programSearchOptions">
            {studioFields.map((field) => (
              <label key={field.key}>
                <span>{field.label}{field.key === 'audience' ? ' (후보를 좁힘)' : field.key === 'period' ? ' (생성 지침)' : ''}</span>
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
            <label><span>결과 수</span><select value={limit} onChange={(event) => setLimit(Number(event.target.value))}>{[3, 5, 10, 17].map((value) => <option key={value} value={value}>Top {value}</option>)}</select></label>
            <label><span>검색 프로필</span><select value={profile} onChange={(event) => setProfile(event.target.value as Profile)}><option value="title">제목</option><option value="title+intro">제목 + 소개·목표</option><option value="title+intro+target">제목 + 소개·목표 + 대상</option><option value="title+intro+target+curriculum">+ 회차 내용</option></select></label>
            <button disabled={loading || !query.trim()}>{loading ? '검색 중…' : '유사 프로그램 찾기'}</button>
          </div>
        </form>
        <div className="programSearchExamples">{examples.map((example) => <button type="button" key={example} onClick={() => setQuery(example)}>{example}</button>)}</div>
        {error && <p className="programSearchError" role="alert">{error}</p>}
        {data && <section className="programSearchResults">
          <div className="programSearchResultHeading"><div><h2>검색 결과</h2><p>{data.candidateCount}개 후보 중 최소 기준 통과 {data.eligibleCount}개 · {data.model} · {data.profile}{data.requestedAudience ? ` · 대상: ${data.requestedAudience}` : ''}{data.filteredOutByAudience ? ` · 대상 필터로 ${data.filteredOutByAudience}건 제외` : ''}</p></div><span>적합한 결과가 부족하면 선택한 Top N보다 적게 표시합니다.</span></div>
          <div>{data.results.map((result) => <article className="programSearchResultCard" key={result.sourceId}>
            <strong className="programSearchRank">{result.rank}</strong>
            <div className="programSearchResultBody"><div className="programSearchResultTitle"><h3><Link href={result.sourceType === 'attachment' ? `/programs/attachment-review/${result.sourceId}` : `/programs/${result.sourceId}`}>{result.title}</Link></h3><b>의미 유사도 {result.similarity.toFixed(3)} <small>({(result.similarity * 100).toFixed(1)}%)</small></b></div>
              <p className="programSearchMeta">{result.target || '대상 정보 없음'} · {result.libraryName || '운영 도서관 정보 없음'}</p>
              <p className={`programSearchAudienceMatch ${result.audienceAdjustment < 0 ? 'isMismatch' : ''}`}>{result.audienceMatch}{result.audienceAdjustment !== 0 ? ` · 재정렬 ${result.audienceAdjustment > 0 ? '+' : ''}${result.audienceAdjustment.toFixed(2)}` : ''}</p>
              <p className="programSearchConceptMatch">개념 충족률 {(result.conceptCoverage * 100).toFixed(0)}% · 일치 {result.matchedConcepts.join(', ') || '없음'}{result.missingConcepts.length ? ` · 미일치 ${result.missingConcepts.join(', ')}` : ''}</p>
              <p className={`programSearchDetail is-${result.detailLevel}`}>상세도 {result.detailLevel} · {result.detailReason}{result.sessionCount ? ` · ${result.sessionCount}회차` : ''}{result.seriesCount > 1 ? ` · 같은 시리즈 ${result.seriesCount}건` : ''}</p>
              <p>{result.summary || '프로그램 소개·목표 정보 없음'}</p>
            </div>
          </article>)}</div>
          {data.results.length > 0 && <div className="programSearchPipelineActions"><button type="button" onClick={createContext} disabled={contextLoading}>{contextLoading ? '압축 중…' : 'Top 결과로 Markdown 만들기'}</button>{context && <><label><span>생성 모델</span><select value={generationModel} onChange={(event) => setGenerationModel(event.target.value)}><option value="gemini-3.6-flash">Gemini 3.6 Flash</option><option value="gemini-3.5-flash-lite">Gemini 3.5 Flash Lite</option><option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option></select></label><button type="button" onClick={createDraft} disabled={draftLoading}>{draftLoading ? 'Gemini 생성 중…' : 'LLM 기획서 생성 실험'}</button></>}</div>}
          {context && <section className="programSearchContext"><h2>LLM 전달용 Markdown</h2><pre>{context}</pre></section>}
          {draft && <section className="programSearchDraft"><p>생성 모델: {usedModel}</p><h2>{draft.title}</h2><pre>{draft.content}</pre></section>}
        </section>}
      </section>
    </main>
  );
}
