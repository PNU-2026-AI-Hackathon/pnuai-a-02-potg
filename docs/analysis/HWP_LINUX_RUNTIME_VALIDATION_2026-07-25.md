# HWP Linux 런타임 검증

## 1. 목적과 결론

목적은 Ubuntu 24.04·Node.js 22에서 HWP 대표 표본 4건, `sharp` 이미지 경로, kordoc subprocess의 peak RSS·종료·cleanup을 확인하고 전체 백엔드 production 설치 명령을 확정하는 것이다.

**결론은 D. 아직 결정 불가**다. 현재 호스트에는 Docker·Podman이 없고, `wsl.exe`만 존재하며 Linux 배포판은 설치되어 있지 않다. 저장소에도 기존 Docker/Compose 실행 환경이 없고 EC2 접근 정보도 제공되지 않았다. 요청 조건에 따라 새 WSL·Docker·EC2 환경을 만들지 않고 정적 검토까지만 수행했다. 따라서 Linux 성공, 설치 크기, peak RSS를 추정값으로 대체하지 않는다.

전체 26건 실행은 불가하다. 기존 대표 4건을 포함해 이번 단계의 DB 쓰기는 0건이며 나머지 22건도 다운로드·실행하지 않았다.

## 2. 기존 구현 결과

Windows Node.js 22.17.0에서 대표 HWP 4건은 dry-run과 DB 저장 모두 4/4 성공했다. `extractorType=KORDOC_HWP`, version `4.2.7`, FAILED 0, replacement character 0이었다. raw text는 kordoc Markdown과 HTML table 구조이며 cleaned text는 표 셀 순서를 ` | `로 유지한다.

기존 Windows 파일별 CLI 기준은 다음과 같다.

| attachment ID | bytes | raw chars | cleaned chars | tables/rows/cells | CLI 시간 |
|---|---:|---:|---:|---:|---:|
| `7d6e2509-23a0-431c-b624-b9b7fa70faef` | 92,672 | 8,644 | 5,946 | 2/42/145 | 417ms |
| `88b3ab83-7b66-44c7-a3c8-e7e0245c770c` | 4,425,216 | 8,997 | 4,030 | 6/77/271 | 439ms |
| `bd7ffc09-ef85-4288-a44c-4b97dfc9ddf1` | 421,888 | 1,057 | 603 | 1/4/13 | 338ms |
| `41a0d307-62e4-42de-a199-93aaf02419a0` | 52,736 | 1,488 | 537 | 1/16/50 | 353ms |

위 값은 Linux 결과가 아니며 비교 기준으로만 사용한다. Linux raw/normalized SHA-256, 줄바꿈 차이와 문자·표 통계 일치는 미검증이다.

## 3. Linux 환경 가용성

| 항목 | 결과 |
|---|---|
| Docker | 명령 없음 |
| Podman | 명령 없음 |
| WSL | 실행 파일만 존재, 배포판 미설치 |
| bash | 명령 없음 |
| 저장소 Docker/Compose | 없음 |
| EC2 접근 | 제공되지 않음 |
| Ubuntu OS/버전 | 미검증 |
| Linux CPU architecture | 미검증 |
| Linux Node/npm | 미검증 |
| Linux 메모리 | 미검증 |

민감한 서버 정보, IP, 계정, 키는 조회하거나 기록하지 않았다.

## 4. production 설치 방식 검토

### A. `npm ci --omit=dev`

공식적이고 재현 가능한 명령이다. npm 기본값은 optional dependency를 설치하므로 Linux용 sharp runtime과 kordoc의 Transformers·ONNX Runtime·PDFium·pdfjs·sharp optional도 함께 설치될 것으로 예상된다. Linux에서 실제 설치하지 않았으므로 전체 크기·파일 수·설치 시간·sharp/HWP 성공은 미측정이다.

현재 Windows 개발 tree는 dev와 모든 optional을 포함해 1,252,353,204 bytes, 16,181 files다. 이는 깨끗한 A 설치 크기가 아니므로 A의 정량값으로 사용하지 않는다. 같은 tree에서 확인한 참고값은 다음과 같다.

