# Moira 디자인 시스템 (코드 기반)

목적: 메인페이지와 관련 컴포넌트/스타일을 기준으로 팀과 AI 코딩 에이전트가 일관된 UI 언어를 따르도록 재사용 가능한 규칙을 정리합니다. 실제 코드에서 확인 가능한 값만 우선 사용하고, 확인 불가 항목은 '권장' 또는 '미정'으로 표기합니다.

참조된 구현 파일
- [apps/frontend/src/app/globals.css](apps/frontend/src/app/globals.css)
- [apps/frontend/src/app/page.tsx](apps/frontend/src/app/page.tsx)
- [apps/frontend/src/app/layout.tsx](apps/frontend/src/app/layout.tsx)
- [apps/frontend/src/components/layout/SiteHeader.tsx](apps/frontend/src/components/layout/SiteHeader.tsx)
- [apps/frontend/src/components/home/HeroSection.tsx](apps/frontend/src/components/home/HeroSection.tsx)
- [apps/frontend/src/components/home/StudioSection.tsx](apps/frontend/src/components/home/StudioSection.tsx)
- [apps/frontend/src/components/home/PopularAgendaSection.tsx](apps/frontend/src/components/home/PopularAgendaSection.tsx)
- [apps/frontend/src/components/home/ProgramSurveySection.tsx](apps/frontend/src/components/home/ProgramSurveySection.tsx)
- [apps/frontend/src/components/home/ProgramSurveyModal.tsx](apps/frontend/src/components/home/ProgramSurveyModal.tsx)
- [apps/frontend/src/components/home/SectionHeading.tsx](apps/frontend/src/components/home/SectionHeading.tsx)
- [apps/frontend/src/components/home/HomeExperience.tsx](apps/frontend/src/components/home/HomeExperience.tsx)
- [apps/frontend/src/components/auth/LoginForm.tsx](apps/frontend/src/components/auth/LoginForm.tsx)

---

**디자인 목표와 전체 분위기**
- 주민 중심의 따뜻하고 신뢰감 있는 커뮤니티 플랫폼. 여백과 라운드, 은은한 그린 계열 브랜드 컬러로 안정감을 준다. (근거: 전역 토큰과 컴포넌트 스타일 — globals.css)

**브랜드 표현**
- 워드마크: Google `Do_Hyeon` 폰트를 워드마크에 사용 (`apps/frontend/src/app/layout.tsx`).
- 브랜드 색상: `--moira-green`, `--moira-green-dark`, `--moira-ink` 등으로 정의되어 있으며 강조와 상태에 사용됨. (globals.css)

**색상과 CSS 변수**
- globals.css에 선언된 토큰(일부):
  - 컬러: `--moira-green: #16745f`, `--moira-green-dark: #0f5848`, `--moira-ink: #18352f`, `--moira-mint: #dff3e9`, `--moira-cream: #f7f3e9`, `--moira-warm: #f1a85b`
  - 보조: `--blue: #2b5f9e`, `--deep: #1f3f69`, `--line: #d9dde3`, `--bg: #f5f6f8`, `--text: #222`, `--muted: #666`
  - 반경: `--moira-radius-sm: 12px`, `--moira-radius-md: 20px`, `--moira-radius-lg: 32px`
  - 섀도우: `--moira-shadow: 0 18px 48px rgba(33, 70, 61, 0.1)`

사용 규칙 요약:
- 주요 CTA: `--moira-green` 계열 (`.uiButtonPrimary`).
- 보조/링크: `--blue` 계열 또는 `.uiTextLink` 스타일.
- 경계선/비활성: `--line` 또는 `#cfd8e3` (입력, 카드 경계).

**타이포그래피**
- 본문 폰트 스택: `Arial, "Noto Sans KR", sans-serif` (globals.css).
- 워드마크: `Do_Hyeon` 변수를 통해 적용 (`apps/frontend/src/app/layout.tsx`).
- 크기 예시(코드에서 확인 가능한 값):
  - 눈썹 텍스트(`.uiEyebrow`): 13px, weight 800
  - 버튼(`.uiButton`): 14px, weight 800
  - 주요 타이틀 예시(`.loginTitle`, `.signupTitle`): 30px

**페이지 최대 너비와 레이아웃**
- `.uiContainer`: `width: min(1180px, calc(100% - 48px)); margin-inline: auto;` — 모든 섹션의 기본 컨테이너로 사용됨 (globals.css).
- 페이지 구조: `.moiraPage` -> `SiteHeader`(sticky, 높이 `--site-header-height: 88px`) -> `main`(여러 `section.homeSection`) -> `footer`.
- 각 섹션은 전체 화면 섹션으로 최소 높이를 가지며, `HomeExperience`의 스크롤/섹션 전환 로직이 적용됨 (`apps/frontend/src/components/home/HomeExperience.tsx`).

**간격과 여백**
- 좌우 마진/패딩: `calc(100% - 48px)` 설계를 통해 좌우 각 24px 이상 확보.
- 카드/셸 패딩: 로그인 카드 `.loginCard` 32px, 회원가입 카드 `.signupCard` 36px 등 (globals.css).
- 공통 간격 단위로 8/10/12/16/24 등의 값이 반복 사용됨. 구체 값은 컴포넌트별로 확인.

