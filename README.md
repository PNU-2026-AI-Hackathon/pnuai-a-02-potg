<div align="center">
  <img src="apps/frontend/public/moira-logo-mark-no-ai.png" width="120" alt="모이라 로고" />
  <h1>모이라 : 모두가 이어지는 라이브러리</h1>
  <p>
    <strong>주민의 목소리가 도서관 프로그램이 되는 곳, 모이라</strong>
  </p>
  <p>
    <font color="#6a737d">
      모이라는 주민의 의견을 도서관 프로그램 기획으로 연결하는 AI 기반 웹서비스 플랫폼입니다.<br />
      주민은 필요한 프로그램을 직접 제안하고 의견을 나누며, 사서 및 프로그램 기획자는 주민 의견과 기존 프로그램 사례를 바탕으로 MOIRA STUDIO에서 기획안을 작성할 수 있습니다.<br />
      완성된 기획안은 다시 주민 수요조사로 이어져, <strong>제안부터 기획·검증까지 주민과 도서관이 함께하는 과정을 지원합니다.</strong>
    </font>
  </p>
  <p>
    제7회 PNU 창의융합 AI 해커톤 · 융합트랙 2팀 · 팀 POTG<br />
    <strong>서비스 바로가기</strong> —
    <a href="https://pnuai-a-02-potg.vercel.app/">pnuai-a-02-potg.vercel.app</a>
  </p>
</div>

---

## 목차

