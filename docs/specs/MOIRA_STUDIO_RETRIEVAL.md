# MOIRA Studio 유사 사례 검색 계약

## 목적

사서의 입력 조건과 주민 아이디어에 의미가 가까운 기존 프로그램 사례를 찾아 Gemini 기획안의 참고 Context로 제공합니다.

## 입력과 결과

- 입력: 분야, 대상, 운영 조건, 주민 아이디어를 조합한 검색어와 선택 대상 값
- 벡터: KURE-v1, 1024차원
- 저장: PostgreSQL `StudioProgramSearchProfile.embedding` (`pgvector`)
- 결과 수: 최대 5건
- Context 형식: 제목·대상·도서관·요약 등을 포함한 Markdown
- 최대 Context 길이: 백엔드 응답과 생성 경로의 제한 안에서 구성

## 검색 절차

1. 검색어를 KURE-v1으로 임베딩합니다.
2. 동일 모델·revision·embedding version의 프로필에서 pgvector 후보를 조회합니다.
3. 대상 조건을 반영하고 중복 프로그램을 제거합니다.
4. 최상위 결과를 기준으로 상대 유사도 하한을 적용합니다.
5. 재정렬한 결과 중 상위 5개를 Markdown 참고자료로 만듭니다.
6. Next.js 생성 경로가 사서 조건, 주민 의견, 참고자료를 Gemini Context에 함께 포함합니다.

## 불변 조건

- 서로 다른 임베딩 모델 또는 revision의 벡터를 같은 검색에서 섞지 않습니다.
- 한 프로그램이 중복 순위로 반환되지 않도록 source 기준으로 대표 결과를 선택합니다.
- 검색 결과가 없거나 검색이 실패하면 사례 기반 생성도 실패 처리합니다.
- Gemini API 키와 전체 내부 검색 응답은 브라우저에 직접 노출하지 않습니다.
- `Top 5`는 현재 제품 설정입니다. 최적값에 대한 별도의 사용자 평가 결과가 생기면 명세와 코드를 함께 변경합니다.

구현 기준은 `apps/backend/python/program_board_pgvector_search.py`, `apps/backend/src/services/programCaseStudioContext.ts`, `apps/frontend/src/app/api/studio/generate-plan/route.ts`입니다.

