'use client';

import { FormEvent, useState } from 'react';

type ChunkResult = { rank: number; programTitle: string; similarity: number; chunkType: string; programCaseId: string };
type ProfileResult = { rank: number; title: string; similarity: number; programCaseId: string; topics: string[]; targetAgeGroups: string[]; activityTypes: string[]; operationTypes: string[]; sessionCount: number; representativeDocument: string };
type Response = { chunkResults?: ChunkResult[]; profileResults?: ProfileResult[] };

const examples = ['초등학생 환경 실험 프로그램', '유아 그림책 활동', '어르신 건강 프로그램'];

export default function SemanticSearchTestPage() {
  const [query, setQuery] = useState(examples[0]);
  const [data, setData] = useState<Response>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim() || loading) return;
    setLoading(true); setError(''); setSearched(false);
    try {
      const response = await fetch(`http://localhost:4000/api/program-case/search-profile-pilot?q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) throw new Error('검색 요청에 실패했습니다.');
      setData(await response.json() as Response); setSearched(true);
    } catch (reason) {
      setData({}); setError(reason instanceof Error ? reason.message : '검색 오류가 발생했습니다.');
    } finally { setLoading(false); }
  }

  return (
    <main style={{ maxWidth: 1180, margin: '40px auto', padding: 16 }}>
      <h1>ProgramCase SearchProfile 파일럿 비교</h1>
      <p>기존 Chunk P0는 349개 프로그램의 888개 Chunk, SearchProfile은 대표 30개 프로그램만 검색합니다.</p>
      <form onSubmit={search} style={{ display: 'flex', gap: 8, margin: '24px 0' }}>
        <input aria-label="검색어" value={query} onChange={(event) => setQuery(event.target.value)} style={{ flex: 1, padding: 10 }} />
        <button type="submit" disabled={loading || !query.trim()} style={{ padding: '10px 16px' }}>{loading ? '검색 중…' : '검색'}</button>
      </form>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>{examples.map((example) => <button key={example} type="button" onClick={() => setQuery(example)}>{example}</button>)}</div>
      {error && <p role="alert">{error}</p>}
      {searched && !(data.chunkResults?.length || data.profileResults?.length) && <p>검색 결과가 없습니다.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 24 }}>
        <section><h2>기존 Chunk P0 Top 5</h2>{data.chunkResults?.map((item) => <article key={item.programCaseId} style={card}><strong>{item.rank}. {item.programTitle}</strong><p>유사도 {item.similarity.toFixed(3)} · {item.chunkType}</p></article>)}</section>
        <section><h2>SearchProfile Pilot Top 5</h2>{data.profileResults?.map((item) => <article key={item.programCaseId} style={card}><strong>{item.rank}. {item.title}</strong><p>유사도 {item.similarity.toFixed(3)}</p><p>대상 {item.targetAgeGroups.join(', ')} · 주제 {item.topics.join(', ')}</p><p>활동 {item.activityTypes.join(', ')} · 운영 {item.operationTypes.join(', ')} · {item.sessionCount}회</p><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{item.representativeDocument}</pre></article>)}</section>
      </div>
    </main>
  );
}

const card = { border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 12, background: '#fff' };
