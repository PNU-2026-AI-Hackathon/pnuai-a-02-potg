const placeholderPosts = [
  {
    category: "공지",
    title: "게시판 기능 준비 중입니다",
    summary: "추후 실제 게시글 목록과 상세 화면이 연결될 예정입니다.",
    meta: "관리자 · 2026.06.26",
  },
  {
    category: "소식",
    title: "모이라 커뮤니티 소식 placeholder",
    summary: "도서관 프로그램, 지역 의제, 봉사 연계 소식을 이 영역에서 확인합니다.",
    meta: "모이라팀 · 준비 중",
  },
  {
    category: "제안",
    title: "주민 제안 게시글 placeholder",
    summary: "검색과 필터 기능은 아직 동작하지 않으며 UI 구조만 표시합니다.",
    meta: "사용자 · 준비 중",
  },
];

const filters = ["전체", "공지", "소식", "제안"];

export default function BoardPage() {
  return (
    <main className="boardPage">
      <section className="boardShell" aria-labelledby="board-title">
        <div className="boardHeader">
          <div>
            <p className="boardEyebrow">Moira Board</p>
            <h1 id="board-title">게시판</h1>
            <p>
              모이라의 공지, 지역 소식, 주민 제안 게시글을 모아보는 게시판 화면입니다.
              현재는 화면 구조 확인을 위한 정적 placeholder만 제공합니다.
            </p>
          </div>
          <button className="boardWriteButton" type="button" disabled>
            글쓰기
          </button>
        </div>

        <section className="boardToolbar" aria-label="게시판 검색 및 필터 placeholder">
          <label className="boardSearch" htmlFor="board-search">
            <span>검색</span>
            <input
              id="board-search"
              type="search"
              placeholder="제목, 내용, 작성자 검색"
              disabled
            />
          </label>

          <div className="boardFilters" aria-label="게시판 분류 필터 placeholder">
            {filters.map((filter) => (
              <button
                className={filter === "전체" ? "active" : undefined}
                key={filter}
                type="button"
                disabled
              >
                {filter}
              </button>
            ))}
          </div>
        </section>

        <section className="boardList" aria-label="게시글 목록 placeholder">
          <div className="boardListHeader">
            <span>분류</span>
            <span>제목</span>
            <span>작성 정보</span>
          </div>

          {placeholderPosts.map((post) => (
            <article className="boardRow" key={post.title}>
              <span className="boardCategory">{post.category}</span>
              <div className="boardPostText">
                <h2>{post.title}</h2>
                <p>{post.summary}</p>
              </div>
              <span className="boardMeta">{post.meta}</span>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
