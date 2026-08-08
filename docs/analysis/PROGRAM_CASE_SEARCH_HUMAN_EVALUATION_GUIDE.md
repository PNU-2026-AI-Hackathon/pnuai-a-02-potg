# ProgramCase 사람 Relevance 평가 가이드

> **[보류] 현재 pool로 사람 평가를 시작하지 않는다.**
>
> 이 문서의 절차와 평가 harness는 유효하지만, 2026-08-05 시스템 검토에서 다음이 확인되어
> 현 781개 pool은 **baseline 보존용**으로만 사용한다.
>
> - `programCaseSearchCorpus/builder.ts`가 `core.notices`를 참조하나 source snapshot 계약은
>   해당 값을 `core.flattenedRepresentations[PROGRAM_CASE_NOTICES]`에 둔다. 349건 전부
>   `undefined`가 되어 본문 설명 텍스트가 corpus에 반영되지 않았다.
>   그 결과 Core denseText 중앙값이 51자이다.
> - 크롤러의 첨부 selector가 `a[href*="upload_data"]`뿐이라 본문 `<img>`로 삽입된 프로그램
>   내용이 수집되지 않았다. 표본 23건 중 19건(83%)이 본문에 이미지를 포함하고, 5건은
>   본문 텍스트가 0자이다.
> - 평가 UI가 노출하는 `description`이 검색이 사용하는 Core `denseText`와 동일하여,
>   평가자가 검색기와 같은 정보만 보고 판단하게 된다.
>
> 위 항목이 해소되고 pool이 재생성된 뒤에 평가를 시작한다.
> 상세 근거는 후속 이슈에서 관리한다.

## 1. 실행 준비

PowerShell 창 1에서 backend를 실행한다.

```powershell
cd apps/backend
$env:KURE_MODEL_CACHE_DIR = (Resolve-Path .model-cache).Path
$env:HF_HUB_OFFLINE = "1"
$env:TRANSFORMERS_OFFLINE = "1"
npm.cmd run dev
```

`apps/backend/.env`에는 기존 계약에 따라 `DATABASE_URL`이 필요하다. 개발 환경에서는 production gate가 적용되지 않는다. production에서는 `ENABLE_PROGRAM_CASE_SEARCH_EVALUATION=true`와 Inspector 사용 시 `ENABLE_PROGRAM_CASE_SEARCH_INSPECTOR=true`가 추가로 필요하다. 모델은 `nlpai-lab/KURE-v1`, revision `d14c8a9423946e268a0c9952fecf3a7aabd73bd9`, 1024차원 L2-normalized 계약을 유지한다.

PowerShell 창 2에서 frontend를 실행한다.

```powershell
cd apps/frontend
npm.cmd run dev
```

평가 화면은 `http://localhost:3000/ai-search-evaluation`, Inspector는 `http://localhost:3000/ai-search-data-inspector`이다.

artifact가 없다면 backend에서 다음 순서로 생성한다. `--pool`은 기존 Chunk P0 DB를 read-only로 조회한다.

```powershell
npm.cmd run program-case-search-retrieval -- --build-bm25
npm.cmd run program-case-search-retrieval -- --embed
npm.cmd run program-case-search-retrieval -- --validate
npm.cmd run program-case-search-retrieval -- --build-query-set
npm.cmd run program-case-search-retrieval -- --pool
npm.cmd run program-case-search-retrieval -- --metrics --evaluation-report
```

## 2. 평가 절차

1. `Relevance 평가` 영역의 `평가 질의` 목록에서 질의를 선택한다.
2. `Blind mode`를 켠 상태로 시작한다. 이 모드에서는 검색 방식, BM25 score, cosine similarity, RRF score, 원래 rank가 표시되지 않는다.
3. pooled result의 대표 제목, 대상, 설명, 운영 정보, Group member 수, Core/Safe 표시를 읽는다.
4. 정보가 부족하면 `Inspector 열기`를 새 탭으로 연다. 평가 탭은 그대로 유지된다.
5. 다음 기준으로 0~3 `Relevance` radio를 선택한다.
   - 3: 매우 적합하며 MOIRA Studio 참고 사례로 바로 추천 가능
   - 2: 핵심 조건 대부분이 일치해 참고 사례로 활용 가능
   - 1: 일부 관련되지만 추천하기에는 부족
   - 0: 질의와 사실상 무관
6. 필요한 경우 `Reviewer note (선택)`을 입력한다.
7. `평가 저장`을 누른다. 저장된 결과는 `평가 수정 저장`으로 바뀌며 동일 query/result는 update된다.
8. 결과를 계속 평가하거나 `다음 질의`로 이동한다. `이전 질의`로 돌아갈 수도 있다.
9. 상단의 `전체 N/781 저장`과 Metrics의 `저장 label`, `평가 완료 query`를 확인한다.
10. 한 query의 pool 전체가 평가돼야 그 query가 partial Metrics 집계에 포함된다.

