# HWP 텍스트 추출 구현 결과

## 1. 목적과 최종 선택

활성 `fileType=HWP` 첨부파일을 기존 claim·다운로드·상태 저장 흐름에 연결했다. 도구는 `kordoc 4.2.7`, 실행 방식은 파일별 공식 CLI 격리 subprocess다. HWPX, OCR·LibreOffice·hwp.js fallback, 중복 캐시, 전체 26건 처리는 제외했다.

## 2. 처리 흐름

```text
PENDING/재시도 FAILED 조회
→ 조건부 PROCESSING claim 및 attemptCount 증가
→ 기존 안전 downloader
→ detector와 bounded HWP container 분석
→ kordoc subprocess
→ rawText와 cleanedText 검증
→ COMPLETED 또는 FAILED 저장
→ extractor와 downloader 임시 디렉터리 cleanup
```

`--type HWP`의 기본 limit와 동시성은 1이다. 명시적 limit 최대값은 대표 표본 수와 같은 4다. 한 파일의 실패는 다음 파일을 중단하지 않는다.

## 3. 파일 형식 검증

kordoc 실행 전 다음을 모두 요구한다.

- detector 결과 `HWP`
- OLE/CFB magic과 정상 container
- `FileHeader` stream
- `HWP Document File` signature
- 암호화 flag 비활성
- 배포용 flag 비활성
- `BodyText` storage

HTML 응답과 다운로드 제한 위반은 기존 downloader/detector 오류를 사용한다. 일반 OLE·손상 OLE·signature 불일치는 kordoc에 전달하지 않는다. HWPX는 `HWP_UNSUPPORTED_HWPX`로 분리한다.

## 4. subprocess 제한

실제 호출 형태는 다음과 같다. 경로는 command string에 합치지 않고 배열 인자로 전달한다.

```text
node <kordoc package dist/cli.js> <downloaded-file> --output <job-dir/result.md> --silent
```

- `shell: false`
- 파일별 새 subprocess와 임시 output directory
- timeout 기본 60,000ms
- stdout/stderr 각각 64 KiB
- 결과 파일 최대 5 MiB
- 결과 문자열 기본 최대 5,000,000자
- non-zero, signal, timeout, 결과 누락·초과 분류
- 이전 output을 재사용하지 않음
- 성공·실패·Abort 모두 `finally` cleanup

## 5. rawText와 cleanedText

`rawText`는 kordoc의 UTF-8 Markdown 출력이다. kordoc이 생성한 HTML `<table>`, `<tr>`, `<td>/<th>`와 문단 경계를 그대로 유지한다. 앞뒤 공백, NUL과 저장 부적합 제어문자만 제거하며 개인정보 필터링이나 내용 삭제를 하지 않는다.

`cleanedText`는 검색·임베딩용 평문이다.

- script/style block 제거
- 표 한 행을 한 줄로 변환
- 셀 순서대로 ` | ` 구분
- 빈 셀 위치 유지
- HTML tag 제거와 제한된 entity decode
- 문단·제목 경계를 줄바꿈으로 유지
- 연속 빈 줄 최대 1개
- NUL·비정상 제어문자와 연속 공백 제거

결과는 raw/cleaned 비어 있지 않음, 공백 제외 기본 10자 이상, 최대 문자 수, replacement character 기본 1% 이하를 검증한다. 환경변수는 `HWP_EXTRACTION_*`로 조정한다.

## 6. DB 상태와 metadata

claim은 `id`, `isActive`, 대소문자 무시 `fileType=HWP`, 허용 상태, 기존 `updatedAt`을 조건으로 한다.

```text
PENDING → PROCESSING → COMPLETED
FAILED 재시도 → PROCESSING → COMPLETED
PROCESSING → FAILED
```

claim에서 `attemptCount`, `lastAttemptedAt`을 갱신한다. 성공 시 `rawText`, `cleanedText`, `KORDOC_HWP`, `4.2.7`, `HWP`, `application/x-hwp`, downloader의 size/SHA-256, `extractedAt`을 저장하고 failure 필드를 null로 만든다. 실패 메시지는 500자로 제한하고 임시 절대 경로와 subprocess stderr 전문을 저장하지 않는다. schema와 migration은 변경하지 않았다.

오류 코드는 다음과 같다.

- 형식: `HWP_UNSUPPORTED_HWPX`, `HWP_CONTAINER_INVALID`, `HWP_SIGNATURE_MISMATCH`, `HWP_ENCRYPTED`, `HWP_DISTRIBUTION_DOCUMENT`, `HWP_BODY_TEXT_MISSING`
- 실행: `HWP_EXTRACTOR_NOT_AVAILABLE`, `HWP_EXTRACTION_TIMEOUT`, `HWP_EXTRACTION_PROCESS_FAILED`
- 결과: `HWP_OUTPUT_MISSING`, `HWP_OUTPUT_TOO_LARGE`, `HWP_OUTPUT_EMPTY`, `HWP_OUTPUT_INVALID`
- 공통 downloader, detector, subprocess, cleanup 오류

## 7. 대표 표본 dry-run

2026-07-25에 승인된 네 ID만 실행했다. DB 변경 없이 다운로드, 형식 검증, kordoc, 정규화, cleanup이 4/4 성공했다.

