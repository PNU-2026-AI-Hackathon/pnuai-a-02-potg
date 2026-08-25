# ProgramCase Canonical Source 계약

## 목적

이 계약은 검색 전처리가 소비할 입력 원천을 고정한다. 검색 문서, 검색 metadata, chunk, embedding을 만들지 않는다.

입력은 다음 세 종류다.

1. `docs/fixtures/geumjeong-programs-349.json`의 초기 크롤링 DTO
2. 운영 DB의 `ProgramCase`, `ProgramCaseSession`, 활성 `ProgramCaseAttachment`
3. Attachment URL에서 내려받고 기존 DB SHA-256으로 검증한 binary snapshot

## 원본성 경계

- 크롤링 JSON은 원천 페이지를 정리한 **초기 DTO**이며 HTML snapshot이 아니다.
- `ProgramCase.rawText`는 HTML, 이미지와 공백이 정리된 lossy flattened text다.
- `ProgramCaseSession`은 본문에서 추출한 derived record다.
- `ProgramCaseAttachment.rawText`와 `cleanedText`는 PDF.js, CLOVA OCR 또는 kordoc가 만든 parser-derived representation이다.
- binary snapshot만 후속 PDF/OCR/HWP 구조 복원의 기준 원천이다.
- `fileUrl`은 provenance이며 영구 저장소가 아니다.

현재 존재하지 않는 HTML, parser version, source span, OCR block, bounding box, confidence, PDF page object와 HWP paragraph는 생성하거나 추측하지 않는다. 값은 `null`로 두고 `unresolvedReasons`에 이유를 기록한다.

## 버전

```text
schemaVersion: program-case-source/v1
builderVersion: program-case-source-snapshot-v1
```

## ProgramCase source record

`program-cases.jsonl`은 ProgramCase ID 오름차순으로 한 줄에 한 record를 저장한다.

```text
ProgramCaseSourceRecord
├─ schemaVersion
├─ builderVersion
├─ programCaseId
├─ crawler
│  ├─ crawlerSourceRef
│  ├─ crawlerRecordHash
│  ├─ source identity
│  ├─ final DTO record
│  └─ provenance
├─ dbIdentity
├─ core
│  └─ flattenedRepresentations
├─ sessions
├─ attachments
│  ├─ source metadata
│  ├─ flattenedRepresentations
│  ├─ verified binary snapshot
│  └─ provenance
├─ unresolvedReasons
└─ recordHash
```

`recordHash`는 `recordHash` 자신을 제외한 record content의 stable JSON SHA-256이다. 생성 시각과 다운로드 시각은 record에 포함되지 않는다.

## Attachment snapshot 상태

| 상태 | 의미 |
|---|---|
| `NOT_BUILT` | dry-run이며 다운로드하지 않음 |
| `VERIFIED` | HTTP 다운로드와 파일 탐지가 성공하고 DB SHA-256과 일치 |
| `DOWNLOAD_FAILED` | 네트워크 또는 HTTP 실패 |
| `EMPTY_RESPONSE` | 빈 파일 |
| `HASH_MISMATCH` | 현재 다운로드 SHA-256이 DB 값과 다름 |
| `TYPE_DETECTION_FAILED` | 파일 유형을 확인하지 못함 |

`VERIFIED`만 정상적인 후속 구조 복원 입력이다. Hash 불일치 binary는 `sha256/<hash>/original.bin`에 확정 저장하지 않는다.

## 저장 구조

```text
apps/backend/.local/program-case-search-v2/sources/
├─ manifest.json
├─ program-cases.jsonl
├─ validation-report.json
└─ sha256/
   └─ <sha256>/
      ├─ original.bin
      └─ manifest.json
```

`.local/`은 `apps/backend/.gitignore`에서 제외한다. 같은 SHA-256은 `original.bin` 하나만 저장하고 content manifest에 연결된 Attachment ID와 ProgramCase ID를 정렬하여 기록한다.

## 결정성

- ProgramCase: ID 오름차순
- Session: `sortOrder`, `sessionNumber`, ID 오름차순
- Attachment: ID 오름차순
- 연결 ID: 중복 제거 후 오름차순
- 객체 key: 사전순 stable serialization
- `recordHash`: ProgramCase source record content hash
- `datasetSnapshotHash`: manifest content hash
- `generatedAt`, `downloadedAt`: hash 영역 제외

동일한 crawler JSON, 동일한 DB source row와 동일한 binary에서는 실행 시각과 재사용 여부에 관계없이 동일한 record와 dataset hash가 생성되어야 한다.

## DB 안전성

Source repository는 transaction 시작 직후 다음을 실행한다.

```sql
SET TRANSACTION READ ONLY
```

조회 대상은 `ProgramCase`, `ProgramCaseSession`, 활성 `ProgramCaseAttachment`뿐이다. 조회를 마친 callback은 의도적인 sentinel exception으로 rollback한다.

`ProgramCaseDocument`, `ProgramCaseDocumentChunk`, `ProgramCaseDocumentChunkEmbedding`은 조회하거나 변경하지 않는다.

## CLI

```powershell
cd apps/backend

# 기본값도 dry-run이다. DB/JSON 대응만 검사하고 파일을 만들지 않는다.
npm.cmd run program-case-source-snapshot -- --dry-run

# 명시적 build에서만 다운로드와 .local artifact 생성이 발생한다.
npm.cmd run program-case-source-snapshot -- --build

# 기존 snapshot의 manifest, record, binary hash를 다시 검증한다.
npm.cmd run program-case-source-snapshot -- --validate
```

실패가 있더라도 개별 상태를 manifest와 validation report에 기록한다. 다음 실행은 이미 검증된 Attachment ID와 binary hash를 확인하여 재사용하고 실패 항목만 다시 시도할 수 있다.

## 후속 이슈 계약

다음 구조 보존 재추출 이슈는 URL이 아니라 `binarySnapshotRef`가 가리키는 검증 binary를 입력으로 사용한다.

- PDF: page와 page source 복원
- Image/PDF OCR: field, bounding box, confidence 보존
- HWP: paragraph와 table representation 생성
- ProgramCase와 Attachment section 연결

이 과정에서 생성되는 구조는 source snapshot을 변경하지 않고 별도의 parser-versioned derived artifact로 저장한다.
