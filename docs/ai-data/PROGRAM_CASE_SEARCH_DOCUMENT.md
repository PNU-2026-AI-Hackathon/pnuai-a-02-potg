# 프로그램 사례 검색 문서

GitHub 이슈 #88의 프로그램 사례 통합 텍스트 생성 구현을 정리한다. 이 단계는 `ProgramCase`, `ProgramCaseSession`, 활성·추출 완료 `ProgramCaseAttachment.cleanedText`를 결정적인 단일 검색 문서로 결합한다. 청킹, 임베딩, pgvector, RAG는 포함하지 않는다.

## 저장 구조

`ProgramCaseDocument`는 원본 프로그램과 파생 검색 문서를 분리한다.

- `documentType`: `SEARCH`
- `version`: `1`
- `contentHash`: 최종 Builder 출력의 SHA-256
- 프로그램별 `SEARCH` 문서 한 행
- 프로그램 삭제 시 연결 문서 cascade 삭제
- 동일 `version + contentHash`이면 DB update를 수행하지 않음

## 생성 규칙

문서 섹션 순서는 다음과 같다.

1. 프로그램 기본 정보
2. 프로그램 안내
3. 원본 게시글 본문
4. 회차별 활동
5. 첨부파일 내용
6. 출처 정보

회차 정렬:

```text
sortOrder ASC
sessionNumber ASC
id ASC
```

첨부파일 정렬:

```text
createdAt ASC
id ASC
```

첨부파일은 다음 조건을 모두 만족할 때만 포함한다.

```text
isActive = true
extractionStatus = COMPLETED
cleanedText.trim()이 비어 있지 않음
```

Builder는 특정 `sourceType`이나 도서관에 따른 분기를 사용하지 않는다. 원본 프로그램, 회차, 첨부파일 데이터도 수정하지 않는다.

## CLI

백엔드 디렉터리에서 실행한다.

단일 프로그램:

```bash
npm run program-cases:build-documents -- --program-case-id=<uuid>
```

전체 프로그램:

```bash
npm run program-cases:build-documents -- --all
```

두 옵션 중 정확히 하나가 필요하다. 전체 실행은 명시적인 `--all` 없이는 시작되지 않는다.

## 테스트

단위 테스트:

```bash
npm run test:program-case-document
```

DB 통합 테스트:

```bash
npm run test:program-case-document-database
```

대표 5건 제한 검증:

```bash
npm run verify:program-case-documents-limited
```

DB 통합 테스트는 임시 프로그램을 생성한 뒤 다음을 검증하고 fixture를 삭제한다.

- `CREATED`, `UPDATED`, `UNCHANGED`
- `UNCHANGED` 재실행 시 `updatedAt` 불변
- 프로그램별 검색 문서 중복 없음
- 프로그램 삭제 시 문서 cascade
- 테스트 전후 원본 테이블 행 수 동일

## 대표 5건 제한 실행 결과

전체 349건은 실행하지 않았다. 다음 유형만 선택 실행했다.

| 유형 | 최초 실행 | 재실행 | 문서 길이 |
|---|---|---|---:|
| 회차 4건 | `CREATED` | `UNCHANGED` | 2,603 |
| JPEG OCR | `CREATED` | `UNCHANGED` | 1,377 |
| 일반 PDF | `CREATED` | `UNCHANGED` | 11,562 |
| HWP | `CREATED` | `UNCHANGED` | 2,187 |
| OCR 병합 PDF | `CREATED` | `UNCHANGED` | 3,692 |

검증 결과:

- 모든 문서의 `documentType = SEARCH`
- 모든 문서의 `version = 1`
- 저장 content와 Builder 출력 일치
- 저장 hash와 Builder 출력 SHA-256 일치
- 재실행 시 5건 모두 `UNCHANGED`
- 재실행 전후 `updatedAt` 동일
- 프로그램별 검색 문서 중복 0건
- 원본 ProgramCase, Session, Attachment 불변

## 품질 경고

다음 경고는 문서를 제외하거나 실패시키지 않으며 수동 검토 대상으로만 집계한다.

- `LONG_ATTACHMENT_TEXT`: 첨부 `cleanedText`가 10,000자 이상
- `MULTIPLE_PROGRAM_NAME_MARKERS`: 한 첨부에 `프로그램명`이 두 번 이상 등장
- `LONG_DOCUMENT`: 최종 통합 문서가 20,000자 이상

