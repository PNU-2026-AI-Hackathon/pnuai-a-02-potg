'use client';

import { FormEvent, useState } from 'react';

type SearchResult = {
  rank: number;
  programTitle: string;
  similarity: number;
  chunkType: string;
  programCaseId: string;
};

export default function SemanticSearchTestPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState(false);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(false);
    setSearched(false);
    try {
      const response = await fetch(
        `http://localhost:4000/api/program-case/semantic-search?q=${encodeURIComponent(query.trim())}&limit=5`,
      );
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json() as { results?: SearchResult[] };
      setResults((data.results ?? []).slice(0, 5));
      setSearched(true);
    } catch {
      setResults([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', padding: 16 }}>
      <h1>ProgramCase Semantic Search Test</h1>
      <form onSubmit={search} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="예: 유아와 부모가 함께하는 그림책 활동"
          style={{ flex: 1, padding: 10 }}
        />
        <button type="submit" disabled={loading || !query.trim()} style={{ padding: '10px 16px' }}>
          검색
        </button>
      </form>

      {loading && <p>Searching...</p>}
      {error && <p>검색 중 오류가 발생했습니다.</p>}
      {!loading && !error && searched && results.length === 0 && <p>검색 결과가 없습니다.</p>}

      {!loading && !error && results.map((result) => (
        <article
          key={result.programCaseId}
          style={{ border: '1px solid #ddd', padding: 16, marginBottom: 12, background: '#fff' }}
        >
          <strong>{result.rank}. {result.programTitle}</strong>
          <p>Similarity: {result.similarity.toFixed(3)}</p>
          <p>Chunk Type: {result.chunkType}</p>
          <p>ProgramCase ID: {result.programCaseId}</p>
        </article>
      ))}
    </main>
  );
}
