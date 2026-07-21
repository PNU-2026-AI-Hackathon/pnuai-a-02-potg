'use client';

import { useMemo, useState } from 'react';
import SectionHeading from './SectionHeading';
import { libraries } from './home-data';

export default function LibraryFinderSection() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');

  const results = useMemo(() => {
    const keyword = submittedQuery.trim().toLocaleLowerCase('ko');
    if (!keyword) return libraries;
    return libraries.filter((library) =>
      `${library.name} ${library.district} ${library.address}`
        .toLocaleLowerCase('ko')
        .includes(keyword),
    );
  }, [submittedQuery]);

  return (
    <section className="homeSection libraryFinderSection" id="library-finder">
      <div className="uiContainer libraryFinderGrid">
        <div>
          <SectionHeading
            eyebrow="LIBRARY NEAR YOU"
            title="우리 동네 작은도서관 찾기"
            description="지역 또는 도서관 이름으로 가까운 작은도서관과 대표 프로그램을 찾아보세요."
          />
          <form
            className="librarySearch"
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedQuery(query);
            }}
          >
            <label htmlFor="library-search">지역 또는 도서관명</label>
            <div>
              <input
                id="library-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="예: 금정구, 금샘마을"
              />
              <button className="uiButton uiButtonPrimary" type="submit">
                도서관 찾기
              </button>
            </div>
          </form>
        </div>
        <div className="libraryResults" aria-live="polite">
          {results.length ? (
            results.map((library) => (
              <article key={library.id}>
                <span className="libraryPin" aria-hidden="true">⌖</span>
                <div>
                  <span>{library.district}</span>
                  <h3>{library.name}</h3>
                  <p>{library.address}</p>
                  <strong>{library.feature}</strong>
                </div>
              </article>
            ))
          ) : (
            <p className="libraryEmpty">일치하는 도서관이 없습니다. 다른 검색어를 입력해 주세요.</p>
          )}
        </div>
      </div>
    </section>
  );
}
