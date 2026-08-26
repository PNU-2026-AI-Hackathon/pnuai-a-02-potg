# 기능별 구현 흐름

README [3.3. 기능명세서](../../README.md#33-기능명세서)의 각 기능이 **어떤 이슈에서 출발해, 어떤 순서의 PR을 거쳐 지금 모습이 됐는지**를 기록한 문서입니다.

기능명세서는 완성된 결과만 한 줄로 보여줍니다. 그 한 줄에 닿기까지 먼저 무엇을 세웠고, 무엇을 되돌렸고, 무엇을 걷어냈는지는 거기 드러나지 않습니다. 이 문서는 그 과정을 단계로 나눠 담았습니다.

- 각 기능은 **시간순 단계**로 묶여 있고, 단계 안의 PR도 머지일 순서입니다.
- 대상: 이슈 107건, PR 108건 (사용법 연습·테스트용 이슈 3건, PR 4건 제외)
- 이슈는 PR 본문의 참조를 기준으로 연결했고, 참조가 없는 PR은 제목과 작업 내용을 보고 직접 이었습니다.
- 하나의 PR이 두 기능에 걸치면 양쪽에 모두 표시했습니다.

## 한눈에 보기

| ID | 구분 | 기능 | 권한 | 단계 | PR | 이슈 | 기간 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [F01](#f01-계정-관리) | 회원 | 계정 관리 | 공통 | 4 | 16건 | 18건 | 2026-05-23 ~ 2026-08-19 |
| [F02](#f02-서비스-진입) | 홈 | 서비스 진입 | 공통 | 4 | 12건 | 10건 | 2026-05-22 ~ 2026-08-26 |
| [F03](#f03-도서관-찾기) | 도서관 | 도서관 찾기 | 공통 | 1 | 1건 | 1건 | 2026-08-21 |
| [F04](#f04-프로그램-탐색) | 프로그램 | 프로그램 탐색 | 공통 | 3 | 5건 | 4건 | 2026-08-12 ~ 2026-08-17 |
| [F05](#f05-일정관심-관리) | 프로그램 | 일정·관심 관리 | 로그인 | 2 | 2건 | 2건 | 2026-08-20 |
| [F06](#f06-주민-아이디어) | 커뮤니티 | 주민 아이디어 | 공통 | 5 | 17건 | 13건 | 2026-06-26 ~ 2026-08-22 |
| [F07](#f07-도서관-소식) | 커뮤니티 | 도서관 소식 | 공통 | 1 | 1건 | 1건 | 2026-08-17 |
| [F08](#f08-기획안-생성) | MOIRA STUDIO | 기획안 생성 | 사서 | 6 | 11건 | 12건 | 2026-07-21 ~ 2026-08-26 |
| [F09](#f09-기획안-편집) | MOIRA STUDIO | 기획안 편집 | 사서 | 4 | 12건 | 13건 | 2026-08-07 ~ 2026-08-18 |
| [F10](#f10-참여와-집계) | 수요조사 | 참여와 집계 | 공통/사서 | 2 | 3건 | 2건 | 2026-08-17 ~ 2026-08-18 |
| [F11](#f11-내-활동-관리) | 마이페이지 | 내 활동 관리 | 로그인 | 2 | 5건 | 5건 | 2026-07-21 ~ 2026-08-24 |
| [B01](#b01-프로그램-사례-데이터ai-검색-파이프라인) | 공통 기반 | 프로그램 사례 데이터·AI 검색 파이프라인 | — | 5 | 18건 | 21건 | 2026-07-18 ~ 2026-08-08 |
| [B02](#b02-프로젝트-기반배포디자인-시스템) | 공통 기반 | 프로젝트 기반·배포·디자인 시스템 | — | — | 7건 | 7건 | 2026-05-22 ~ 2026-08-25 |

<br>

---

## 기능명세서 항목별 구현 흐름

### F01. 계정 관리

> **구분** 회원 · **주요 내용** 회원가입, 로그인, 관심분야 설정 · **권한** 공통
> 
> **기간** 2026-05-23 ~ 2026-08-19 · **PR** 16건

로그인 API를 먼저 세우고, 회원가입에 관심분야를 붙이다 한 번 되돌린 뒤 DB 모델을 다시 잡았습니다. 이후 세션과 역할 권한을 넣고, 마지막에 화면과 입력 검증을 손봤습니다.

**1단계 · 로그인 기반 세우기**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-05-23 | [#11](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/11) | feat(backend): 로그인 인증 API 및 JWT 발급 기능 구현 | [#10](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/10) | 머지 |
| 2026-05-24 | [#14](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/14) | feat(login): 로그인 UI와 백엔드 로그인 API 연동 | [#13](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/13) | 머지 |
| 2026-06-24 | [#24](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/24) | feat: 홈 화면 로그인 버튼에 로그인 페이지 이동 기능 추가 | [#23](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/23) | 머지 |
| 2026-06-25 | [#26](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/26) | feat(auth): RDS PostgreSQL 기반 사용자 인증 구현 | [#25](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/25) | 머지 |

**2단계 · 회원가입과 관심분야 (되돌리고 다시 설계)**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-07-01 | [#40](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/40) | feat(fe): 회원가입 페이지 기본 UI 구현 | [#29](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/29) | 머지 |
| 2026-07-04 | [#41](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/41) | feat(fe): 회원가입 및 관심분야 선택 통합 UI 스켈레톤 구현 | [#32](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/32) | 머지 |
| 2026-07-07 | [#43](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/43) | feat: 통합 회원가입 및 관심분야 DB 연동 | [#31](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/31) | 머지 |
| 2026-07-08 | [#44](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/44) | Revert "feat: 통합 회원가입 및 관심분야 DB 연동" | — | 닫힘 |
| 2026-07-11 | [#45](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/45) | feat(be): 관심분야 DB 모델 및 Prisma 마이그레이션 구현 | [#34](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/34), [#35](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/35) | 머지 |
| 2026-07-11 | [#50](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/50) | feat(be, fe): 관심분야 조회 및 사용자 관심분야 저장 기능 구현 | [#35](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/35) | 머지 |

**3단계 · 세션 유지와 역할 권한**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-07-07 | [#42](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/42) | feat(auth): 로그인 세션 유지 및 로그아웃 구현 | [#36](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/36) | 머지 |
| 2026-07-18 | [#51](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/51) | feat(be): JWT 인증 및 역할 기반 인가 미들웨어 구현 | [#37](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/37) | 머지 |

**4단계 · 화면 정리와 입력 검증 수정**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-07 | [#130](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/130) | feat(fe): 로그인 및 회원가입 화면에 디자인 시스템 적용 | [#129](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/129) | 머지 |
| 2026-08-17 | [#168](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/168) | feat(fe):login_page_design_impreovement | [#167](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/167) | 머지 |
| 2026-08-17 | [#179](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/179) | fix(fe):improve_signup_step_wording | [#178](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/178) | 머지 |
| 2026-08-19 | [#205](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/205) | fix: 회원가입 한글 아이디 및 로그인 이메일 정규화 수정 | [#204](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/204) | 머지 |

PR 없이 이슈로만 남은 항목

| 이슈 | 제목 | 상태 |
| --- | --- | --- |
| [#4](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/4) | feat(frontend): 로그인 페이지 UI 및 입력 폼 구현 | 닫힘 |
| [#5](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/5) | docs: 로그인 기능 API 명세서 및 DB 구조 설계 | 닫힘 |
| [#33](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/33) | feat(fe) : 회원가입 후 관심분야 선택 페이지로 이동 연결 | 닫힘 |

<br>

### F02. 서비스 진입

> **구분** 홈 · **주요 내용** 서비스 흐름 안내와 주요 화면 연결 · **권한** 공통
> 
> **기간** 2026-05-22 ~ 2026-08-26 · **PR** 12건

첫 화면 골격에서 출발해 메뉴와 소개 페이지를 붙이고, 마지막에 더미 콘텐츠를 실제 게시판 데이터로 교체하면서 기기별 화면까지 맞췄습니다.

**1단계 · 첫 화면 골격**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-05-22 | [#7](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/7) | feat(frontend): 홈 화면 스켈레톤 UI 구현 | [#6](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/6) | 머지 |
| 2026-05-23 | [#12](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/12) | feat(frontend): 홈 화면 스켈레톤 UI 구현 | [#6](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/6), [#9](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/9) | 머지 |

**2단계 · 메뉴와 소개 페이지 붙이기**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-07-18 | [#59](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/59) | Feat/메인페이지 메뉴바 및 UI 수정 | [#53](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/53) | 머지 |
| 2026-08-05 | [#111](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/111) | feat(fe): 모이라 소개 페이지 UI 구현 | [#80](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/80) | 머지 |
| 2026-08-10 | [#142](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/142) | feat(fe): 메인페이지 섹션 내비게이션 및 스크롤 이동 개선 | [#141](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/141) | 머지 |

**3단계 · 소개 흐름 다듬기**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-17 | [#161](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/161) | feat(fe): 소개페이지 UI/UX 및 반응형 디자인 개선 | [#160](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/160) | 머지 |
| 2026-08-17 | [#164](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/164) | feat(fe): MOIRA Studio 소개페이지 및 접근 권한 안내 구현 | [#163](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/163) | 머지 |
| 2026-08-17 | [#183](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/183) | fix: 소개 페이지 카드 hover 애니메이션 복구 | [#134](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/134) | 머지 |
| 2026-08-26 | [#220](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/220) | fix: 소개 페이지의 미구현 기능 문구 및 서비스 흐름 수정 | — | 머지 |

**4단계 · 실데이터 연결과 화면 대응**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-22 | [#214](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/214) | feat(fe): 전체 페이지 모바일 반응형 UI 개선 | [#212](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/212) | 머지 |
| 2026-08-24 | [#217](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/217) | feat: 메인 페이지를 실제 게시판 데이터와 연결 | — | 머지 |
| 2026-08-24 | [#218](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/218) | feat(fe): 노트북 환경 기준 홈페이지 UI 개선 | [#215](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/215) | 머지 |

<br>

### F03. 도서관 찾기

> **구분** 도서관 · **주요 내용** 도서관 검색, 위치·유형, 최근 프로그램 확인 · **권한** 공통
> 
> **기간** 2026-08-21 · **PR** 1건

이미 쌓아둔 프로그램 데이터에 도서관 위치를 얹는 형태여서, 지도 검색 화면 하나로 마무리됐습니다.

**1단계 · 지도 검색 화면**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-21 | [#211](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/211) | feat : 우리 동네 작은도서관 지도 검색 기능 추가 | [#210](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/210) | 머지 |

<br>

### F04. 프로그램 탐색

> **구분** 프로그램 · **주요 내용** 목록, 검색, 필터, 상세 정보, 원본 신청 링크 · **권한** 공통
> 
> **기간** 2026-08-12 ~ 2026-08-17 · **PR** 5건

크롤링 원본을 바로 쓰지 않고 17건 -> 대표 20건 검수 -> 351건 순으로 정제 규칙을 넓혀가며 검증한 뒤 게시판에 올렸고, 마지막에 JSON 파일에서 DB/API로 옮겼습니다. 원천 데이터는 B01에서 만듭니다.

**1단계 · 정제 규칙 세우고 좁게 검증**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-12 | [#143](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/143) | feat : 프로그램 게시판용 크롤링 데이터 정제하기 - 텍스트 17건 우선 | [#140](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/140) | 머지 |
| 2026-08-14 | [#145](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/145) | feat: 프로그램 게시판 첨부 정제 규칙 및 대표 20건 검수 UI | [#144](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/144) | 머지 |

**2단계 · 전체 351건으로 넓히기**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-16 | [#166](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/166) | feat: 전체 351건 프로그램 첨부 정제 파이프라인 적용 및 검수 분류 | [#146](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/146) | 머지 |
| 2026-08-17 | [#182](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/182) | feat : 프로그램 게시판을 정제한 데이터로 완성하기 | [#177](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/177) | 머지 |

**3단계 · 파일에서 DB/API 구조로 이전**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-17 | [#188](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/188) | feat: 프로그램 게시판을 DB·API로 옮기고, 분리 배포에서 끊기던 곳을 막음 | — | 머지 |

<br>

### F05. 일정·관심 관리

> **구분** 프로그램 · **주요 내용** 캘린더 확인, 관심 프로그램 저장·해제 · **권한** 로그인
> 
> **기간** 2026-08-20 · **PR** 2건

게시판이 실제 데이터로 완성된 뒤, 같은 데이터를 날짜 축으로 다시 보여주고 계정에 묶는 순서로 붙였습니다.

**1단계 · 날짜 축으로 다시 보기**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-20 | [#208](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/208) | feat : 프로그램 게시판 캘린더 화면 추가 | [#206](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/206) | 머지 |

**2단계 · 계정에 묶기**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-20 | [#209](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/209) | feat: 관심 프로그램 등록 및 마이페이지 목록 기능 추가 | [#207](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/207) | 머지 |

<br>

### F06. 주민 아이디어

> **구분** 커뮤니티 · **주요 내용** 아이디어 작성, 댓글, 공감, STUDIO 연계 · **권한** 공통
> 
> **기간** 2026-06-26 ~ 2026-08-22 · **PR** 17건

게시판 3종을 만들어보고 DB를 붙인 뒤, 실제로 쓰이는 아이디어 게시판 하나로 범위를 좁혔습니다. 자유게시판·동네 광장·지역 제안은 이 과정에서 걷어냈고, 마지막에 MOIRA STUDIO와 이었습니다.

**1단계 · 게시판 골격 만들기**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-06-26 | [#27](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/27) | feat: 게시판 스켈레톤 추가 | [#15](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/15) | 머지 |
| 2026-06-29 | [#30](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/30) | feat: free-board-feature 기능구현 | [#28](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/28) | 머지 |
| 2026-07-11 | [#48](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/48) | feat(fe): 지역 커뮤니티 게시판 3종 독립 페이지 스켈레톤 구현 | [#46](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/46) | 머지 |

**2단계 · DB 연동과 글·댓글 기능**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-07-19 | [#62](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/62) | feat(be): 커뮤니티 게시판 DB 연동 구현 | [#61](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/61) | 머지 |
| 2026-08-04 | [#82](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/82) | feat(fe): 게시글 작성 기능 추가 | [#81](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/81) | 머지 |
| 2026-08-06 | [#118](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/118) | feat(be): 아이디어 게시판 DB 및 댓글 API 연동 | [#115](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/115) | 머지 |
| 2026-08-10 | [#135](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/135) | feat(fe): 게시글 상세 페이지 및 상호작용 기능 구현 | [#133](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/133) | 머지 |

**3단계 · 범위 좁히기 (게시판 3종 -> 아이디어 게시판)**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-04 | [#96](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/96) | feat(fe): 아이디어 게시판 UI 컨셉 시도안 | [#95](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/95) | 머지 |
| 2026-08-07 | [#125](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/125) | feat: 커뮤니티 게시판 디자인 확정 및 지역 제안 게시판 제거 | [#124](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/124) | 머지 |
| 2026-08-17 | [#181](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/181) | chore(fe): 동네 광장 제거 및 우리동네 아이디어 게시판 명칭변경 | [#180](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/180) | 머지 |
| 2026-08-18 | [#200](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/200) | chore: 자유게시판 데이터 및 DB 구조 제거 | — | 머지 |

**4단계 · MOIRA STUDIO와 연결**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-17 | [#176](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/176) | feat : 의제 게시판과 모이라 스튜디오 연결하기 | [#175](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/175) | 머지 |

**5단계 · 리디자인과 마무리**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-18 | [#197](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/197) | feat(fe): 우리동네 아이디어 게시판 UI 리디자인 | [#196](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/196) | 머지 |
| 2026-08-18 | [#198](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/198) | fix: remove community board mock fallback | — | 머지 |
| 2026-08-19 | [#201](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/201) | feat: 아이디어 게시글 수정 및 삭제 기능 추가 | — | 머지 |
| 2026-08-19 | [#203](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/203) | style: 커뮤니티 하위 페이지 네비게이터 통일 | — | 머지 |
| 2026-08-22 | [#213](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/213) | feat: 모바일 게시판 UI/UX 개선 | — | 머지 |

PR 없이 이슈로만 남은 항목

| 이슈 | 제목 | 상태 |
| --- | --- | --- |
| [#39](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/39) | feat(fe): 댓글/수정/삭제 기능 추가 | 닫힘 |

<br>

### F07. 도서관 소식

> **구분** 커뮤니티 · **주요 내용** 공지·행사 글 조회, 검색, 좋아요·저장 · **권한** 공통
> 
> **기간** 2026-08-17 · **PR** 1건

F06에서 만든 게시판 구조를 그대로 쓰기 때문에, 소식 게시판 전용 화면 작업 한 건으로 끝났습니다.

**1단계 · 소식 게시판 화면**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-17 | [#190](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/190) | feat(fe): 도서관 소식 게시판 및 게시글 작성/편집 화면 리디자인 | [#189](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/189) | 머지 |

<br>

### F08. 기획안 생성

> **구분** MOIRA STUDIO · **주요 내용** 직접 입력 또는 주민 아이디어 기반 AI 초안 생성, 기존 프로그램 사례 참고 · **권한** 사서
> 
> **기간** 2026-07-21 ~ 2026-08-26 · **PR** 11건

빈 화면에서 LLM 초안 생성을 붙이고, 여기에 B01의 사례 검색을 결합해 기존 프로그램을 근거로 삼는 초안으로 바꿨습니다. 주민 아이디어를 입력으로 받는 두 번째 모드를 더한 뒤, 마지막으로 사례 검색을 로컬 JSON 파일럿에서 pgvector 본 경로로 옮겨 파일럿과 같은 결과가 나오는지 확인했습니다.

**1단계 · 진입 화면**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-07-21 | [#65](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/65) | feat: MOIRA STUDIO 시작 화면 UI 구현 | [#64](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/64) | 머지 |

**2단계 · LLM 초안 생성 연결**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-08 | [#137](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/137) | feat(ai): MOIRA Studio LLM 기획서 초안 생성 | [#136](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/136) | 머지 |
| 2026-08-14 | [#128](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/128) | feat(studio): 기획서 생성 로딩 상태 UI 구현 | [#102](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/102) | 머지 |
| 2026-08-15 | [#149](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/149) | feat(studio): 기획서 생성 API 플로우 연동 | [#148](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/148) | 머지 |
| 2026-08-15 | [#156](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/156) | feat(studio): 기획서 진행 단계 관리 기능 구현 | [#155](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/155) | 머지 |

**3단계 · 기존 사례 검색 결합 (파일 기반 파일럿)**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-15 | [#165](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/165) | feat: 정제 프로그램 의미 검색 및 AI 기획서 생성 파일럿 | [#162](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/162) | 머지 |
| 2026-08-16 | [#170](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/170) | feat : 정제한 351건으로 의미 검색 확장 및 모스 UI에 적용 | [#169](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/169) | 머지 |

**4단계 · 주민 아이디어 모드 추가**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-16 | [#174](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/174) | feat : 지역 의제를 골라 기획서 생성하는 기능 구현 | [#173](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/173) | 머지 |
| 2026-08-17 | [#176](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/176) | feat : 의제 게시판과 모이라 스튜디오 연결하기 | [#175](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/175) | 머지 |

**5단계 · 화면 정리**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-18 | [#194](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/194) | feat(studio):  모이라 스튜디오 메인 UI 개선 | [#193](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/193) | 머지 |

**6단계 · 사례 검색을 본 경로로 이전 (파일 -> pgvector)**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-26 | [#222](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/222) | feat : MOIRA Studio pgvector 유사 사례 검색 연결 | [#221](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/221) | 머지 |

PR 없이 이슈로만 남은 항목

| 이슈 | 제목 | 상태 |
| --- | --- | --- |
| [#63](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/63) | feat(studio): AI 프로그램 기획서 UI 구축 | 열림 |

<br>

### F09. 기획안 편집

> **구분** MOIRA STUDIO · **주요 내용** 항목별 수정, AI 다듬기, 기획서 저장 · **권한** 사서
> 
> **기간** 2026-08-07 ~ 2026-08-18 · **PR** 12건

편집 화면을 먼저 세우고, 선택 영역 AI 수정을 패널 -> 결과 비교 -> 반영 순으로 완성했습니다. 그 뒤 저장과 사용자별 관리를 붙이고, 실제 강의계획서 서식에 맞춰 PDF 출력까지 확정했습니다.

**1단계 · 문서 편집 화면**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-07 | [#103](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/103) | feat(studio): MOIRA STUDIO 기획서 문서 편집 화면 구현 | [#97](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/97) | 머지 |
| 2026-08-14 | [#104](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/104) | fix(studio): MOIRA STUDIO 작업 내역 문서 전환 동작 개선 | [#98](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/98) | 머지 |

**2단계 · 선택 영역 AI 수정 (패널 -> 비교 -> 반영)**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-14 | [#105](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/105) | feat(studio): MOIRA STUDIO 선택 영역 AI 수정 패널 구현 | [#99](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/99) | 머지 |
| 2026-08-14 | [#126](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/126) | feat(studio): AI 수정 결과 비교 UI 구현 | [#100](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/100) | 머지 |
| 2026-08-15 | [#157](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/157) | feat(studio): AI 부분 수정 기능 구현 | [#153](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/153) | 머지 |
| 2026-08-15 | [#159](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/159) | feat(studio): AI 수정안 적용 기능 구현 | [#154](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/154) | 머지 |

**3단계 · 저장과 사용자별 관리**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-14 | [#127](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/127) | feat(studio): 기획서 관리 화면 UI 구현 | [#101](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/101) | 머지 |
| 2026-08-15 | [#151](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/151) | feat(studio): 기획서 저장 및 불러오기 기능 구현 | [#150](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/150) | 머지 |
| 2026-08-15 | [#158](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/158) | feat(studio): 사용자별 기획서 관리 기능 구현 | [#152](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/152) | 머지 |

**4단계 · 기획서 서식과 PDF 확정**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-16 | [#172](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/172) | feat : 기획서 틀을 정하고 항목 단위 수정 기능 넣기 + PDF 출력추가 | [#171](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/171) | 머지 |
| 2026-08-17 | [#186](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/186) | feat : 기획서 PDF 서식과 편집 화면 다듬기 | [#184](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/184) | 머지 |
| 2026-08-18 | [#202](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/202) | feat(studio): 모이라 스튜디오 기획서 관리 및 편집 UI 개선 | [#195](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/195) | 머지 |

PR 없이 이슈로만 남은 항목

| 이슈 | 제목 | 상태 |
| --- | --- | --- |
| [#147](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/147) | MOIRA STUDIO 기획서 생성·저장·부분 수정 API 연동 | 닫힘 |

<br>

### F10. 참여와 집계

> **구분** 수요조사 · **주요 내용** 참여 의향·선호 시간대 응답, 결과 확인 · **권한** 공통/사서
> 
> **기간** 2026-08-17 ~ 2026-08-18 · **PR** 3건

F09에서 만든 기획서를 입력으로 받아, 주민이 응답하는 공개 페이지와 사서가 결과를 보는 화면을 짝으로 붙였습니다.

**1단계 · 주민이 응답하는 공개 페이지**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-17 | [#192](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/192) | feat(fe): 모이라 스튜디오 기획서 기반 공개 투표 페이지 구현 | [#191](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/191) | 머지 |
| 2026-08-18 | [#199](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/199) | feat/자세히 보기 투표 | — | 머지 |

**2단계 · 사서가 결과를 보는 화면**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-17 | [#187](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/187) | feat: MOIRA Studio에서 사서가 수요조사 결과를 확인하는 UI | [#185](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/185) | 머지 |

<br>

### F11. 내 활동 관리

> **구분** 마이페이지 · **주요 내용** 프로필, 게시글, 댓글, 관심글, 관심 프로그램 관리 · **권한** 로그인
> 
> **기간** 2026-07-21 ~ 2026-08-24 · **PR** 5건

스켈레톤과 프로필 API를 먼저 두고, 다른 기능이 완성될 때마다 그 활동 내역을 마이페이지로 끌어오는 방식으로 채웠습니다.

**1단계 · 골격과 프로필 API**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-07-21 | [#52](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/52) | feat(fe): 마이페이지 스켈레톤 UI 구현 | [#49](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/49) | 머지 |
| 2026-08-04 | [#110](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/110) | feat(be): 계정·프로필 조회·수정 API 구현 | [#108](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/108) | 머지 |

**2단계 · 각 기능의 활동 내역 끌어오기**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-07 | [#132](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/132) | feat: 마이페이지 계정 활동 및 게시판 DB 연동 | [#131](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/131) | 머지 |
| 2026-08-20 | [#209](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/209) | feat: 관심 프로그램 등록 및 마이페이지 목록 기능 추가 | [#207](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/207) | 머지 |
| 2026-08-24 | [#216](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/216) | feat: 아이디어 게시판 활동 내역을 마이페이지와 연동 | — | 머지 |

PR 없이 이슈로만 남은 항목

| 이슈 | 제목 | 상태 |
| --- | --- | --- |
| [#109](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/109) | feat(be): 계정·프로필 조회·수정 API 및 마이페이지 연동 | 닫힘 |

<br>

---

## 공통 기반 작업

기능명세서의 특정 행에 직접 대응하지는 않지만, 여러 기능이 함께 올라서는 토대가 된 작업입니다.

### B01. 프로그램 사례 데이터·AI 검색 파이프라인

> **기간** 2026-07-18 ~ 2026-08-08 · **PR** 18건

**F04 프로그램 탐색**과 **F08 기획안 생성**이 함께 올라서는 토대입니다. 금정구 프로그램을 크롤링해 저장하고, 첨부파일에서 텍스트를 뽑아 검색용 문서로 만든 뒤 임베딩과 검색 품질까지 검증하는 한 줄기 작업입니다.

**1단계 · 크롤링**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-07-18 | [#66](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/66) | feat(ai-data): 금정구 프로그램 크롤링 워크플로우 추가 - 일부만 크롤링 | [#56](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/56), [#57](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/57) | 머지 |
| 2026-07-19 | [#72](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/72) | feat(ai-data): 금정구 프로그램 전체 크롤링 결과 및 검증 문서 추가, 이미지/문서 제외 | [#56](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/56), [#67](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/67) | 머지 |
| 2026-08-08 | [#139](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/139) | feat: 금정구 작은도서관 프로그램 크롤링 재시도 | [#138](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/138) | 머지 |

**2단계 · 저장 구조 만들기**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-07-19 | [#73](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/73) | feat(ai-data): 프로그램 사례 DB 스키마 설계 및 Prisma 마이그레이션 | [#56](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/56), [#57](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/57), [#67](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/67), [#71](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/71) | 머지 |
| 2026-07-19 | [#75](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/75) | feat(ai-data): 프로그램 사례 저장 API 및 PostgreSQL Upsert 구현 | [#56](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/56), [#57](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/57), [#67](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/67), [#71](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/71), [#74](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/74) | 머지 |

**3단계 · 첨부파일에서 텍스트 뽑기 (PDF -> OCR -> HWP)**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-07-20 | [#79](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/79) | feat(ai-data): PDF 첨부파일 텍스트 추출 파이프라인 구축 | [#76](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/76), [#77](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/77) | 머지 |
| 2026-07-24 | [#83](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/83) | feat(ai-data): 이미지 및 PDF CLOVA OCR 파이프라인 구축 | [#76](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/76), [#77](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/77), [#78](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/78) | 머지 |
| 2026-07-27 | [#85](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/85) | feat(ai-data): HWP·HWPX 첨부파일 텍스트 추출 파이프라인 구축 | [#76](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/76), [#84](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/84) | 머지 |
| 2026-07-27 | [#87](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/87) | test(ai-data): 전체 첨부파일 텍스트 추출 결과 집계 및 최종 검증 | [#56](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/56), [#76](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/76), [#86](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/86) | 머지 |

**4단계 · 검색 문서화와 임베딩**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-07-29 | [#90](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/90) | feat(ai-data): 프로그램 사례 통합 검색 문서 생성 파이프라인 구축 | [#88](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/88) | 머지 |
| 2026-07-29 | [#91](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/91) | feat(ai-data): 프로그램 사례 검색 문서 청킹 파이프라인 구축 | [#88](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/88), [#89](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/89) | 머지 |
| 2026-07-31 | [#93](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/93) | feat(ai-data): 프로그램 사례 청크 임베딩 및 pgvector 유사도 검색 구축 | [#56](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/56), [#89](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/89), [#92](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/92) | 머지 |
| 2026-08-04 | [#106](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/106) | ProgramCase KURE-v1 임베딩 및 의미 검색 MVP | [#94](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/94) | 머지 |

**5단계 · 검색 계약과 품질 검증**

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-08-04 | [#112](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/112) | feat(ai-data): ProgramCase SearchProfile 파일럿 및 검색 MVP 구축 | [#107](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/107) | 머지 |
| 2026-08-04 | [#116](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/116) | feat(ai-search): 검색 원본 Snapshot 및 Canonical Source 계약 구축 | [#113](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/113), [#114](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/114) | 머지 |
| 2026-08-05 | [#119](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/119) | feat(ai-search): Attachment 구조 보존 Representation 및 ProgramCase 구간 후보 기반 구축 | [#113](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/113), [#114](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/114), [#117](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/117) | 머지 |
| 2026-08-05 | [#121](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/121) | feat(ai-search): ProgramCase 그룹화 및 MOIRA Studio 검색 Corpus 구축 | [#114](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/114), [#117](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/117), [#120](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/120) | 머지 |
| 2026-08-05 | [#123](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/123) | feat(ai-search): ProgramCase 검색 Retrieval 및 사람 평가 기반 구축 | [#114](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/114), [#117](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/117), [#122](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/122) | 머지 |

<br>

### B02. 프로젝트 기반·배포·디자인 시스템

> **기간** 2026-05-22 ~ 2026-08-25 · **PR** 7건

저장소 구조, 배포 환경, 공통 디자인 시스템 등 특정 기능에 속하지 않는 공통 작업입니다.

| 머지일 | PR | 제목 | 관련 이슈 | 상태 |
| --- | --- | --- | --- | --- |
| 2026-05-22 | [#2](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/2) | chore(common):  프로젝트 초기 디렉토리 구조 및 기여 가이드라인 생성 | — | 머지 |
| 2026-06-24 | [#22](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/22) | fix: 확장 프로그램 속성 주입으로 인한 hydration 경고 억제 | [#21](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/21) | 머지 |
| 2026-07-18 | [#58](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/58) | docs : 프로젝트 기준 및 AI 참조 체계 구축 | — | 열림 |
| 2026-07-19 | [#60](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/60) | Feat/프론트엔드 백엔드 API 주소 환경변수화 | [#38](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/38) | 닫힘 |
| 2026-07-19 | [#69](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/69) | docs(design): 메인페이지 기반 디자인 시스템 문서(DESIGN.md) 구축 | [#68](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/68) | 머지 |
| 2026-07-19 | [#70](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/70) | feat: 프론트엔드 백엔드 API 주소 환경변수화 | [#38](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/38) | 머지 |
| 2026-08-25 | [#219](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/pull/219) | chore: 로컬 PostgreSQL Docker 자동화 | — | 머지 |

PR 없이 이슈로만 남은 항목

| 이슈 | 제목 | 상태 |
| --- | --- | --- |
| [#8](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/8) | feat(interconnect): 프론트엔드 - 백엔드 연동 및 테스트 | 닫힘 |
| [#47](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/47) | chore(deploy): Vercel 프론트엔드 배포 연동 및 운영 환경 구성 | 닫힘 |
| [#54](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/54) | chore(deploy): EC2 기반 Express 백엔드 서버 배포 및 Vercel 연동 | 닫힘 |
| [#55](https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg/issues/55) | docs(project): 프로젝트 기준 문서 및 AI 지식베이스 구축 | 열림 |

<br>

