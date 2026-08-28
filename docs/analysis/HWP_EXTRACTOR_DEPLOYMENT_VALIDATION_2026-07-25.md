# HWP 추출기 배포 적합성 검증

## 1. 목적과 결론

- 검증일: 2026-07-25
- Windows 실행 환경: Windows, Node.js 22.17.0, npm 10.9.2
- 대상: `kordoc 4.2.7`, 이전 단계의 비식별 대표 HWP 4건
- 결론: **B. `kordoc`를 격리 subprocess로 실행**한다.
- 설치 조건: `npm ci --omit=dev --omit=optional` 또는 동등한 고정 lockfile 설치를 사용한다.

최소 production 설치는 30,783,790 bytes(29.36 MiB), 3,909 files, 118개 고유 package/version, 네이티브·플랫폼 바이너리 0개였다. 대표 표본은 공개 Node API와 공식 CLI 모두 4/4 성공했고 결과 SHA-256도 4/4 동일했다. 다만 Ubuntu 24.04 실기는 이 PC에 Docker와 설치된 WSL 배포판이 없어 수행하지 못했다.

## 2. 기존 비교 결과

| 항목 | kordoc 4.2.7 | hwp.js 0.0.3 |
|---|---:|---:|
| 대표 표본 성공 | 4/4 | 4/4 |
| 정규화 핵심 문자 순서 | 4/4 동일 | 4/4 동일 |
| 표 구조 | HTML table 보존 | tab/줄바꿈 평탄화 |
| 기존 전체 설치 | 745.8 MiB | 3.4 MiB |
| 최소 production 설치 | 29.36 MiB | 3.4 MiB |
| 라이선스 | MIT | Apache-2.0 |
| 유지보수 상태 | 4.2.7, 공개 `parseHwp` | 0.0.3, 2020년 릴리스 |

`kordoc`는 표 병합 정보를 보존하고 별도 변환 어댑터가 적어 최종 후보로 유지한다. `hwp.js`는 작고 결과 문자의 순서는 좋지만 표 의미를 복구할 자체 구현과 오래된 패키지 유지보수 부담이 있다.

## 3. 745.8 MiB의 원인

기존 기본 `npm install`은 package의 optional dependency까지 설치했다. 상위 용량은 `onnxruntime-node` 258.3 MiB, `@huggingface/transformers` 220.0 MiB, `onnxruntime-web` 128.2 MiB, Windows canvas binary 36.0 MiB, `pdfjs-dist` 35.6 MiB, Windows sharp binary 19.0 MiB, PDFium 10.7 MiB였다. `kordoc` 자체는 10.63 MiB다.

이 큰 모듈들은 OCR·PDF·렌더링 경로용 선택 의존성이다. HWP 4건을 공개 `parseHwp`로 실행했을 때 로드된 package는 다음 19개뿐이었다.

`kordoc`, `cfb`, `@xmldom/xmldom`, `jszip`, `pako`, `markdown-it`, `linkify-it`, `mdurl`, `uc.micro`, `entities`, `punycode.js`, `readable-stream`, `core-util-is`, `inherits`, `isarray`, `process-nextick-args`, `safe-buffer`, `setimmediate`, `util-deprecate`

MCP SDK와 zod는 production 설치에는 포함되지만 이 HWP 실행에서는 로드되지 않았다. cache와 fixture가 745.8 MiB의 주원인은 아니었다.

## 4. 최소 구성과 공식 API

`kordoc`의 package exports는 루트 `.` 하나이며 ESM `dist/index.js`, CommonJS `dist/index.cjs`, type declaration을 공개한다. `parseHwp(ArrayBuffer)`는 이 루트의 공식 export다. HWP parser 전용 공식 subpath 또는 별도 공식 package는 없다. 따라서 내부 chunk 경로를 직접 import하거나 소스를 vendoring하지 않는다.

다음 격리 설치를 검증했다.

```text
npm install --prefix apps/backend/.local/hwp-deployment-validation/prod-no-optional kordoc@4.2.7 --omit=dev --omit=optional
```

