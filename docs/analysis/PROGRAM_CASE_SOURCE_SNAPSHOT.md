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

2026-08-05에 운영 DB `moira`를 read-only transaction으로 조회하고 명시적 `--build`를 실행했다.

| 항목 | 결과 |
|---|---:|
| ProgramCase record | 349 |
| 활성 Attachment | 237 |
| HTTP 성공 | 237 |
| 비어 있지 않은 응답 | 237 |
| 기존 DB SHA-256 일치 | 237 |
| SHA-256 불일치 | 0 |
| 다운로드 실패 | 0 |
| DB byte size 일치 | 237 |
| DB 탐지 유형 일치 | 237 |
| DB MIME 일치 | 237 |
| 고유 검증 binary | 136 |
| 공유 hash 그룹 | 21 |
| 누락 snapshot reference | 0 |
| 생성된 `original.bin` | 136 |
| binary 총 크기 | 53,337,501 bytes |
| DB write | 0 |

Dataset snapshot hash:

```text
16c7135e1620dd07c9be3b57bcbb60865a34dec2ef19c55438f839f0e73a2e9c
```

독립 `--validate`가 manifest content hash, 349개 record hash와 136개 binary SHA-256을 다시 계산해 같은 dataset hash와 `valid: true`를 반환했다.

동일 source에서 `--build`를 다시 실행했을 때 기존 검증 snapshot을 재사용했으며 dataset hash가 유지됐다. `generatedAt`과 `downloadedAt`은 변경될 수 있지만 content hash 영역에는 포함되지 않는다.

`git check-ignore`로 `.local/program-case-search-v2/sources/manifest.json`이 제외되는 것을 확인했다. 생성된 binary와 JSONL은 Git 변경 목록에 나타나지 않았다.

## 해석 주의사항

- URL 응답 성공은 URL이 영구 저장소라는 의미가 아니다.
- crawler JSON은 HTML snapshot이 아니다.
- `ProgramCase.rawText`는 lossy flattened text다.
- Session은 regex-derived이며 Session이 없다는 사실을 단회차로 변환하지 않는다.
- Attachment `rawText`와 `cleanedText`는 parser-derived representation이다.
- 이번 snapshot은 PDF page, OCR block, HWP paragraph 또는 검색 corpus를 생성하지 않는다.

## 다음 이슈 입력

후속 이슈는 검증된 `sha256/<hash>/original.bin`과 content manifest만 구조 복원의 입력으로 사용한다. 외부 URL은 provenance와 재검증 수단으로 남기되 parser 입력의 우선 source로 사용하지 않는다.