| 경로 | Windows 참고 크기 | 상태 |
|---|---:|---|
| kordoc subtree | 106,807,534 bytes | optional 중첩 포함 |
| ONNX Runtime | 270,827,297 bytes | 설치됨 |
| Transformers | 251,095,162 bytes | 설치됨 |
| `pdfjs-dist` | 35,781,413 bytes | backend 직접 dependency도 존재 |
| PDFium | 11,246,019 bytes | 설치됨 |
| backend 직접 sharp package | 958,466 bytes | native runtime 별도 |
| Windows sharp native runtime | 19,199,007 bytes | 설치됨 |

기존 kordoc 단독 기본 설치는 약 745.8MiB였고 `--omit=optional` 단독 runtime은 29.36MiB였다. Linux A가 EC2 디스크와 배포 시간에 수용 가능한지는 EC2 디스크·배포 구조가 제공되지 않아 판단할 수 없다.

### B. sharp optional만 보존하고 kordoc optional 제외

현재 package 선언과 표준 npm flag만으로는 재현할 수 없다. npm의 `--omit=optional`과 `--include=optional`은 dependency 종류 전체에 적용되며 특정 부모 package의 optional만 선택하지 않는다. include와 omit을 함께 지정하면 optional 전체가 include된다. 이는 [npm ci 공식 문서](https://docs.npmjs.com/cli/commands/npm-ci/)와 [npm config 공식 문서](https://docs.npmjs.com/cli/using-npm/config/)의 동작이다.

수동 `node_modules` 삭제, lockfile 편집, 설치 후 cleanup, override·downgrade는 금지 조건 때문에 사용하지 않았다. OS별 `@img/sharp-*`를 직접 production dependency로 승격하는 방식은 package/architecture 조합과 lockfile 정책을 새로 설계해야 하며 Linux 실기 없이 안전성을 확정할 수 없어 적용하지 않았다.

### C. HWP runtime 분리

A의 Linux 실측 크기나 배포 시간이 운영 한도를 넘을 때 검토할 수 있다. 이번 단계에서는 구현하지 않았다.

- 별도 package: kordoc 4.2.7과 최소 wrapper만 있는 package/lockfile 필요
- 설치: HWP runtime에만 `npm ci --omit=dev --omit=optional`
- 입력: 검증 완료된 로컬 HWP 경로, timeout/cancel 정보
- 출력: 제한된 임시 Markdown 파일 또는 길이 제한 JSON metadata
- 호출: Express가 기존 `runSubprocess()`로 worker CLI를 파일별 실행
- 배포 단위: backend와 같은 호스트의 별도 runtime directory 또는 별도 이미지
- 복잡도: 두 lockfile, 두 보안 감사, 버전 동기화, 배포·관측·cleanup 책임 증가

방식 C는 queue나 상주 worker를 의미하지 않는다. A 실측 전에는 분리 필요성을 확정하지 않는다.

## 5. sharp 검증

Linux 검증은 미실행이다. 현재 Windows 설치에서는 다음 smoke test가 성공했다.

- `require("sharp")`: 성공
- sharp: 0.35.3
- libvips: 8.18.3
- 2×2 합성 PNG 생성: 성공, 95 bytes
- 생성 PNG metadata: `png`, 2×2
- image OCR mock: 성공, 실제 CLOVA 호출 0
- image preprocessor를 포함한 기존 mock 경로: 성공

`npm ci --omit=dev --omit=optional`이 Linux sharp native runtime을 제거한다는 package tree 특성은 확인됐지만 Linux에서 재현하지 않았다. 이 명령은 전체 backend 운영안으로 선택할 수 없다.

## 6. kordoc Linux 검증과 Windows 비교

Linux 대표 HWP 4건 다운로드·container 분석·kordoc 실행·출력 SHA-256·시간은 모두 미실행이다. DB에 다시 저장하지 않았다. Windows 기준 raw/cleaned 문자와 표 통계는 2절에 기록했다.

Linux에서 실행할 때는 기존 `--type HWP --attachment-id <id> --dry-run` 또는 DB와 분리된 승인 표본 파일을 사용해야 한다. 원문과 추출 전문은 출력하거나 커밋하지 않는다.

## 7. RSS, timeout, process 종료

Linux peak RSS는 미측정이다. 기존 Windows 검증의 `process.memoryUsage().rss`는 직접 API를 실행한 부모 process의 parse 직후 값으로 CLI subprocess peak RSS가 아니므로 Linux peak 값으로 재사용하지 않는다.

현재 `runSubprocess()`는 timeout·Abort·stdout/stderr 제한 시 직접 child에 `child.kill("SIGKILL")`을 보내고 `close` event 후 종료한다. 기존 짧은 timeout mock은 `SUBPROCESS_TIMEOUT`, 직접 child 종료, 임시 output cleanup, 다음 테스트 계속 처리를 통과했다.

그러나 child를 detached process group으로 만들지 않고 Linux의 음수 PGID kill도 사용하지 않으므로 **descendant process tree 종료는 보장하지 않는다**. 일반 HWP parse에서 kordoc이 추가 자식을 생성하는지는 Linux에서 확인하지 못했다. 대규모 process framework는 추가하지 않았다.

기존 Windows 실행 후 attachment temp job은 0개였고 Git 추적 원본·추출문도 0개다. Linux의 정상 4건·timeout 후 child/process/temp 잔존 수는 미검증이다.

## 8. 보안 감사

현재 모든 optional이 설치된 Windows tree에서 `npm audit --omit=dev`는 critical 0, high 6, moderate 4, low 1을 보고했다. 주요 경로:

- kordoc optional Transformers → ONNX Runtime/adm-zip 및 sharp 0.34.x: high
- kordoc direct MCP SDK 계열 Hono/AJV-fast-uri: moderate/high advisory
- 기존 Express body-parser: low
- Prisma tooling 경로: moderate

HWP 대표 실행에서 실제 로드된 package 목록에는 Transformers, ONNX Runtime, PDFium, kordoc optional sharp와 MCP server 모듈이 없었다. backend image 경로는 직접 sharp 0.35.3을 로드한다. lockfile 감사와 실제 설치·실행 경로는 구분해야 한다.

npm은 일부 transitive 취약점에 수정 가능 표시를 하지만 kordoc에는 2.5.2 downgrade처럼 부적절한 제안도 포함된다. `npm audit fix --force`, override, downgrade는 실행하지 않았다. 최종 Linux 후보 tree를 설치한 뒤 감사 결과를 다시 확정해야 한다.

## 9. 이번 단계 테스트

Windows에서 성공:

- TypeScript build
- HWP extraction unit/mock
- kordoc deployment mock
- image OCR mock, 실제 CLOVA 호출 0
- sharp 합성 PNG/metadata smoke
- attachment downloader/detector/PDF extraction module smoke
- subprocess timeout·출력 제한·cleanup mock

미실행:

- Linux `npm ci --omit=dev`
- Linux 전체 node_modules 크기·설치 시간
- Linux sharp native load와 image preprocessing
- Linux PDF extraction
- Linux 대표 HWP 4건
- Linux 파일별 시간·peak RSS·SHA-256
- Linux 정상/timeout process tree와 temp cleanup

기존 attachment 상태 전이 통합 테스트는 DB 접근이 필요한 쓰기 테스트이므로 이번 무쓰기 단계에서 재실행하지 않았다. 첫 시도는 sandbox DB 연결 제한으로 완료되지 않았으며 성공으로 계산하지 않는다.

## 10. 최종 선택과 다음 단계

선택은 **D. 아직 결정 불가**다.

- A: 공식·재현 가능하지만 Linux 크기, sharp/HWP 동시 성공, peak RSS 미측정
- B: 현재 npm package-type flag로 부모별 optional 선택 불가
- C: 설계 가능하지만 A가 실제 운영 한도를 넘는지 미확인

전체 26건은 실행할 수 없다. 다음 단계는 제공된 Ubuntu 24.04/EC2 동등 환경에서 아래 순서로 진행한다.

1. Node.js 22와 npm 버전, architecture, memory, 디스크를 비식별 기록한다.
2. 깨끗한 directory에서 `npm ci --omit=dev`의 시간·크기·파일 수를 측정한다.
3. sharp native smoke, image OCR mock, PDF smoke를 통과시킨다.
4. 대표 HWP 4건을 dry-run하여 Windows hash·문자·표 통계와 비교한다.
5. `/usr/bin/time -v` 등으로 파일별 peak RSS를 측정한다.
6. 짧은 timeout fixture 뒤 직접 child와 descendant, temp job이 모두 0인지 확인한다.
7. 최종 installed tree에 `npm audit --omit=dev`와 `npm ls`를 실행한다.
8. EC2 디스크·배포 시간 한도와 비교해 A 또는 C를 선택한다.

위 항목이 통과하고 운영 승인을 받은 뒤에만 나머지 22건의 순차 실행을 검토한다.