| 구성 | 크기 | 결과 | 평가 |
|---|---:|---|---|
| 기본 전체 설치 | 745.8 MiB | 4/4 | 불필요한 OCR/PDF 선택 의존성이 큼 |
| production, optional 제외 | 29.36 MiB | API 4/4, CLI 4/4 | 권장 |
| 공개 export esbuild bundle | 994.3 KiB 산출 | 런타임 실패 | 비권장·미지원 |

번들은 첫 시도에서 `onnxruntime-node`, Transformers, PDFium 동적 import를 해석하지 못했다. 이를 external 처리하면 1,018,127-byte bundle이 생성되지만 CommonJS 실행 시 번들 내부 `createRequire(undefined)`로 실패했다. 라이선스 파일도 별도 동봉해야 하고 공식 배포 방식이 아니므로 더 우회하지 않았다.

## 5. 직접 API와 subprocess

| 표본 ID | 원본 bytes | API ms | API RSS 관측값 | CLI ms | 출력 chars | API/CLI 동일 |
|---|---:|---:|---:|---:|---:|---|
| `7d6e2509-…` | 92,672 | 22 | 54.3 MiB | 417 | 8,644 | 예 |
| `88b3ab83-…` | 4,425,216 | 85 | 98.8 MiB | 439 | 8,997 | 예 |
| `bd7ffc09-…` | 421,888 | 6 | 87.2 MiB | 338 | 1,057 | 예 |
| `41a0d307-…` | 52,736 | 1 | 86.6 MiB | 353 | 1,488 | 예 |

API import는 500ms였다. RSS는 한 process의 parse 직후 관측값이며 파일별 peak가 아니다. API는 빠르고 Buffer를 정확한 ArrayBuffer slice로 전달할 수 있지만 공개 signature에 AbortSignal이 없다. 악성·손상 문서의 CPU 무한 점유, 메모리 급증, process crash를 Express process와 분리하기 어렵다.

공식 CLI는 cold start로 파일당 약 0.34~0.44초가 들지만 기존 `runSubprocess()`로 `shell: false`, 60초 timeout, stdout/stderr 64 KiB 제한, 출력 5 MiB 제한, 비정상 종료 감지와 자식 종료를 적용할 수 있다. 한 문서의 실패를 backend에서 격리할 수 있으므로 비신뢰 입력에는 이 방식이 적합하다. 임시 `.cli.tmp.md`는 `finally`에서 제거되며 실제 실행 뒤 잔존 파일은 0개였다.

## 6. Ubuntu 24.04 적합성

실기 결과가 아니다. 이 Windows 호스트에는 Docker가 없고 WSL 실행 파일만 있으며 Linux 배포판은 설치되지 않았다. 새 Docker/WSL 환경을 만드는 것은 이번 최소 검증 범위에서 제외했다.

정적 검토상 `kordoc`는 Node.js 18 이상을 표방하고, 최소 설치에는 native module, platform binary, install/preinstall/postinstall script가 0개다. 따라서 Node.js 22의 Ubuntu 24.04에서도 플랫폼 차이는 작을 것으로 예상한다. 예상 설치 크기는 약 29.36 MiB이나 filesystem 차이 때문에 실측값으로 간주하면 안 된다. EC2에는 별도 OS package가 예상되지 않는다.

다음 구현 전 Ubuntu 24.04에서 Node/npm 버전, `npm ci --omit=dev --omit=optional`, 4/4 결과 hash, 파일별 시간, `/usr/bin/time -v` peak RSS, timeout kill, 연속 실행 후 자식 process 0개와 임시 파일 0개를 확인해야 한다.

## 7. dependency, 라이선스, 보안

공개 package의 직접 production dependency는 MCP SDK, xmldom, cfb, commander, jszip, markdown-it, zod이며 optional dependency는 Transformers, PDFium, ONNX Runtime, pdfjs-dist, sharp다. peer dependency `puppeteer-core`는 최소 설치에서 설치되지 않았다.