대표 일반 PDF는 15개의 `프로그램명` 표기를 포함해 `LONG_ATTACHMENT_TEXT`, `MULTIPLE_PROGRAM_NAME_MARKERS` 경고가 발생했다. OCR 병합 PDF는 `프로그램명` 표기 2개로 후자 경고가 발생했다. Builder는 첨부 내용을 자동 분할·삭제·교정하지 않는다.

## 전체 실행 전 확인

전체 349건 실행 전 다음을 확인한다.

1. migration 적용 대상 DB가 올바른지 확인
2. 대표 5건의 출력과 품질 경고 검토
3. 긴 종합 PDF를 그대로 검색 문서에 포함할지 결정
4. 전체 실행의 쓰기 시간과 운영 시간대 확인
5. 실행 후 `total`, `failed`, `emptyDocuments`, 경고 집계 검토
6. 즉시 재실행하여 전부 `UNCHANGED`인지 확인

## 전체 349건 생성 최종 결과

승인된 DB에서 다음 명령을 실행했다.

```bash
npm run program-cases:build-documents -- --all
```

최초 전체 실행 결과:

```text
total: 349
created: 344
updated: 0
unchanged: 5
failed: 0
emptyDocuments: 0
withSessions: 5
withAttachments: 237
durationMs: 23,457
```

대표 검증에서 미리 생성한 5건은 `UNCHANGED`였고 나머지 344건이 새로 생성되었다. 프로그램 한 건씩 독립 처리되었으며 실패와 빈 문서는 없었다.

같은 명령을 즉시 다시 실행한 결과:

```text
total: 349
created: 0
updated: 0
unchanged: 349
failed: 0
emptyDocuments: 0
withSessions: 5
withAttachments: 237
durationMs: 17,558
```

재실행 전후 검증:

- `ProgramCaseDocument` 행 수: 349 → 349
- 모든 문서의 `contentHash` 불변
- 모든 문서의 `updatedAt` 불변
- 동일 `programCaseId + documentType` 중복 0건
- 원본 ProgramCase, Session, Attachment의 전체 행 해시 불변

## 최종 DB 집계

```text
ProgramCase: 349
ProgramCaseSession: 20
ProgramCaseAttachment: 237
ProgramCaseDocument: 349
SEARCH documents: 349
missing SEARCH documents: 0
duplicate document groups: 0
documentType SEARCH: 349
version 1: 349
```

## 전체 품질 경고 집계

```text
LONG_ATTACHMENT_TEXT: 30
MULTIPLE_PROGRAM_NAME_MARKERS: 43
LONG_DOCUMENT: 0
경고가 하나 이상 있는 프로그램: 43
```

최종 문서 길이:

```text
최소: 540자
최대: 12,305자
평균: 2,628자
중앙값: 1,457자
```

가장 긴 문서 일부:

| ProgramCase ID | 프로그램명 | 길이 | 경고 |
|---|---|---:|---|
| `920f31c3-3094-4f8a-b039-32367bdd7567` | [희망그루터기] 중국어 입문반 | 12,305 | 긴 첨부, 복수 프로그램명 |
| `5ace1761-470d-4629-b5e7-62866e21fa08` | [아이꿈자람] I Love story | 12,284 | 긴 첨부, 복수 프로그램명 |
| `dab88dcd-36fd-459b-95ce-8da618ed8458` | [아이꿈자람] 어린이 과학탐구교실 | 12,278 | 긴 첨부, 복수 프로그램명 |
| `fb660179-162b-4029-a207-ca2d934bae48` | [아이꿈자람] Reading with phonics | 12,272 | 긴 첨부, 복수 프로그램명 |
| `0104706d-6567-41ee-968a-fa36201c0974` | [금샘마을] 그림책 독서논술 | 12,271 | 긴 첨부, 복수 프로그램명 |

긴 종합 PDF와 복수 프로그램명이 포함된 첨부는 검색 문서에서 자동 삭제·수정·분할하지 않았다. 경고는 후속 수동 검토를 위한 지표이며 생성 실패 조건이 아니다.

## 최종 테스트

다음 검증을 모두 통과했다.

```bash
npm run test:program-case-document
npm run test:program-case-document-database
npm run build
npx prisma validate
```

- Builder, hash, 서비스, CLI 단위 테스트 통과
- DB 통합 테스트 통과
- TypeScript 빌드 통과
- Prisma schema 검증 통과

## 후속 작업

다음 단계는 별도 이슈와 별도 브랜치에서 진행하는 검색·RAG용 문서 청킹이다. 이번 구현에는 청킹, 토큰 계산, 임베딩, pgvector, 유사 검색, RAG가 포함되지 않는다.