| attachment ID | bytes | raw chars | cleaned non-space | tables/rows/cells | replacement | 결과 |
|---|---:|---:|---:|---:|---:|---|
| `7d6e2509-23a0-431c-b624-b9b7fa70faef` | 92,672 | 8,644 | 4,693 | 2/42/145 | 0 | 성공 |
| `88b3ab83-7b66-44c7-a3c8-e7e0245c770c` | 4,425,216 | 8,997 | 2,886 | 6/77/271 | 0 | 성공 |
| `bd7ffc09-ef85-4288-a44c-4b97dfc9ddf1` | 421,888 | 1,057 | 444 | 1/4/13 | 0 | 성공 |
| `41a0d307-62e4-42de-a199-93aaf02419a0` | 52,736 | 1,488 | 364 | 1/16/50 | 0 | 성공 |

## 8. 대표 표본 실제 저장 및 읽기 전용 검증

dry-run 후 동일 네 ID만 실제 처리했다. 조회 결과는 COMPLETED 4, FAILED 0, `KORDOC_HWP` 4, version `4.2.7` 4, detected `HWP` 4, failureCode null 4다. 모두 attemptCount 1, checksum·file size·attempt/extracted 시각이 존재했다.

| attachment ID | raw chars | cleaned chars | cleaned non-space | tables/rows/cells |
|---|---:|---:|---:|---:|
| `7d6e2509-23a0-431c-b624-b9b7fa70faef` | 8,644 | 5,946 | 4,693 | 2/42/145 |
| `88b3ab83-7b66-44c7-a3c8-e7e0245c770c` | 8,997 | 4,030 | 2,886 | 6/77/271 |
| `bd7ffc09-ef85-4288-a44c-4b97dfc9ddf1` | 1,057 | 603 | 444 | 1/4/13 |
| `41a0d307-62e4-42de-a199-93aaf02419a0` | 1,488 | 537 | 364 | 1/16/50 |

위 표에는 원문, 추출문, 파일명, URL query와 개인정보를 포함하지 않았다. OS temp root의 잔존 job directory는 처리 후 0개였다.

## 9. 테스트

성공한 mock/unit:

- 정상·빈·누락·초과 kordoc output
- timeout, non-zero, stdout/stderr 제한 mapping, AbortSignal
- extractor cleanup
- HWPX, signature, 암호화, 배포용, BodyText 누락
- 표 셀 순서·빈 셀, 제어문자, script/style 제거
- 한 파일 실패 후 다음 파일 계속 처리
- `--type HWP` parser와 최대 limit

성공한 회귀:

- TypeScript build
- attachment downloader/detector/PDF extraction 및 실제 상태 전이
- image OCR
- PDF OCR foundation/write
- recovery
- HWP 분석·도구 비교·kordoc 배포 검증

실제 통합은 대표 표본 dry-run 4/4, DB 저장 4/4, 저장 후 read-only 조회를 완료했다. 전체 26건은 실행하지 않았다.

## 10. dependency와 운영 설치

`package.json` production dependency와 lockfile에 `kordoc: 4.2.7`을 정확히 고정했다. lockfile에는 optional OCR/PDF dependency metadata가 기록되지만 HWP 실행에서는 import하지 않는다.

kordoc만 격리한 runtime은 다음 최소 설치가 가능하다.

```text
npm ci --omit=dev --omit=optional
```

그러나 현재 전체 백엔드는 기존 `sharp`의 OS별 runtime도 optional package로 제공받는다. 전체 backend에 위 명령을 그대로 적용하면 image OCR이 깨진다는 것을 실제 설치 후 확인했다. 따라서 EC2 운영은 다음 중 하나를 먼저 결정해야 한다.

1. HWP worker/runtime을 분리하여 kordoc 쪽에만 omit 적용
2. 전체 backend clean install에서 sharp의 Linux runtime을 명시적으로 보존하는 검증된 설치 절차 사용

기존 node_modules가 kordoc OCR/PDF optional package를 포함한다면 packaging 결정을 한 뒤 clean lockfile install로 교체한다.

2026-07-25 `npm audit --omit=dev --omit=optional`의 전체 backend 결과는 high 1, moderate 1, low 1이다. kordoc 경로는 MCP SDK → `@hono/node-server 1.19.11`과 ajv → `fast-uri 3.1.2`; body-parser low는 기존 Express 경로다. 이 모듈들은 실제 `parseHwp`/CLI 대표 실행의 loaded-module 목록에 없었다. npm은 transitive 수정 가능으로 표시하지만 이번 작업에서는 override·downgrade하지 않았다. 후속 kordoc release와 lockfile 갱신을 추적한다.

## 11. 보안과 개인정보

기존 allowlist, SSRF 방어, redirect 재검증, streaming size limit, timeout, SHA-256, 임시 directory cleanup을 그대로 사용한다. command injection을 막기 위해 shell과 command string을 사용하지 않는다. 운영 요약은 ID, programCase ID, 상태, 시간, 크기, 문자 수, 오류 코드로 제한한다.

Git 추적 파일과 이 문서에 HWP 원문·추출 전문, 전화번호, 이메일, 강사·신청자 정보, 전체 URL query, 임시 절대 경로를 포함하지 않았다.

## 12. 한계와 다음 단계

- Ubuntu 24.04 실기 검증 미완료
- Linux sharp runtime과 kordoc optional 제외가 공존하는 배포 절차 미확정
- malicious HWP의 실제 peak RSS/OOM 및 process-tree kill 미측정
- HWPX, 암호화·배포용 문서, OCR/fallback 미지원
- 표 구조는 rawText HTML에만 보존하고 관계형 DB에는 저장하지 않음

전체 26건 전에 Ubuntu Node 22에서 clean install, 대표 4건 hash, peak RSS, timeout/kill, 연속 실행 후 child process 0, temp job 0, image OCR의 sharp 로딩을 확인한다. 그 결과와 운영 임계값 승인 후에만 명시적 limit으로 나머지 22건을 순차 실행한다.