최소 설치의 118개 고유 package/version 라이선스 표기는 MIT 100, ISC 8, Apache-2.0 3, BSD-3-Clause 2, BSD-2-Clause 2, MIT AND Zlib 1, Python-2.0 1, MIT OR GPL-3.0-or-later 1이었다. UNKNOWN은 0개, deprecated 표시는 0개, lifecycle script는 0개다. jszip의 이중 라이선스는 MIT 선택이 가능하다. package root에서 별도 LICENSE 파일이 발견되지 않은 `benchmark`, `isarray` 2건은 package metadata의 ISC/MIT 표기와 상위 배포물 고지를 법무·오픈소스 고지 단계에서 재확인해야 한다. copyleft를 의무적으로 선택해야 하는 package는 확인되지 않았다.

`npm outdated --omit=dev` 결과는 0건이었다. `npm audit --omit=dev --omit=optional`은 high/critical 0, moderate 3을 보고했다. 실제 원인은 HWP 실행 때 로드되지 않은 MCP SDK가 포함하는 `@hono/node-server <2.0.5`의 Windows static-file path traversal이며 자동 수정안은 없다. HWP subprocess에서 서버 기능을 노출하지 않으므로 직접 경로의 악용 가능성은 낮지만 production tree에는 존재한다.

optional을 제외하지 않은 lockfile 감사 표시는 high 5, moderate 2다. high는 설치되지 않은 Transformers/ONNX/sharp optional 경로다. 따라서 CI 감사도 `--omit=optional` 결과와 전체 lockfile 결과를 분리해 보되, 취약점을 숨긴 것으로 해석하지 않도록 두 결과를 기록해야 한다.

## 8. 최종 선택과 운영 조건

**B. kordoc 격리 subprocess**를 선택한다.

정량 근거는 최소 설치 29.36 MiB, native binary 0개, Windows Node 22에서 API 4/4·CLI 4/4 성공, API/CLI 출력 hash 4/4 동일, CLI 338~439ms다. 기능 근거는 표 HTML 구조와 병합 정보 보존이다.

운영 조건은 버전과 lockfile 고정, optional dependency 제외, 기존 안전 다운로드와 형식 검증 이후에만 실행, 동시성 제한, process timeout·출력 제한·임시 디렉터리 cleanup, 원문·추출문 로그 금지다. package 내부 경로 import, esbuild bundle, vendoring은 사용하지 않는다.

## 9. 실행 명령과 테스트

주요 명령:

```text
npm install --prefix .../prod-no-optional kordoc@4.2.7 --omit=dev --omit=optional
npm run test:kordoc-deployment
node dist/cli/validateKordocDeployment.js
npm run test:hwp-tool-comparison
npm run build
npm ls --prefix .../prod-no-optional --omit=dev --all
npm outdated --prefix .../prod-no-optional --omit=dev
npm audit --prefix .../prod-no-optional --omit=dev --omit=optional
```

성공: TypeScript build, deployment mock test, 기존 HWP 비교 mock test, 최소 설치 API 4/4, CLI 4/4, timeout, 출력 제한, 임시 파일 cleanup. 검증 도구는 승인된 4개 ID 외 파일이 있으면 거부하고 DB module을 import하거나 write하지 않는다. 원문과 추출문은 `.local` 아래에만 저장되며 Git 추적 파일에는 포함되지 않았다.

미실행: Ubuntu 24.04 실기, 실제 OOM/무한루프 악성 HWP, 자식 process tree의 OS별 강제 종료. Ubuntu 실기 전에는 배포 적합성을 최종 확정하지 않는다.

## 10. 알려진 위험과 다음 단계

1. Ubuntu 24.04에서 동일 lockfile과 대표 4건을 재검증한다.
2. `kordoc` optional dependency를 production lockfile에서 확실히 제외하는 배포 방식을 결정한다.
3. MCP SDK/Hono 취약점이 해소된 `kordoc` 릴리스를 추적한다.
4. subprocess 동시성, timeout, 최대 출력과 peak RSS 임계값을 운영 자원에 맞춰 확정한다.
5. 라이선스 고지에 kordoc 및 production transitive dependency를 포함하고 LICENSE 누락 2건을 재확인한다.
6. 위 선행 조건 뒤에만 HWP extraction service와 수동 CLI를 구현한다.

이번 단계에서는 DB 저장, extractionStatus 변경, 26건 전체 추출, dispatcher, 공통 extractor interface, HWPX 추출기를 구현하지 않았다.
