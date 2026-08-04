# ProgramCase Source Snapshot 실행 분석

## 범위

이 문서는 `program-case-source-snapshot`의 운영 DB read-only 실행 결과를 기록한다.

실행은 다음을 변경하지 않는다.

- Prisma schema와 migration
- ProgramCase, Session, Attachment DB row
- Attachment `rawText`와 `cleanedText`
- ProgramCaseDocument
- ProgramCaseDocumentChunk
- Embedding
- 기존 검색 기능

## 사전 확인

- 브랜치: `codex/feat-ai-search-canonical-dataset`
- 기준 HEAD: `0bd6354598e1900fcc08ef61b7cb6ef366f780d1`
- DB: `moira`
- crawler DTO: 349건
- DB ProgramCase: 349건
- 활성 Attachment: 237건
- JSON/DB Attachment URL 대응: 237/237
- 기존 DB SHA-256: 237/237
- 기존 공유 SHA-256 그룹: 21개, 122개 Attachment

## 구현 검증 기준

| 검증 | 기대값 |
|---|---:|
| ProgramCase | 349 |
| Attachment | 237 |
| JSON URL 대응 | 237 |
| DB SHA-256 보유 | 237 |
| DB write | 0 |
| Hash 불일치 | 0이어야 valid |
| 누락 snapshot reference | 0이어야 valid |
| 같은 hash binary 중복 저장 | 0 |

## 전수 실행 결과

전수 `--build`와 `--validate` 실행 후 이 절에 실제 결과를 기록한다.

## 해석 주의사항

- URL 응답 성공은 URL이 영구 저장소라는 의미가 아니다.
- crawler JSON은 HTML snapshot이 아니다.
- `ProgramCase.rawText`는 lossy flattened text다.
- Session은 regex-derived이며 Session이 없다는 사실을 단회차로 변환하지 않는다.
- Attachment `rawText`와 `cleanedText`는 parser-derived representation이다.
- 이번 snapshot은 PDF page, OCR block, HWP paragraph 또는 검색 corpus를 생성하지 않는다.

## 다음 이슈 입력

후속 이슈는 검증된 `sha256/<hash>/original.bin`과 content manifest만 구조 복원의 입력으로 사용한다. 외부 URL은 provenance와 재검증 수단으로 남기되 parser 입력의 우선 source로 사용하지 않는다.
