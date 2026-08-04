# ProgramCase Attachment Representation 계약

## 목적과 범위

이 계약은 `program-case-source/v1`의 검증된 content-addressed binary snapshot을 구조 보존 representation으로 변환한다.

```text
verified binary snapshot
→ parser-native structural representation
→ derived section candidates
→ explainable ProgramCase candidates
```

Search Corpus, Search Document, metadata, lexical/dense text, embedding, BM25, Dense/Hybrid 검색과 최종 ProgramCase-section 연결은 이 계약의 범위가 아니다. 외부 URL과 운영 DB는 입력으로 사용하지 않는다.

## 버전

```text
schemaVersion: program-case-attachment-representation/v1
representationVersion: attachment-representation-v1
sectionBuilderVersion: attachment-section-candidate-v1
candidateBuilderVersion: program-case-candidate-v1
```

모든 record는 `sourceSha256`, `binarySnapshotRef`, parser 이름·버전, representation 버전, `contentHash`, confidence와 unresolved reason을 가진다. ID는 source hash, record kind, 구조 위치와 content hash의 stable JSON SHA-256이다.

## Origin

`PARSER_NATIVE`는 parser가 직접 제공한 구조에만 사용한다.

- `PDF_PAGE`, `PDFJS_TEXT_ITEM`
- `CLOVA_OCR_FIELD`
- `HWP_PARAGRAPH`, `HWP_TABLE`, `HWP_TABLE_ROW`, `HWP_TABLE_CELL`

`DERIVED`는 자체 규칙으로 생성한 구조다.

- `DERIVED_OCR_LINE`, `DERIVED_OCR_BLOCK`
- `HWP_HEADING_CANDIDATE`
- `ATTACHMENT_SECTION_CANDIDATE`
- `PROGRAM_CASE_CANDIDATE`

Derived record는 반드시 `derivationRule`, `derivationVersion`, `inputUnitRefs`, confidence와 reasons를 가진다.

## PDF

PDF.js 6.1.200이 page 순서, page text, 문자 통계, text item 순서·transform·크기·font 정보를 생성한다. 페이지 분류는 기존 계약과 동일하다.

- 공백 제외 100자 이상: `TEXT`
- 30자 미만: `OCR_CANDIDATE`
- 나머지: `LOW_DENSITY`

PDF.js text item을 저장하지만 좌표 기반 line은 확정하지 않는다. OCR 후보 page는 기록만 하며 외부 OCR gate 승인 전에는 호출하지 않는다.

## Image OCR

CLOVA OCR V2 응답에서 인증정보와 endpoint를 제외한 다음을 `ocr-response.safe.json`에 보존한다.

- API field order
- `inferText`, `inferConfidence`, `boundingPoly`, `lineBreak`
- request/response format version
- provider와 API version
- source SHA-256와 safe artifact content hash

Field는 parser-native이다. Line은 전체 field에 lineBreak가 있으면 API 순서와 lineBreak로, 아니면 y 좌표 clustering으로 생성한다. Block은 line 간 vertical gap으로 생성한다. Line/block은 모두 derived다.

Visual block은 program section과 동일하지 않다. 각 block은 deterministic rule로 `PROGRAM_CONTENT`, `TITLE_CANDIDATE`, `PROGRAM_METADATA`, `TABLE_OR_GRID`, `HEADER_OR_BRANDING`, `CONTACT_OR_FOOTER`, `ADMINISTRATIVE_NOTICE`, `UNKNOWN` 중 하나의 역할 후보와 confidence/evidence를 가진다. Reading order는 `COLUMN_MAJOR`, `ROW_MAJOR`, `HYBRID_LAYOUT`, `UNRESOLVED` 중 하나로 기록한다.

동일 source hash, provider, parser version, representation version의 safe artifact가 유효하면 API를 다시 호출하지 않는다. 외부 호출에는 `--allow-external-api`, 1개 이상의 `--source-hash`, 1~10의 `--max-calls`가 모두 필요하며 retry는 0이다.

## HWP

kordoc 4.2.7 Markdown block 순서와 HTML table을 파싱한다. Paragraph와 table을 합치지 않고 `structuralOrder`로 순서를 재구성한다. Table row/cell과 `rowspan`, `colspan`을 보존한다.

원본 HWP paragraph ID, heading style, page coordinate와 control source span은 생성하지 않는다. Heading은 짧은 독립 문단·prefix·문장 종결 여부에 근거한 derived candidate만 생성한다.

## Section Candidate

PDF page, HWP paragraph/table, OCR block 같은 기존 unit reference를 순서대로 보유한다. 빈 section을 만들지 않는다. 경계 근거가 약하면 전체 attachment를 하나의 section으로 유지한다. Section은 프로그램 구간의 확정값이 아니다.

Image section은 visual block을 그대로 승격하지 않는다. linked ProgramCase가 하나면 강한 복수 프로그램 근거가 없는 한 `WHOLE_DOCUMENT` 하나를 만든다. 표 행·vertical gap·header·footer·contact는 단독 경계가 아니다. 공유 image는 반복되는 제목형 line과 근접한 날짜·시간·대상·장소·강사 metadata가 두 묶음 이상일 때만 `PROGRAM_REGION`으로 분할한다. 주변 block은 삭제하지 않고 `excludedPeripheralBlockRefs`로 보존한다.

## ProgramCase Candidate

후보군은 binary manifest의 `linkedProgramCaseIds`로 제한한다. title, target, date, location, keyword evidence를 개별 점수와 이유로 기록한다. 허용 상태는 `CANDIDATE`, `AMBIGUOUS`, `NO_RELIABLE_MATCH`뿐이다. `SAFE_MATCHED_SECTION` 같은 최종 연결 판정은 금지한다.

## Artifact

```text
apps/backend/.local/program-case-search-v2/representation/
├─ manifest.json
├─ validation-report.json
├─ pdf-pages.jsonl
├─ pdf-text-items.jsonl
├─ ocr-fields.jsonl
├─ ocr-lines.jsonl
├─ ocr-blocks.jsonl
├─ hwp-structural-units.jsonl
├─ attachment-sections.jsonl
├─ program-case-candidates.jsonl
└─ sha256/<sourceSha256>/
   ├─ parser-manifest.json
   └─ parser-specific local artifacts
```

`.local` artifact에는 원문과 OCR safe response가 포함될 수 있어 Git에 넣지 않는다. 공개 문서에는 전체 원문, 연락처, 강사명과 담당자명을 복사하지 않는다.

## CLI와 안전 조건

```powershell
npm.cmd run program-case-attachment-representation -- --dry-run
npm.cmd run program-case-attachment-representation -- --build-pdf
npm.cmd run program-case-attachment-representation -- --build-hwp
npm.cmd run program-case-attachment-representation -- --plan-ocr
npm.cmd run program-case-attachment-representation -- --build-ocr
npm.cmd run program-case-attachment-representation -- --build-sections
npm.cmd run program-case-attachment-representation -- --build-candidates
npm.cmd run program-case-attachment-representation -- --validate
```

기본 실행은 외부 API 호출 0, 외부 URL 다운로드 0, DB write 0이다. Source binary의 SHA-256과 `binarySnapshotRef`를 처리 전에 검증하며 snapshot은 수정하지 않는다.