1. [프로젝트 소개](#1-프로젝트-소개)
2. [상세설계](#2-상세설계)
3. [개발결과](#3-개발결과)
4. [피드백 반영 및 사용자 검증](#4-피드백-반영-및-사용자-검증)
5. [설치 및 사용 방법](#5-설치-및-사용-방법)
6. [소개 및 시연영상](#6-소개-및-시연영상)
7. [팀 소개](#7-팀-소개)
8. [해커톤 참여 후기](#8-해커톤-참여-후기)
9. [참고문헌](#9-참고문헌)

---

## 1. 프로젝트 소개

### 1.1. 개발배경 및 필요성

최근 도서관은 단순한 자료 제공을 넘어 독서·문화 프로그램을 통해 지역 주민이 함께 배우고 교류하는 **생활문화 공간**으로 역할이 확대되고 있습니다. 실제로 2025년 공공도서관 독서·문화 프로그램 참여자는 30,947,841명으로 전년 대비 6.8% 증가하였습니다.<sup id="cite-1">[[1]](#ref-1)</sup>

그러나 프로그램 기획 과정에서는 다음과 같은 어려움이 존재합니다.

- **사서 및 프로그램 기획자:** 자료 관리, 이용자 서비스, 행정 업무 등을 함께 수행해야 하므로 주민 수요 파악부터 사례 조사, 프로그램 기획까지 수행하는 데 필요한 시간과 인력이 부족합니다.
- **지역 주민:** 원하는 프로그램이나 아이디어를 제안하고, 이를 실제 도서관 프로그램 기획으로 연결할 수 있는 참여 창구가 부족합니다.
- **기존 서비스:** 이미 기획된 프로그램의 정보 제공과 신청에 집중되어 있어 주민 의견과 프로그램 기획 과정이 서로 연결되기 어렵습니다.

이러한 문제를 배경으로, **주민의 아이디어와 도서관의 프로그램 기획을 연결하고 사서 및 프로그램 기획 담당자의 기획 업무를 지원하는 플랫폼 ‘모이라: 모두가 이어지는 라이브러리’** 를 개발하게 되었습니다.

<br>

### 1.2. 개발목표 및 주요내용

모이라는 **지역 주민의 의견과 도서관 프로그램 기획을 연결하고, AI를 활용하여 사서 및 프로그램 기획 담당자의 프로그램 기획 업무를 지원하는 것**을 목표로 합니다. 주민 의견 수렴부터 프로그램 기획, 수요조사까지의 과정을 하나의 플랫폼에서 연결하여 주민 참여형 도서관 프로그램 기획 환경을 구축하고자 하였습니다. 이를 위해 다음 세 가지 핵심 기능을 구현하였습니다.

1. **우리 동네 아이디어**: 주민이 지역에 필요한 프로그램과 의견을 자유롭게 제안하고 소통할 수 있습니다.

2. **MOIRA Studio**: 기존 도서관 프로그램 데이터와 주민 아이디어를 활용하여 AI 기반 프로그램 기획안 생성을 지원합니다.

3. **프로그램 수요조사**: 생성된 기획안에 대한 주민의 참여 의향과 선호 일정 등을 확인할 수 있습니다.
<br>

### 1.3. 세부내용

#### 사용자 유형 및 주요 기능

| 사용자 유형 | 기능 요약 |
| --- | --- |
| **지역 주민** | 도서관 프로그램 탐색, 지역 프로그램 일정 확인, 우리 동네 아이디어 작성·공감·댓글, 프로그램 수요조사 참여 |
| **사서 및 프로그램 기획자** | 프로그램 등록 및 관리, 주민 아이디어 탐색, MOIRA Studio를 활용한 AI 프로그램 기획안 생성·수정, 프로그램 수요조사 생성 및 결과 확인 |
<br>

### 1.4. 기존 서비스 대비 차별성

**비교 대상:** 금정구 공공예약서비스<sup id="cite-2">[[2]](#ref-2)</sup>, 금정구 통합도서관 홈페이지<sup id="cite-3">[[3]](#ref-3)</sup>, 국립중앙도서관 작은도서관 정보누리<sup id="cite-4">[[4]](#ref-4)</sup>, 문화체육관광부 작은도서관 서비스<sup id="cite-5">[[5]](#ref-5)</sup>

| 구분 | 기존 서비스 | 모이라 |
| --- | --- | --- |
| **프로그램 정보** | 개별 도서관 또는 서비스별 프로그램 정보 제공 | 지역 내 공공·작은도서관 프로그램을 통합하여 탐색 |
| **주민 참여** | 이미 기획된 프로그램의 확인·신청 중심 | 주민이 원하는 프로그램 아이디어를 직접 제안하고 의견 공유 |
| **프로그램 기획** | 프로그램 사례 및 참고자료 제공 | 기존 프로그램 데이터를 활용한 AI 기반 기획안 초안 생성 |
| **주민 의견 연계** | 주민 의견과 프로그램 기획이 별도로 운영 | 주민 아이디어를 MOIRA Studio에서 선택하여 실제 프로그램 기획에 활용 |
| **수요 확인** | 프로그램 개설 후 신청 중심 | 프로그램 운영 전 주민 참여 의향과 희망 일정 등을 수요조사 |
| **서비스 범위** | 개별 도서관 또는 전국 단위 정보 제공 중심 | 지역 생활권을 중심으로 주민과 도서관을 연결 |
<br>

### 1.5. 사회적가치 도입 계획

#### ① 지역 주민 | 도서관 프로그램 접근성 및 참여 기회 확대

지역 내 공공도서관과 작은도서관의 프로그램 정보를 한곳에서 통합 제공하고, **프로그램 검색·필터링, 관심 프로그램 저장, 캘린더를 통한 일정 확인** 등을 지원하여 주민이 원하는 프로그램을 보다 쉽게 탐색하고 관리할 수 있도록 합니다.

또한 주민이 원하는 프로그램 아이디어를 직접 제안하고 수요조사에 참여할 수 있도록 하여, **프로그램 이용자를 넘어 기획 과정에도 참여할 수 있는 환경**을 마련합니다.

#### ② 사서 및 프로그램 기획 담당자 | 프로그램 기획 업무 지원

AI 기반 프로그램 기획 기능을 통해 **사서 및 프로그램 기획 담당자의 기획 부담을 줄이고**, 기존 프로그램 사례와 지역 주민의 의견을 활용하여 지역 수요를 반영한 프로그램을 보다 효율적으로 기획할 수 있도록 지원합니다.

#### ③ 도서관 및 지역사회 | 지역 커뮤니티 활성화

주민과 도서관이 프로그램을 중심으로 지속적으로 의견을 주고받을 수 있는 연결 구조를 구축하여 **지역 특성을 반영한 프로그램의 활성화**를 지원합니다.

이를 통해 도서관이 **주민 참여와 교류가 이루어지는 지역 커뮤니티 거점**으로 기능하는 데 기여하고자 합니다.
<br>
<br>
<br>
## 2. 상세설계

### 2.1. 시스템 구성도

#### ① 전체 시스템 구성

<p align="center">
  <img src="docs/diagrams/moira-system-architecture.png" width="80%" alt="모이라 시스템 구성도" />
</p>

- **Frontend:** Vercel 기반 Next.js Web UI·API Routes, Gemini 및 Kakao Maps 연동
- **Backend:** AWS EC2 기반 Express REST API, Prisma CRUD 및 KURE-v1 의미 검색
- **Database:** AWS RDS PostgreSQL, pgvector 기반 임베딩 저장·유사도 검색

<br>

#### ② 데이터 가공 및 AI 검색 파이프라인

**1. 프로그램 사례 데이터 구축**

금정구 공공예약 서비스의 작은도서관 프로그램 정보를 수집하고, 본문·표·첨부파일·이미지에서 텍스트를 추출했습니다. 정제된 문서를 의미 단위로 분할한 뒤 KURE-v1으로 임베딩하여 PostgreSQL pgvector에 저장합니다.

```mermaid
%%{init: {"themeVariables": {"fontSize": "18px"}}}%%
flowchart LR
    COLLECT["프로그램 정보 수집<br/>목록 · 상세 페이지"]
    EXTRACT{"추출 경로 분류"}
    FILE["첨부파일<br/>PDF · HWP"]
    OCR["이미지 OCR<br/>이미지 · 스캔 문서"]
    WEB["웹 텍스트<br/>본문 · 표"]
    CLEAN["정제 · 청킹<br/>의미 단위 분할"]
    EMBED["KURE-v1 임베딩<br/>1024차원 벡터"]
    STORE[("PostgreSQL + pgvector<br/>프로그램 사례 저장")]

    COLLECT --> EXTRACT
    EXTRACT --> FILE --> CLEAN
    EXTRACT --> OCR --> CLEAN
    EXTRACT --> WEB --> CLEAN
    CLEAN --> EMBED --> STORE

    classDef process fill:#F6FBF7,stroke:#2E7D4F,color:#173E29,stroke-width:1.5px,font-size:18px;
    classDef storage fill:#EAF5ED,stroke:#1F6B40,color:#173E29,stroke-width:2px,font-size:18px;
    class COLLECT,EXTRACT,FILE,OCR,WEB,CLEAN,EMBED process;
    class STORE storage;
```

> [프로그램 사례 데이터 구축 상세보기](docs/ai-data/PROGRAM_CASE_DATA_PIPELINE.md)

<br>

**2. MOIRA STUDIO AI 기획 및 요청 흐름**

사서의 입력 조건과 주민 아이디어로 검색어를 구성하고, pgvector에서 의미가 유사한 프로그램을 검색합니다. 대상 조건을 반영해 재정렬한 상위 5개 사례를 Markdown 참고자료로 구성하고, Gemini Context에 포함하여 프로그램 기획안을 생성합니다.

**기획 과정**

```mermaid
%%{init: {"themeVariables": {"fontSize": "18px"}}}%%
flowchart LR
    INPUT["사서 입력 조건<br/>+ 주민 아이디어"]
    QUERY["검색어 구성"]
    SEARCH{{"KURE-v1 · pgvector<br/>의미 기반 검색"}}
    RERANK["대상 필터 · 재정렬<br/>유사 사례 Top 5"]
    CONTEXT["Markdown Context<br/>참고자료 구성"]
    GEMINI{{"Google Gemini API"}}
    RESULT["기획안 생성<br/>사서 검토 · 수정"]

    INPUT --> QUERY --> SEARCH --> RERANK --> CONTEXT --> GEMINI --> RESULT

    classDef input fill:#FBF9FF,stroke:#7450B8,color:#382064,stroke-width:1.5px,font-size:18px;
    classDef ai fill:#F3EEFF,stroke:#6842B5,color:#382064,stroke-width:2px,font-size:18px;
    classDef output fill:#F8F5FF,stroke:#7450B8,color:#382064,stroke-width:1.5px,font-size:18px;
    class INPUT,QUERY,RERANK,CONTEXT input;
    class SEARCH,GEMINI ai;
    class RESULT output;
```

**서비스 요청 경로**

```mermaid
sequenceDiagram
    participant U as 사서
    participant V as Next.js / Vercel
    participant E as Express / EC2
    participant P as KURE-v1 · pgvector
    participant G as Gemini API

    U->>V: 조건·아이디어로 기획 요청
    V->>E: 유사 사례 Context 요청
    E->>P: 검색어 임베딩·유사도 검색
    P-->>E: 재정렬된 Top 5
    E-->>V: Markdown Context
    V->>G: 조건 + 아이디어 + Context
    G-->>V: JSON 기획안 초안
    V-->>U: 기획안 편집 화면
```

> [MOIRA Studio AI 기획 과정 상세보기](docs/ai-data/MOIRA_STUDIO_AI_PLANNING.md)

<br>

### 2.2. 사용 기술

#### Frontend

| 이름 | 버전 | 사용 범위 |
|:---:|:---:| --- |
| Next.js | 16.2.6 | App Router 기반 웹 화면 및 프론트 API 라우트 |
| React | 19.2.0 | 화면 컴포넌트와 사용자 인터랙션 |
| TypeScript | 5.9.3 | 정적 타입 기반 프론트엔드 개발 |
| Framer Motion | 12.43.0 | 주요 화면 인터랙션과 애니메이션 |

#### Backend

| 이름 | 버전 | 사용 범위 |
|:---:|:---:| --- |
| Node.js | 22 LTS | 백엔드 실행 환경 |
| Express | 4.22.2 | REST API 서버 |
| Prisma | 7.8.0 | ORM, DB 스키마 및 마이그레이션 관리 |
| TypeScript | 5.9.3 | 정적 타입 기반 서버 개발 |
| JWT / bcryptjs | 9.0.3 / 2.4.3 | 인증 토큰 및 비밀번호 암호화 |

#### Database / Infra

| 이름 | 버전 | 사용 범위 |
|:---:|:---:| --- |
| PostgreSQL | 17 | 서비스 데이터 저장 |
| pgvector | 0.8.2 | 프로그램 사례 임베딩 검색 |
| Docker Compose | - | 로컬 개발 DB 실행 |
| Vercel | - | 프론트엔드 배포 |

#### AI / Data

| 이름 | 버전/모델 | 사용 범위 |
|:---:|:---:| --- |
| Google Gemini API | Gemini 3.6·3.5·3.1·2.5 Flash 계열 | MOIRA STUDIO 기획안 생성 및 수정 |
| KURE-v1 | d14c8a942394 | 한국어 프로그램 사례 임베딩 |
| Sentence Transformers | 3.3.1 | KURE-v1 임베딩 실행 |
| NAVER Cloud CLOVA OCR | General API V2 | 이미지·스캔 PDF 텍스트 추출 |
| PDF.js / kordoc / hwp.js | 6.1.200 / 4.2.7 / 0.0.3 | PDF·HWP 첨부파일 텍스트 추출 |
| Kakao Maps API | - | 우리 동네 도서관 위치 지도 |


<br>
<br>

## 3. 개발결과

### 3.1. 전체 시스템 흐름도

```mermaid
flowchart LR
    START(["서비스<br/>접속"]) --> MAIN(["MOIRA<br/>메인"])

    MAIN --> BOARD(["프로그램<br/>게시판"])
    BOARD --> PROGRAM(["프로그램<br/>둘러보기"])
    BOARD --> CALENDAR(["프로그램<br/>일정"])

    PROGRAM --> FILTER["검색<br/>필터"]
    PROGRAM --> DETAIL["상세<br/>조회"]
    PROGRAM --> FAVORITE["관심 프로그램<br/>등록"]

    MAIN --> LIBRARY(["우리 동네<br/>도서관 찾기"])
    LIBRARY --> MAP["지도<br/>위치 확인"]

    MAIN --> COMMUNITY(["우리동네<br/>이야기"])
    COMMUNITY --> NEWS(["도서관 행사<br/>및 소식"])
    COMMUNITY --> IDEA(["우리동네<br/>아이디어"])
    COMMUNITY --> SURVEY(["프로그램<br/>수요조사"])

    NEWS --> NEWS_VIEW["게시글<br/>조회 · 검색"]

    IDEA --> WRITE["아이디어<br/>작성"]
    IDEA --> REACTION["공감<br/>댓글"]

    MAIN --> STUDIO(["MOIRA STUDIO"])
    STUDIO --> MODE{"기획 시작<br/>방식"}

    MODE --> DIRECT["아이디어<br/>직접 입력"]
    MODE --> SELECT["주민 아이디어<br/>선택"]

    WRITE -. "주민 의견 반영" .-> SELECT
    REACTION -. "주민 의견 반영" .-> SELECT

    DIRECT --> CONDITION["프로그램<br/>조건 설정"]
    SELECT --> CONDITION

    CONDITION --> CASE{{"KURE-v1<br/>유사 사례 검색"}}
    CASE --> GENERATE{{"Gemini<br/>기획안 생성"}}
    GENERATE --> EDIT["기획안<br/>편집 · 저장"]
    EDIT --> OPEN["수요조사<br/>생성 · 공개"]

    OPEN -. "수요조사 공개" .-> SURVEY
    SURVEY --> CONFIRM["프로그램<br/>기획 확정"]

    classDef main fill:#17345f,color:#fff,stroke:#17345f,font-size:18px
    classDef page fill:#eef3f8,color:#243b53,stroke:#829ab1,stroke-width:2px,font-size:18px
    classDef residentAction fill:#fff,color:#334e68,stroke:#9fb3c8,font-size:18px
    classDef librarianAction fill:#fff,color:#334e68,stroke:#9fb3c8,font-size:18px
    classDef studioMain fill:#e7eef7,color:#17345f,stroke:#486581,stroke-width:3px,font-size:26px,font-weight:bold
    classDef aiProcess fill:#f1eef8,color:#4c3f75,stroke:#8b7bb5,stroke-width:2px,font-size:18px
    classDef decision fill:#fff,color:#334e68,stroke:#829ab1,font-size:18px
    classDef result fill:#edf4f1,color:#285943,stroke:#6b9b84,font-size:18px

    class START,MAIN main
    class BOARD,PROGRAM,CALENDAR,LIBRARY,COMMUNITY,NEWS,IDEA,SURVEY page
    class FILTER,DETAIL,FAVORITE,MAP,NEWS_VIEW,WRITE,REACTION residentAction
    class STUDIO studioMain
    class DIRECT,SELECT,CONDITION,EDIT,OPEN librarianAction
    class CASE,GENERATE aiProcess
    class MODE decision
    class CONFIRM result
```

> 둥근 도형은 **페이지**, 사각형은 **페이지 기능**, 육각형은 **AI 기능**, 마름모는 **선택 분기**를 나타냅니다.

<br>

### 3.2. 기능설명

#### 1) 메인 페이지
지역 내 도서관 프로그램과 주민 참여 콘텐츠를 한눈에 확인할 수 있습니다.
<br>

<p align="center">
  <img src="https://github.com/user-attachments/assets/04c665c6-e1ea-4fd2-9140-8690318e6c93" width="48%" />
  <img src="https://github.com/user-attachments/assets/d99d1775-0846-47df-8836-5abb964a510a" width="48%" />
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/182d445f-9eb8-4f94-9607-b737d3cfa559" width="48%" />
  <img src="https://github.com/user-attachments/assets/eb88edcc-aeba-4786-b88b-20f73ae3e6e8" width="48%" />
</p>


| 번호 | 기능 | 설명 |
| --- | --- | --- |
| 1 | 우리동네 인기 아이디어 | 주민들의 주요 아이디어를 확인할 수 있습니다. |
| 2 | 프로그램 수요조사 | 현재 진행 중인 프로그램 수요조사를 확인하고 참여할 수 있습니다. |
| 3 | 모집 중인 도서관 프로그램 | 현재 모집 중인 도서관 프로그램을 확인할 수 있습니다. |
| 4 | 우리 동네 도서관 찾기 | 지역 내 도서관의 위치 정보를 지도로 확인할 수 있습니다. |
<br>

#### 2) 프로그램 둘러보기 및 일정
금정구 공공도서관과 작은도서관의 프로그램을 통합하여 탐색하고 프로그램 일정을 확인할 수 있습니다.
<br>

<p align="center">
  <img src="https://github.com/user-attachments/assets/4012e52f-e5b8-4f40-81c6-ede2750f2ee8" width="48%" />
  <img src="https://github.com/user-attachments/assets/89dc21d9-6c58-4bf5-aa58-15ffed18ccf9" width="48%" />
</p>

| 번호 | 기능 | 설명 |
| --- | --- | --- |
| 1 | 프로그램 통합 탐색 | 금정구 내 공공도서관과 작은도서관의 프로그램을 한곳에서 확인할 수 있으며, 프로그램 선택 시 해당 프로그램의 공식 신청 페이지로 이동할 수 있습니다. |
| 2 | 검색 및 필터링 | 대상, 운영 기간 등의 조건을 활용하여 원하는 프로그램을 검색하고 필터링할 수 있습니다. |
| 3 | 관심 프로그램 | 관심 있는 프로그램을 저장하고 마이페이지에서 다시 확인할 수 있습니다. |
| 4 | 프로그램 일정 | 캘린더 보기를 통해 지역 도서관의 프로그램 일정을 날짜별로 확인할 수 있습니다. |
<br>

#### 3) 우리동네 아이디어 게시판
지역 주민이 원하는 도서관 프로그램이나 지역 관련 아이디어를 제안하고 다른 주민과 의견을 나눌 수 있습니다.
<br>

<img src="https://github.com/user-attachments/assets/1dd52b1a-15aa-47a9-b736-e3fe33f9658f" width="80%" alt="우리동네 아이디어 게시판" />

| 번호 | 기능 | 설명 |
| --- | --- | --- |
| 1 | 아이디어 작성 | 원하는 프로그램이나 지역 관련 의견을 작성할 수 있습니다. |
| 2 | 공감 | 다른 주민의 아이디어에 공감할 수 있습니다. |
| 3 | 댓글 | 게시글에 댓글을 작성하여 의견을 나눌 수 있습니다. |
| 4 | 아이디어 탐색 | 등록된 주민 아이디어를 확인할 수 있습니다. |
<br>

#### 4) MOIRA STUDIO
AI를 활용하여 도서관 프로그램 기획안 초안을 생성하고 수정할 수 있습니다. *사서 계정 전용 기능입니다.*
<br>

**① 기획 모드 선택**: MOIRA Studio에서는 직접 프로그램 아이디어를 입력하는 **‘프로그램 기획 모드’** 와 주민이 제안한 아이디어를 활용하는 **‘주민 아이디어 모드’** 두 가지 방식으로 프로그램 기획을 시작할 수 있습니다.

<p align="center">
  <img src="https://github.com/user-attachments/assets/bacaf4d8-a54c-495a-84ca-a4f08f0e37ab" width="48%" alt="프로그램 기획 모드" />
  <img src="https://github.com/user-attachments/assets/54aafa73-7d15-403f-a014-bbff6405f4d8" width="48%" alt="주민 아이디어 모드" />
</p>

| 구분 | 기능 | 설명 |
| --- | --- | --- |
| 프로그램 기획 모드 | 아이디어 직접 입력 | 기획하고 싶은 프로그램의 아이디어를 직접 입력하거나 제공되는 예시를 선택할 수 있습니다. |
| 주민 아이디어 모드 | 주민 아이디어 활용 | 우리동네 아이디어 게시판에 등록된 주민 의견을 탐색하고, 원하는 아이디어를 선택하여 프로그램 기획에 활용할 수 있습니다. |
| 공통 | 프로그램 조건 설정 | 프로그램 분야, 대상, 운영 기간 등의 조건을 설정하여 기획 방향을 구체화할 수 있습니다. |
| 공통 | AI 기획안 생성 | 입력하거나 선택한 아이디어와 설정 조건을 바탕으로 기존 도서관 프로그램 사례를 참고하여 AI가 기획안 초안을 생성합니다. |
<br>

**② AI 기획안 생성**

<p align="center">
  <img src="https://github.com/user-attachments/assets/bfc72488-f31d-46fd-863c-dd6348b03a98" width="48%" alt="AI 기획안 생성 중 화면" />
  <img src="https://github.com/user-attachments/assets/556d2174-23cf-4d18-8802-28a9c706248b" width="48%" alt="AI 기획안 생성 완료 화면" />
</p>

| 번호 | 기능 | 설명 |
| --- | --- | --- |
| 1 | 생성 과정 확인 | 조건 확인 → 기획 구조 구성 → 세부 운영 내용 작성 → 기획서 초안 정리의 단계별 진행 상황을 확인할 수 있습니다. |
| 2 | AI 기획안 생성 | 입력한 아이디어와 조건, 기존 도서관 프로그램 사례 등을 바탕으로 AI가 프로그램 기획안 초안을 생성합니다. |
| 3 | 주민 아이디어 반영 | 주민 아이디어 모드에서는 선택한 주민 의견을 기획안에 반영하고, 활용된 아이디어를 함께 확인할 수 있습니다. |
<br>

**③ 기획안 편집 및 AI로 다듬기**

생성된 기획안은 사서 및 프로그램 기획 담당자가 직접 수정하거나, 필요한 항목만 선택하여 AI의 도움을 받아 보완할 수 있습니다.
<br>
<img src="https://github.com/user-attachments/assets/a9f87e5c-e133-4638-b7f2-273bbc0d44ac" width="75%" alt="기획안 편집 및 AI로 다듬기" />

| 번호 | 기능 | 설명 |
| --- | --- | --- |
| 1 | 기획안 직접 수정 | 생성된 기획안의 각 항목에 커서를 두고 내용을 직접 수정할 수 있습니다. |
| 2 | 항목별 AI 다듬기 | 수정이 필요한 항목의 ‘AI로 다듬기’ 버튼을 통해 해당 내용만 선택하여 수정할 수 있습니다. |
| 3 | AI 수정 요청 | 원하는 수정 방향을 자연어로 직접 입력하거나 제공되는 예시 요청을 선택하여 AI에게 수정을 요청할 수 있습니다. |
| 4 | 수정 결과 반영 | AI가 제안한 수정 내용을 확인한 후 기획안에 반영하여 초안을 지속적으로 보완할 수 있습니다. |
<br>

#### 5) 프로그램 수요조사

<p align="center">
  <img src="https://github.com/user-attachments/assets/3ed99cdc-598b-4c43-bc76-89364db4e965" width="45%" alt="프로그램 수요조사 목록" />
  <img src="https://github.com/user-attachments/assets/97a66c1f-d1a2-4a26-8ccf-d20b6b85565d" width="45%" alt="프로그램 수요조사 결과 화면" />
</p>

| 번호 | 기능 | 설명 |
| --- | --- | --- |
| 1 | 수요조사 생성 | 사서 및 프로그램 기획 담당자는 생성된 기획서의 **‘수요조사 시작’** 버튼을 통해 해당 프로그램에 대한 주민 수요조사를 간편하게 생성할 수 있습니다. |
| 2 | 주민 수요조사 | 주민은 기획 중인 프로그램을 확인하고 참여 의향과 선호 시간대에 응답하여 프로그램 기획 과정에 참여할 수 있습니다. |
| 3 | 수요조사 결과 확인 | 사서 및 프로그램 기획 담당자는 주민의 참여 의향과 선호 시간대별 응답 결과를 확인하여 프로그램의 실제 개설 여부와 운영 일정 결정에 참고할 수 있습니다. |

<br>

### 3.3. 기능명세서

| 구분 | 기능 | 주요 내용 | 권한 | 구현 흐름 |
| --- | --- | --- | --- | --- |
| 회원 | 계정 관리 | 회원가입, 로그인, 관심분야 설정 | 공통 | [F01 · 4단계 / PR 16건](docs/features/README.md#f01-계정-관리) |
| 홈 | 서비스 진입 | 서비스 흐름 안내와 주요 화면 연결 | 공통 | [F02 · 4단계 / PR 12건](docs/features/README.md#f02-서비스-진입) |
| 도서관 | 도서관 찾기 | 도서관 검색, 위치·유형, 최근 프로그램 확인 | 공통 | [F03 · PR 1건](docs/features/README.md#f03-도서관-찾기) |
| 프로그램 | 프로그램 탐색 | 목록, 검색, 필터, 상세 정보, 원본 신청 링크 | 공통 | [F04 · 3단계 / PR 5건](docs/features/README.md#f04-프로그램-탐색) |
| 프로그램 | 일정·관심 관리 | 캘린더 확인, 관심 프로그램 저장·해제 | 로그인 | [F05 · 2단계 / PR 2건](docs/features/README.md#f05-일정관심-관리) |
| 커뮤니티 | 주민 아이디어 | 아이디어 작성, 댓글, 공감, STUDIO 연계 | 공통 | [F06 · 5단계 / PR 17건](docs/features/README.md#f06-주민-아이디어) |
| 커뮤니티 | 도서관 소식 | 공지·행사 글 조회, 검색, 좋아요·저장 | 공통 | [F07 · PR 1건](docs/features/README.md#f07-도서관-소식) |
| MOIRA STUDIO | 기획안 생성 | 직접 입력 또는 주민 아이디어 기반 AI 초안 생성, 기존 프로그램 사례 참고 | 사서 | [F08 · 6단계 / PR 11건](docs/features/README.md#f08-기획안-생성) |
| MOIRA STUDIO | 기획안 편집 | 항목별 수정, AI 다듬기, 기획서 저장 | 사서 | [F09 · 4단계 / PR 12건](docs/features/README.md#f09-기획안-편집) |
| 수요조사 | 참여와 집계 | 참여 의향·선호 시간대 응답, 결과 확인 | 공통/사서 | [F10 · 2단계 / PR 3건](docs/features/README.md#f10-참여와-집계) |
| 마이페이지 | 내 활동 관리 | 프로필, 게시글, 댓글, 관심글, 관심 프로그램 관리 | 로그인 | [F11 · 2단계 / PR 5건](docs/features/README.md#f11-내-활동-관리) |

> **구현 흐름** 열은 각 기능이 **어떤 이슈에서 출발해 어떤 순서의 PR을 거쳐 지금 모습이 됐는지**로 이어집니다.
> 위 표는 완성된 결과만 보여주지만, 그 뒤에는 먼저 세운 것과 되돌린 것, 걷어낸 것이 있습니다.
> 전체 지도는 [docs/features](docs/features/README.md)에서 볼 수 있고,
> 두 기능이 공통으로 올라선 토대는 [B01. 프로그램 사례 데이터·AI 검색 파이프라인](docs/features/README.md#b01-프로그램-사례-데이터ai-검색-파이프라인)에 따로 정리했습니다.

<br>

### 3.4. 디렉토리 구조

```text
pnuai-a-02-potg/
|-- apps/
|   |-- frontend/                 # Next.js 웹 애플리케이션과 BFF
|   |   |-- public/               # 이미지·아이콘 등 정적 리소스
|   |   `-- src/
|   |       |-- app/              # 화면과 Next.js Route Handler
|   |       |-- components/       # 공통·도메인 UI 컴포넌트
|   |       `-- lib/              # 인증, API 요청, 데이터 변환
|   `-- backend/                  # Express REST API와 데이터 처리
|       |-- prisma/               # PostgreSQL 스키마·migration·seed
|       |-- src/
|       |   |-- routes/           # 서비스·내부 API 라우트
|       |   |-- services/         # 도메인·첨부파일 처리 로직
|       |   `-- cli/              # 데이터 구축·검증 명령
|       |-- python/               # KURE-v1·pgvector 검색 모듈
|       `-- scripts/              # 테스트·운영 실행 스크립트
|-- docs/                         # 프로젝트 문서 허브
|   |-- ai-data/                  # 데이터 가공과 AI 기획 과정
|   |-- analysis/                 # 실험·분석·검증 기록
|   |-- api/                      # 현재 API 계약
|   |-- backend/                  # 백엔드 구조와 데이터 계약
|   |-- database/                 # Prisma·PostgreSQL·pgvector 구조
|   |-- design/                   # 프론트엔드 디자인 가이드
|   |-- diagrams/                 # README용 시스템 구성도
|   |-- features/                 # 기능명세서 항목별 PR·이슈 구현 흐름
|   |-- fixtures/                 # 수집·동기화 회귀 테스트 데이터
|   `-- specs/                    # 데이터 산출물·검색 기술 명세
|-- packages/
|   `-- types/                    # 프론트엔드·백엔드 공통 타입
|-- .github/                      # 이슈 및 PR 템플릿
`-- compose.yaml                  # 로컬 PostgreSQL 설정
```

> 전체 기술 문서와 AI 도구 활용 보고서는 [docs/](docs/README.md)에서 확인할 수 있습니다.

<br>
<br>

## 4. 피드백 반영 및 사용자 검증

### 4.1. 예선 심사 및 전문가 자문

**5월 26일 예선 심사**를 통해 다음과 같은 주요 피드백을 받았습니다.

- 작은도서관 활성화와 지역 커뮤니티 문제를 연결한 기획 방향에 대해 긍정적인 평가를 받았으며, **실제 협력 기관을 확보하여 현장 의견을 반영할 필요성**이 제시되었습니다.

이후 **6월 22일 감바랩스 대표 박세진 님과의 전문가 멘토링**을 통해 서비스의 실효성과 구현 방향을 점검하였습니다.

- 주민 참여와 프로그램 기획 업무 지원이라는 목표가 실제 서비스에서 효과적으로 작동할 수 있도록 **주민 참여 유인책과 현장 실효성을 구체화할 필요가 있다**는 의견을 받았습니다.
- 게시판 중심의 플랫폼에서 나아가 **AI 기반 프로그램 기획 기능의 역할을 구체화할 필요성**이 제시되었습니다.
- **실제 사용자를 대상으로 테스트를 진행하고 피드백을 반영하여 서비스의 활용 가능성을 검증할 필요가 있다**는 의견을 받았습니다.
<br>

### 4.2. 피드백 반영 및 개선사항

<p align="center">
  <img src="https://github.com/user-attachments/assets/6976d5ad-1915-464c-b771-64f12f2dc40b" width="48%" alt="도서관 프로그램 기획 담당자 이메일 소통 내용 1" />
  <img src="https://github.com/user-attachments/assets/f5d7719d-158a-4900-ac59-2a025d1c61b2" width="48%" alt="도서관 프로그램 기획 담당자 이메일 소통 내용 2" />
</p>

- **실제 사용자 협력체계 구축**: 공립 작은도서관 프로그램 기획 담당자와 협력하여 개발 과정에서 지속적으로 의견을 교환하고, 향후 베타테스트에 참여할 실제 사용자를 확보하였습니다.

- **현장 의견을 반영한 기능 재설계**: 프로그램 기획 담당자와 여러 차례 의견을 교환하며 실제 업무 환경과 요구사항을 확인하였습니다. 이 과정에서 실효성이 낮다고 판단된 **봉사자 매칭 기능을 제외**하는 등 서비스 범위를 실제 사용자 요구에 맞게 조정하였습니다.

- **주민 참여 유인 및 플랫폼 활용성 강화**: 주민이 아이디어 제안이나 수요조사에만 참여하는 구조에서 나아가, 평상시에도 활용할 수 있는 **지역 도서관 프로그램 통합 플랫폼**으로 서비스 범위를 확장하였습니다. 이에 따라 프로그램 통합 탐색, 검색 및 필터링, 관심 프로그램 저장, 프로그램 일정 캘린더, 우리동네 도서관 찾기 등의 기능을 추가하였습니다.

<br>

### 4.3. 사용자 베타테스트

**8월 18일~8월 25일**, 개발한 서비스의 실제 활용 가능성과 사용성을 확인하기 위해 **도서관 프로그램 기획 담당자와 금정구 지역주민을 대상으로 사용자 베타테스트**를 진행하였습니다.

- **도서관 프로그램 기획 담당자 대상 테스트**: 개발 과정에서 협력해 온 금정구 공립 작은도서관 프로그램 기획 담당자를 대상으로 비대면 테스트를 진행하였습니다. MOIRA STUDIO를 활용하여 실제 프로그램 기획안을 생성하고 수정하는 과정을 직접 사용해 본 후, 기능의 활용 가능성과 사용성, 개선이 필요한 부분에 대한 피드백을 수집하였습니다.

- **지역주민 대상 테스트**: 금정구에 거주하는 지역주민 10명을 대상으로 배포된 웹페이지에 직접 접속하여 프로그램 탐색, 우리동네 아이디어, 프로그램 수요조사 등 주요 기능을 자유롭게 이용하도록 하였습니다. 이후 실제 이용 과정에서 느낀 장점과 불편사항, 추가로 필요한 기능 등에 대한 의견을 수집하였습니다.

<br>

### 4.4. 베타테스트 결과 및 피드백

**[도서관 프로그램 기획 담당자]**

**긍정적 평가**
- 처음 이용하는 사용자도 쉽게 이해하고 따라갈 수 있는 **직관적인 화면 구성과 사용성**에 대해 긍정적인 평가를 받았습니다.
- MOIRA STUDIO가 **프로그램의 초기 아이디어를 구체화하고 실제 주민 수요를 반영한 프로그램을 기획하는 데 유용하게 활용될 수 있다**는 의견을 받았습니다.

**개선 의견**
- 기획안의 **‘AI로 다듬기’ 기능의 실행 방식이 다소 직관적이지 않아** 사용 흐름을 개선할 필요가 있다는 의견이 있었습니다.
- AI로 생성한 기획안뿐만 아니라 **기존에 작성한 프로그램 계획서 파일을 업로드하여 수요조사에 활용할 수 있는 기능**이 추가되면 좋겠다는 의견을 받았습니다.
- 공공기관 업무용 PC에는 다양한 보안 프로그램이 설치되어 있으므로, 실제 현장 도입을 위해서는 **보안 프로그램과의 호환성 및 안정적인 웹 접근 환경을 고려할 필요가 있다**는 의견이 있었습니다.

**[지역주민]**

**긍정적 평가**
- 금정구 내 여러 도서관의 **프로그램 정보를 한곳에서 확인할 수 있다는 점이 편리하다**는 평가를 받았습니다.
- 홈페이지의 색상과 전반적인 디자인이 **도서관 플랫폼의 이미지와 잘 어울리고 따뜻하고 안정적인 느낌을 준다**는 의견이 있었습니다.

**개선 의견**
- 회원가입과 로그인 방식이 일관되지 않아 불편하며, 이메일 사용이 익숙하지 않거나 이메일 계정이 없는 중장년층도 이용할 수 있도록 **다양한 연령층의 접근성을 고려한 가입·로그인 방식 개선**이 필요하다는 의견이 있었습니다.
- ‘우리동네 도서관 찾기’에서 위치 정보뿐만 아니라 **로드뷰 등 실제 주변 환경을 확인할 수 있는 기능**이 함께 제공되면 좋겠다는 의견이 있었습니다.

<br>

### 4.5. 향후 개선 방향

베타테스트에서 확인된 의견을 바탕으로 다음과 같이 서비스를 개선하고자 합니다.

- **로그인 방식 개선**: 아이디 또는 휴대전화 번호를 활용한 로그인 방식을 추가하여 다양한 연령층의 접근성을 높이고자 합니다.
- **수요조사 기능 확장**: 기존 프로그램 계획서 파일을 업로드하여 바로 수요조사를 생성할 수 있도록 기능을 추가하고자 합니다.
- **AI 편집 UI 개선**: ‘AI로 다듬기’의 수정 요청 및 결과 반영 과정을 보다 직관적으로 개선하고자 합니다.
- **도서관 찾기 기능 확장**: 지도에 로드뷰 기능을 추가하여 도서관과 주변 환경을 쉽게 확인할 수 있도록 개선하고자 합니다.
- **공공기관 환경 호환성 검증**: 공공기관의 브라우저 및 보안 프로그램 환경에서 서비스를 테스트하고 호환성을 개선하고자 합니다.
<br>
<br>

## 5. 설치 및 사용 방법

### 5.1. 필요 환경

- Git, Node.js 22 LTS, npm
- Python 3.11
- Docker Desktop 또는 Docker Engine
- KURE-v1 설치를 위한 약 4GB의 여유 공간

> MOIRA는 PostgreSQL의 `vector` 확장을 사용합니다. 일반 PostgreSQL 이미지가 아니라 pgvector가 포함된 PostgreSQL 17 환경이 필요합니다.

<br>

### 5.2. 설치 및 실행

저장소를 복제하고 pgvector가 포함된 PostgreSQL을 실행합니다.

```bash
git clone https://github.com/PNU-2026-AI-Hackathon/pnuai-a-02-potg.git
cd pnuai-a-02-potg
docker compose up -d
```

백엔드 패키지를 설치하고 `apps/backend/.env`를 설정합니다.

```bash
cd apps/backend
npm ci
cp .env.example .env
```

```env
DATABASE_URL=postgresql://moira:moira_local@localhost:5432/moira
JWT_SECRET=replace-with-a-long-random-secret
```

데이터베이스를 준비하고 Python 검색 환경을 설치합니다.

```bash
npx prisma migrate deploy
npm run db:seed
python3.11 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r python/requirements.txt
.venv/bin/python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('nlpai-lab/KURE-v1', revision='d14c8a9423946e268a0c9952fecf3a7aabd73bd9', device='cpu', cache_folder='.model-cache', trust_remote_code=False)"
```

> Windows에서는 `python3.11` 대신 `py -3.11`, `.venv/bin/python` 대신 `.venv\Scripts\python.exe`를 사용합니다. 기본 seed에는 프로그램 사례와 검색 임베딩이 포함되지 않으므로, MOIRA STUDIO 전체 기능은 운영 데이터와 검색 산출물이 있는 환경에서 사용할 수 있습니다.

검색 산출물을 보유한 환경에서는 Studio용 검색 프로필을 먼저 적재합니다. 해당 명령은 검색 산출물이 없는 기본 환경에서는 건너뛰고 백엔드만 실행합니다.

```bash
# 선택: 검색 산출물이 있는 환경에서만 실행
npm run program-board-search:pgvector-sync

npm run dev
```

새 터미널에서 프론트엔드를 설치하고 `apps/frontend/.env.local`을 설정합니다.

```bash
cd apps/frontend
npm ci
cp .env.example .env.local
```

```env
BACKEND_URL=http://localhost:4000
GEMINI_API_KEY=your-gemini-api-key
NEXT_PUBLIC_KAKAO_MAP_API_KEY=your-kakao-map-javascript-key
```

```bash
npm run dev
```

<br>

### 5.3. 접속 주소

| 구분 | 주소 |
| --- | --- |
| 프론트엔드 | `http://localhost:3000` |
| 백엔드 API | `http://localhost:4000` |
| 백엔드 상태 확인 | `http://localhost:4000/api/health` |
| 데이터베이스 상태 확인 | `http://localhost:4000/api/health/db` |

개발 서버는 `Ctrl+C`, PostgreSQL 컨테이너는 다음 명령으로 종료합니다.

```bash
docker compose down
```

<br>

## 6. 소개 및 시연영상

> 유튜브 링크

https://youtu.be/uBzASOUlOsY

<br>

## 7. 팀 소개


| 박현아 | 권아영 | 양현서 | 윤상현 |
| :---: | :---: | :---: | :---: |
| <img src="https://github.com/user-attachments/assets/5c220f17-e1f1-4a43-9680-700ab0b1b5c8" width="100"> | <img src="https://github.com/user-attachments/assets/227f274c-6ac6-416e-a276-3ee592134bbf" width="100"> | <img src="https://github.com/user-attachments/assets/578911fd-8260-4184-a7e3-7b6ed85f2bd6" width="100"> | <img src="https://github.com/user-attachments/assets/df270322-9d68-4ab0-9420-b12309669c0b" width="100"> |
| nandarina7@pusan.ac.kr | lpovsc23@pusan.ac.kr | ibuilder05@gmail.com | ggagga132@pusan.ac.kr |
| **(팀장)** AI · 프론트 · 백 | 기획 · 문서화 · UX/UI | 프론트 · 기능 구현 · 테스트 | 프론트 · 백 · 시스템 설계 |

<br>

## 8. 해커톤 참여 후기

<br>

* **박현아**
  > 24년도 대학에 입학했을 때부터 전공 팀플이라면 죽어도 하기 싫다며 피해 다녔지만, 동아리 활동과 여러 교내 공모전에 참여하면서 스스로 더 이상 피하기보다 직접 부딪혀보자는 생각을 하게 되었습니다. 그렇게 뜻이 맞는 주변 지인들을 모아 팀 POTG를 결성했고, 이번 제7회 부산대학교 AI 해커톤에 참여하게 되었습니다.
  >
  > 지역 사회에 도움이 되는 프로젝트를 만들고 싶다는 생각에서 '모이라 : 모두가 이어지는 라이브러리'를 기획했고, 약 4개월 동안 기획부터 디자인, 개발까지 전 과정을 경험했습니다. AI를 적극적으로 활용해 거의 매일같이 바이브 코딩을 했고, Codex, Claude, Copilot 등 토큰이 부족해질 때까지 여러 AI 에이전트를 번갈아가며 사용했습니다. 덕분에 빠르게 기능을 구현할 수 있었지만, AI가 의도와 다르게 구현하는 경우도 있어 단순히 코드를 빠르게 찍어내는 것보다 AI라는 도구를 어떻게 현명하게 활용할 것인지가 중요하다는 생각이 들었습니다.
  >
  > 또한 프로젝트를 진행하며 기획의 중요성을 뼈저리게 깨달았습니다. 실무자분들의 피드백을 받으며 누가 사용하는지, 왜 사용해야 하는지, 어떤 문제를 해결하는지 등 실제 사용자에게 필요한 서비스에 집중하는 법을 많이 고민했습니다. 연구자를 꿈꾸며 그동안 토이 프로젝트를 간간이 해왔던 저에게 '서비스 개발자'의 관점은 정말 새로운 경험이었습니다.
  >
  > 무엇보다 혼자 하는 것에 익숙했던 제가 팀원들과 역할을 나누고 하나의 목표를 향해 4개월 동안 함께 달려간 경험이 큰 의미로 남았습니다. AI라는 강력한 제3의 팀원도 있었지만, GitHub와 Discord에서 끊임없이 소통하며 레포를 채워간 것은 저와 팀원들이었습니다. 서로 다른 전공과 강점을 가진 사람들이 모여 하나의 결과물을 완성했다는 것이 뿌듯했고, 이 레포를 다시 돌아보는 지금도 그 과정이 꽤 즐겁게 느껴집니다.
  >
  > 이번 해커톤에서 얻은 바이브 코딩 경험을 하나의 습관으로 이어가며, 앞으로도 계속 무언가를 만들어가는 계기가 되었으면 합니다.
  >
  > 마지막으로, 4월 카톡방에서 조심스럽게 해커톤 링크를 보냈던 순간부터 8월 말까지 긴 시간을 함께 달려와준 팀원들에게 고맙다는 말을 전하고 싶습니다.

* **권아영**
  > 처음에는 비전공자로서 해커톤 과정을 잘 따라갈 수 있을지 걱정했지만, 팀원들의 도움을 받으며 깃허브를 통한 협업과 웹페이지 개발 과정을 직접 경험하고 배울 수 있어 뜻깊었습니다.
  >
  > 한편으로는 도서관 프로그램 플랫폼을 기획하면서 실제 이용자에게 정말 필요한 서비스가 무엇인지 많이 고민하였으나, 그 필요성을 플랫폼에 설득력 있게 담아내지 못한 것 같아 아쉽습니다. 다음에 비슷한 기회가 주어진다면 이용자의 요구를 더욱 깊이 파악하고, 이를 바탕으로 실질적으로 도움이 되는 서비스를 기획해 보고 싶습니다.
  >
  > 결과적으로 이번 해커톤을 통해 많은 것을 배우고 성장할 수 있었으며, 함께 고민하고 부족한 부분을 도와주며 끝까지 프로젝트를 완성해 준 팀원들에게도 고맙다는 말을 전하고 싶습니다. 저희가 진행한 프로젝트를 계기로 도서관과 사서의 역할에 더 많은 분들이 관심을 가질 수 있기를 바랍니다.

* **양현서**
  > 이번 해커톤을 통해 기획부터 서비스 및 시스템 설계, 프론트엔드·백엔드 개발, 테스트와 개선까지 개발의 전 과정을 직접 경험할 수 있었습니다.
  >
  > 처음에는 추상적이었던 아이디어가 팀원들과의 논의와 피드백을 거치며 구체적인 서비스와 시스템 구조로 발전하고, 실제로 작동하는 결과물로 완성되는 과정이 특히 인상 깊었습니다. 프론트엔드와 백엔드를 직접 연결하고 기능을 구현하면서 서비스의 각 요소가 유기적으로 작동하는 과정을 이해할 수 있었으며, 문제를 발견하고 해결하는 과정에서 실질적인 개발 역량도 키울 수 있었습니다.
  >
  > 이번 경험을 통해 개발 분야에 대한 관심이 더욱 커졌으며, 향후 전공 선택과 진로를 구체화하는 데 큰 영향을 받았습니다.

* **윤상현**
  > 재작년 SW 융합 해커톤 이후로 2년 만에 다시 참가하게 되었습니다.
  >
  > 당시에는 깃허브를 통한 협업 경험이 전무하여 여러모로 아쉬움이 남았지만, 이번 해커톤에서는 재작년과 달리 깃허브를 활용한 협업과 AI를 이용한 개발에 한층 능숙해진 제 모습을 보며 스스로의 발전을 느낄 수 있었습니다.
  >
  > 전반적인 기획과 개발을 맡아준 팀원들이 있었기에 제가 부족한 부분들을 채울 수 있었고, 저 역시 재작년 해커톤에 참여했던 경험과 실제 플랫폼 개발 경험을 살려 팀원들에게 도움을 줄 수 있어 뜻깊었습니다. 서로가 부족한 부분을 보완하고 각자의 강점을 살려 하나의 결과물을 만들어가는 과정에서 진정한 의미의 ‘융합 해커톤’을 경험할 수 있었다고 생각합니다.
  >
  > 지난 5개월 동안 팀원들 간의 의견 충돌부터 밤샘 개발까지 기억에 남을 일들이 정말 많았습니다. 순탄하지만은 않은 과정이었지만, 수많은 우여곡절 끝에 함께 여기까지 올 수 있었기에 더욱 값진 경험으로 남은 것 같습니다. 긴 시간 동안 함께 고민하고 노력해 준 팀원들에게 정말 고맙다는 말을 전하고 싶습니다.
  > 
  > 사실 해커톤이 끝나고 3일 뒤에 입대를 앞두고 있습니다. 그래서인지 이번 경험이 더욱 특별하게 다가오는 것 같습니다. 5개월 동안 함께 부딪히고 고민하며 하나의 결과물을 완성해 낸 경험은 단순히 하나의 대회를 마친 기억을 넘어, 앞으로 새로운 도전과 어려움을 마주할 때마다 저를 지지해 주는 하나의 기둥처럼 오래도록 남을 것 같습니다.

<br>

## 9. 참고문헌

<a id="ref-1"></a>**[1]** 문화체육관광부, 「공공도서관 주요 통계(2025년 실적)」, 국가도서관통계시스템, 2026. [↩](#cite-1)
https://www.libsta.go.kr/libsta/statistics/public/main

<a id="ref-2"></a>**[2]** 부산광역시 금정구, 「공공예약서비스」. [↩](#cite-2)
https://reserve.geumjeong.go.kr/index.geumj

<a id="ref-3"></a>**[3]** 부산광역시 금정구, 「금정도서관」. [↩](#cite-3)
https://library.geumjeong.go.kr/index.geumj

<a id="ref-4"></a>**[4]** 국립중앙도서관, 「작은도서관 정보누리」. [↩](#cite-4)
https://knu.nl.go.kr/libsearch

<a id="ref-5"></a>**[5]** 문화체육관광부, 「작은도서관」. [↩](#cite-5)
https://www.smalllibrary.org/