**테두리와 둥근 정도**
- 카드: 12px~20px 범위 사용 (`--moira-radius-sm/md`).
- 버튼: 기본으로 pill 모양(`border-radius: 999px`) 사용 (`.uiButton`).

**그림자**
- 카드·모달 등에 권장되는 토큰: `--moira-shadow` (globals.css).

**버튼**
- 공통: `.uiButton` (min-height 48px, padding 0 22px, font-weight 800). 변형으로 `.uiButtonPrimary`, `.uiButtonSecondary`, `.uiButtonLight` 존재.
- 인터랙션: hover/ focus-visible 시 `transform: translateY(-2px)` 및 색상 변화. 포커스 스타일로 `outline: 3px solid rgba(241,168,91,0.55)` 사용.

**카드**
- 카드 패턴은 테두리(1px), 반경(12~20px), 배경(대개 #fff 또는 연한 배경), 패딩, 약한 섀도우 조합으로 구현됨. 예: `.loginCard`, `.signupCard`, `.surveyCard`.

**헤더와 내비게이션**
- `SiteHeader`는 `position: sticky`와 `backdrop-filter: blur(14px)`로 상단 고정된 반투명 헤더를 사용. 높이 토큰: `--site-header-height: 88px`.
- 네비게이션 활성화 상태는 `isActive` 클래스로 표현.

**입력 폼**
- 입력 기본: border `1px solid #cfd8e3`, border-radius `12px`, padding `14px 16px`, placeholder `#94a3b8`.
- 포커스: `border-color: var(--blue)` + `box-shadow: 0 0 0 4px rgba(43,95,158,0.12)`.
- 유효성 표시: invalid 상태에서 `border-color: #dc2626`.

**배지와 상태 표시**
- `.uiTag` 계열로 배지 스타일을 통일 (기본, accent, planning, recruiting 변형 존재).

**아이콘**
- 아이콘은 SVG 또는 텍스트 기호(예: `✦`, `→`)로 사용하며, 의미 없는 장식용 아이콘은 `aria-hidden="true"` 처리됨(컴포넌트 참조: Hero, Studio 등).

**반응형 규칙**
- 레이아웃 컨테이너는 `min(1180px, calc(100% - 48px))`로 반응. 데스크탑 인터랙션을 결정하는 JS 브레이크포인트는 `(min-width: 981px)` (`HomeExperience`의 `desktopMedia`).

**상호작용 및 애니메이션**
- 버튼 hover: translateY(-2px). 입력 focus: 0 0 0 4px 라이트 링. 섹션 reveal/스크롤 전환 로직은 `HomeExperience`에서 구현되어 있음(감속, 스크롤 록 등).

**접근성 규칙**
- 포커스 표시: `:focus-visible`용 명확한 outline 적용 (globals.css).
- 모달: `role="dialog"`, `aria-modal="true"`, 포커스 트랩 및 `Escape`로 닫기 처리(ProgramSurveyModal에서 구현). 폼 에러는 `role="alert"`/`aria-live` 활용.

**페이지별 공통 구조**
- 모든 주요 페이지는 `.uiContainer` 내부에서 콘텐츠를 렌더링하고, `SiteHeader`와 공통 footer를 가짐. 메인 페이지는 여러 `section`으로 분리하여 각 섹션이 독립적인 레이아웃과 상태(예: `homeSection`, `studioSection`)를 가짐.

**Do / Don't**
- Do: 버튼/배지/태그 등 공용 클래스(`.uiButton`, `.uiTag`, `.uiTextLink`)를 재사용하세요.
- Don't: 색상/반경/섀도우를 개별 컴포넌트에서 하드코딩하지 마세요 — globals.css의 토큰을 사용하세요.

**미구현 컴포넌트 규칙(권장/미정)**
- 권장: 디자인 시스템을 확장할 때 Tailwind를 도입한다면 토큰을 CSS 변수로 맵핑해 Tailwind 변수로 노출할 것(현재 코드는 CSS 변수 기반).
- 미정: 디자인 아이콘 세트(아이콘 폰트 또는 SVG 스프라이트) 통합 방식 — 현재는 개별 SVG/문자 심볼 혼용.

**새 UI 작업 시 체크리스트**
- [ ] 사용 가능한 전역 토큰(`globals.css`)을 먼저 확인했는가?
- [ ] `.uiContainer` 및 `ui` 접두사 클래스 재사용했는가?
- [ ] 새로운 버튼/배지는 기존 `.uiButton`/`.uiTag` 변형으로 추가했는가?
- [ ] 폼 입력의 포커스와 에러 스타일은 전역 규칙을 따르는가?
- [ ] 접근성: 포커스, aria 속성, 모달 트랩을 구현했는가?

---

참고: `AGENTS.md` 파일을 루트에서 찾았으나 존재하지 않아(`AGENTS.md` 없음), 해당 문서에 `DESIGN.md` 참조를 추가하지 않았습니다. (검사: 저장소 루트에 AGENTS.md 없음)

변경 요약
- 프로젝트 루트에 `DESIGN.md` 추가(이 파일). AGENTS.md는 존재하지 않아 수정 없음.

문서 작성자: 코드 기반 추출 (globals.css, 주요 컴포넌트). 추가 규칙 적용을 원하면 특정 컴포넌트/페이지를 지목해 주세요.