검색 score, 검색 방식, 기존 rank는 relevance 판단 근거로 사용하지 않는다. 문제가 의심될 때만 평가를 마친 뒤 Blind mode를 꺼서 진단한다.

## 3. Inspector 흐름

평가 결과에서 `Inspector 열기`를 누르고 ProgramGroup, Core/Safe corpus text, Section safety, 원본 ProgramCase, Attachment Representation 순서로 확인한다. 링크는 새 탭이므로 원래 평가 query와 draft는 평가 탭에 유지된다. Inspector의 현재 구현은 URL의 `groupId`로 해당 group을 자동 선택하지 않으므로 목록에서 관련 ProgramCase/Group을 다시 찾아야 할 수 있다.

## 4. 파일럿

1차 5개 query: `q001` 대상+주제, `q005` 대상+활동, `q013` 가족 참여, `q007` 다회차 운영, `q030` 적합 결과가 적은 질의. 2차는 `q002`, `q003`, `q008`, `q012`, `q026`을 더해 총 10개로 확장한다. 문제가 없으면 나머지 20개를 평가한다.

각 단계에서 query별 결과 수, group 중복, 판단 정보 충분성, 저장/수정, Blind mode, partial Metrics 상태를 확인한다. 추천 5개 query의 현재 합계는 148건이다.

## 5. 현재 pool 규모

30개 query, 781개 고유 `queryId + ProgramGroup` 평가 단위이다. query별 최소 14, 평균 26.03, 중앙값 25.5, 최대 36건이며 동일 query 안의 group 중복은 0이다. 방법별 pool 포함 건수는 Chunk P0 300, Dense Core/Safe 각 300, Hybrid Core/Safe 각 300, BM25 Core 192, BM25 Safe 242이다. 여러 방법이 같은 group을 찾으면 한 평가 카드로 합쳐지므로 이 수의 합은 781보다 크다.

서로 다른 group이 같은 대표 제목을 가진 반복은 query 전체에서 48건 발견됐다. 날짜·회차·variant 차이일 수 있어 자동 제거하지 않았다. Top 10을 Top 5로 줄이면 평가량은 크게 감소하지만 방법별 tail 후보의 recall을 잃고 pooling bias가 커질 수 있다. 우선 10개 query 파일럿을 완료한 뒤 판단 정보가 충분한지 확인하고, 필요하면 별도 pool version으로 depth 5를 비교한다.

## 6. 저장과 백업

- label: `apps/backend/.local/program-case-search-v2/evaluation/relevance-labels.json`
- qrels: `apps/backend/.local/program-case-search-v2/evaluation/qrels.json`
- metrics: `apps/backend/.local/program-case-search-v2/evaluation/metrics.json`
- report: `apps/backend/.local/program-case-search-v2/evaluation/evaluation-report.json`

모두 `.local/` 아래라 Git ignored이다. 파일 저장이므로 브라우저 새로고침과 서버 재시작 후에도 유지된다. 평가 시작 전이나 세션 종료 시 다음처럼 timestamp 백업을 만든다.

```powershell
cd apps/backend
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$source = ".local/program-case-search-v2/evaluation"
$backup = ".local/program-case-search-v2/evaluation-backups/$stamp"
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Copy-Item "$source/relevance-labels.json","$source/qrels.json","$source/metrics.json" -Destination $backup -ErrorAction SilentlyContinue
```

평가 후 qrels, metrics, report를 재생성하고 필요할 때만 공개 안전 요약을 생성한다.

```powershell
npm.cmd run program-case-search-retrieval -- --metrics --evaluation-report
npm.cmd run program-case-search-retrieval -- --public-summary
```

공개 요약은 query text, reviewer note, 원문을 제외하고 `docs/analysis/data/program-case-search-metrics.public.json`에 aggregate만 기록한다. 최종 공개 전 `final`과 평가 완료 query 수를 확인한다.

## 7. 검증된 제약

- Inspector link는 새 탭으로 열려 평가 query와 미저장 draft가 유지된다.
- Inspector는 현재 `groupId` query parameter를 자동 선택하지 않는다. 필요하면 Inspector 검색창에서 Group ID를 검색해 ProgramGroup과 corpus를 연다.
- 잘못된 Inspector group API ID는 404를 반환한다.
- frontend build는 제한된 네트워크에서는 기존 `next/font`의 Google Fonts `Do Hyeon` 다운로드 때문에 실패한다. 네트워크 허용 환경에서는 같은 commit이 정상 build된다.
