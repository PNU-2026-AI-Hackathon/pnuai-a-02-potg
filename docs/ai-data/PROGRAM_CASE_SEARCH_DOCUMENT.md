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
