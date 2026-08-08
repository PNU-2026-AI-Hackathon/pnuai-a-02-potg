# HWP Linux 런타임 검증

## 1. 목적과 결론

Ubuntu 24.04·Node.js 22 환경에서 전체 backend production dependency 설치 가능성과, 설치 후 sharp·PDF·kordoc HWP 경로를 함께 검증하는 것이 목적이다. 실제 EC2의 운영 디렉터리가 아닌 별도 검증 복사본에서 수행했다.

**결론은 D. 아직 결정 불가**다.

- Ubuntu 24.04.4 LTS와 Node.js 22.23.1 환경은 실제 확인했다.
- `npm ci --omit=dev`를 두 번 실행했지만 전체 production dependency 설치는 완료되지 않았다.
- 1차는 명시적인 `ENOSPC`, 2차는 `Command terminated by signal 9`로 실패했다.
- 현재 약 6.8GiB 루트 filesystem에서는 swap과 partial `node_modules`가 동시에 공간을 압박했다. 명시적으로 확인된 첫 번째 병목은 디스크 부족이다.
- 최대 RSS는 1차 668,340KiB, 2차 686,656KiB까지 관측되어 약 911MiB RAM 환경의 메모리 여유도 작았다. 다만 2차 signal 9의 원인을 메모리 하나로 단정하지 않는다.
- 설치가 완료되지 않았으므로 Linux sharp, PDF, 대표 HWP 4건, 출력 SHA-256, subprocess process-tree는 여전히 미검증이다.
- A(`npm ci --omit=dev`)와 C(HWP runtime 분리)는 더 큰 디스크 또는 별도의 깨끗한 Linux build 환경에서 재검증한 후 선택해야 한다.

현재 운영 서버에는 적용하지 않았다. DB 쓰기는 0건이며 대표 4건 재실행과 나머지 HWP 22건 처리는 모두 수행하지 않았다.

## 2. 기존 Windows 구현 결과

Windows Node.js 22.17.0에서 대표 HWP 4건은 dry-run과 DB 저장 모두 4/4 성공했다. `extractorType=KORDOC_HWP`, version `4.2.7`, FAILED 0, replacement character 0이었다.

| attachment ID | bytes | raw chars | cleaned chars | tables/rows/cells | CLI 시간 |
|---|---:|---:|---:|---:|---:|
| `7d6e2509-23a0-431c-b624-b9b7fa70faef` | 92,672 | 8,644 | 5,946 | 2/42/145 | 417ms |
| `88b3ab83-7b66-44c7-a3c8-e7e0245c770c` | 4,425,216 | 8,997 | 4,030 | 6/77/271 | 439ms |
| `bd7ffc09-ef85-4288-a44c-4b97dfc9ddf1` | 421,888 | 1,057 | 603 | 1/4/13 | 338ms |
| `41a0d307-62e4-42de-a199-93aaf02419a0` | 52,736 | 1,488 | 537 | 1/16/50 | 353ms |

이는 Linux 결과가 아니라 비교 기준이다. Linux raw/normalized SHA-256, 줄바꿈, 문자·표 통계 일치는 확인하지 못했다.

## 3. 실제 EC2 검증 환경

| 항목 | 실제 확인값 |
|---|---|
| OS | Ubuntu 24.04.4 LTS |
| Kernel | Linux 6.17.0-1017-aws |
| Architecture | x86_64 |
| Node.js | v22.23.1 |
| npm | 10.9.8 |
| RAM | 약 911MiB |
| 초기 swap | 없음 |
| Root filesystem | 약 6.8GiB |
| 검증 위치 | 운영 디렉터리가 아닌 backend 복사본 |
| 운영 PM2 process | `moira-backend`, 검증 전후 `online` |

서버 IP, 계정명, 비밀키 등 민감한 운영 정보는 기록하지 않았다.

## 4. `npm ci --omit=dev` 실제 실행

### 4.1 1차 시도

2GiB swap을 생성한 뒤 다음을 실행했다.

```bash
/usr/bin/time -v npm ci --omit=dev --loglevel=warn
```

| 항목 | 결과 |
|---|---:|
| 결과 | 실패, `ENOSPC: no space left on device` |
| elapsed | 약 30.93초 |
| maximum resident set size | 668,340KiB |
| partial `node_modules` | 약 1.2GiB |
| 확인된 파일 수 | 중단 전 14,613개 |
| command exit status | 1 |

2GiB swap file이 루트 filesystem을 함께 사용하면서 dependency 설치 공간이 부족해졌다. 이 시도의 명시적인 실패 원인은 디스크 공간 부족이다.

### 4.2 2차 시도

2GiB swap과 partial 결과를 제거해 원상복구한 뒤 1GiB swap을 만들고 우선순위를 낮춰 재시도했다.

```bash
nice -n 10 /usr/bin/time -v npm ci --omit=dev --loglevel=warn
```

| 항목 | 결과 |
|---|---:|
| 실제 결과 | 실패, `Command terminated by signal 9` |
| elapsed | 약 3분 29초 |
| maximum resident set size | 686,656KiB |
| partial `node_modules` | 약 1.6GiB |
| 당시 root 사용률 | 93% |
| 당시 남은 공간 | 약 485MiB |
| `npm ls` | extraneous package 다수, 불완전 tree |

로그 pipeline 마지막의 `tee` 때문에 `/usr/bin/time` 출력에 `Exit status: 0`이 보였지만 npm 성공으로 해석하지 않는다. 실제 npm 작업은 signal 9로 종료됐고 dependency tree도 불완전했다.

### 4.3 정량 요약

| 항목 | 결과 |
|---|---|
| Ubuntu | 24.04.4 LTS |
| Node.js | 22.23.1 |
| npm | 10.9.8 |
| Architecture | x86_64 |
| RAM | 약 911MiB |
| Root filesystem | 약 6.8GiB |
| 1차 partial `node_modules` | 약 1.2GiB |
| 1차 peak RSS | 668,340KiB |
| 1차 결과 | ENOSPC, 실패 |
| 2차 partial `node_modules` | 약 1.6GiB |
| 2차 peak RSS | 686,656KiB |
| 2차 결과 | signal 9, 실패 |
| DB writes | 0 |
| Remaining HWP processed | 0 |
| 운영 PM2 영향 | 없음, `online` 유지 |

## 5. partial dependency tree의 의미

2차 partial tree의 `npm ls --omit=dev --depth=0`에는 다음 direct dependency가 보였다.

- `@prisma/adapter-pg@7.8.0`
- `@prisma/client@7.8.0`
- `bcryptjs@2.4.3`
- `cors@2.8.6`
- `dotenv@17.4.2`
- `express@4.22.2`
- `jsonwebtoken@9.0.3`
- `kordoc@4.2.7`
- `pdfjs-dist@6.1.200`
- `pg@8.22.0`
- `sharp@0.35.3`

그러나 설치가 signal 9로 중단됐고 extraneous package가 다수였으므로 정상 production tree가 아니다. package 이름이 보였다는 사실은 sharp native runtime이나 kordoc CLI가 Linux에서 로드·실행됐다는 증거가 아니다.

## 6. production 설치 방식 비교

### A. 전체 backend에서 `npm ci --omit=dev`

공식적이고 재현 가능한 명령이지만 이번 약 6.8GiB root filesystem에서는 완료되지 않았다. optional dependency가 기본 설치되므로 Linux sharp runtime과 함께 kordoc의 Transformers, ONNX Runtime, PDFium, pdfjs, optional sharp까지 설치 대상이 된다.

현재 EC2 조건에서는 A를 확정하지 않는다. 더 큰 디스크 또는 dependency 설치 전용의 깨끗한 Linux build 환경에서 설치 완료, 최종 크기, 설치 시간과 runtime smoke를 다시 측정해야 한다.

### B. sharp runtime만 보존하고 kordoc optional 제외

현재 package 선언과 표준 npm flag만으로는 재현할 수 없다. npm의 `--omit=optional`과 `--include=optional`은 특정 부모가 아니라 optional dependency 종류 전체에 적용된다. 따라서 sharp optional만 포함하고 kordoc optional만 제외할 수 없다. 이는 [npm ci 공식 문서](https://docs.npmjs.com/cli/commands/npm-ci/)의 동작과 일치한다.

수동 `node_modules` 삭제, lockfile 편집, 설치 후 cleanup, override·downgrade는 수행하지 않았다.

### C. HWP runtime 분리

A가 충분한 디스크에서도 운영상 과도할 경우 설계 후보로 유지한다. 이번 단계에서는 worker, queue 또는 별도 runtime을 구현하지 않았다.

- kordoc 4.2.7과 최소 wrapper만 별도 package/lockfile로 관리
- HWP runtime에만 `npm ci --omit=dev --omit=optional`
- 검증된 로컬 HWP 경로를 입력으로 받고 제한된 Markdown/metadata를 출력
- Express에서 기존 `runSubprocess()`로 파일별 호출
- backend와 같은 호스트의 별도 runtime directory 또는 별도 build artifact
- 두 dependency tree의 감사·버전·배포 동기화가 추가 운영 부담

## 7. sharp·PDF·kordoc Linux 검증

설치가 완료되지 않았으므로 다음은 모두 **미검증**이다.

- `require("sharp")`
- sharp Linux native runtime과 libvips load
- 합성 PNG metadata와 image preprocessing
- image OCR mock
- PDF extraction smoke
- 대표 HWP 4건 다운로드와 container 검증
- kordoc subprocess exit code
- raw/cleaned 문자 수와 표·행·셀 수
- Windows/Linux raw·normalized SHA-256 비교
- replacement character와 줄바꿈 차이

partial tree에서 direct dependency가 표시된 결과를 이 항목들의 성공으로 사용하지 않는다. 대표 4건을 재실행하거나 DB에 저장하지 않았고 나머지 22건도 처리하지 않았다.

## 8. RSS, timeout, process 종료와 cleanup

이번에 측정한 668,340KiB와 686,656KiB는 **npm 설치 process의 maximum RSS**다. kordoc HWP subprocess peak RSS가 아니다.

dependency 설치가 완료되지 않아 Linux kordoc 정상 종료, 연속 4건 후 process 누적, timeout, 직접 child와 descendant process tree 종료는 실행하지 못했다. 현재 `runSubprocess()`는 직접 child에 `SIGKILL`을 보내지만 detached process group이나 PGID kill을 사용하지 않아 descendant process tree 종료는 여전히 보장되지 않는다.

검증 종료 후 다음을 정리했다.

- 검증용 partial `node_modules`
- npm log
- swapfile

최종 상태:

- root 여유 약 3.0GiB
- swap 0
- `moira-backend` online
- 운영 디렉터리와 PM2 설정 변경 없음
- DB 쓰기 0
- HWP 처리 0

## 9. 보안 감사

완성된 Linux production tree가 없으므로 해당 tree의 `npm audit --omit=dev`와 최종 `npm ls`는 수행할 수 없었다. partial tree 결과로 취약점 수를 확정하지 않는다.

기존 Windows 전체 optional 설치 감사에서는 kordoc optional Transformers/ONNX/sharp와 MCP SDK 계열 advisory가 확인됐다. 실제 Windows HWP 실행 loaded module에는 Transformers, ONNX Runtime, PDFium과 optional sharp가 없었다. Linux에서는 설치와 실행 모두 완료되지 않아 같은 결론을 재검증하지 못했다.

`npm audit fix --force`, dependency override, downgrade, lockfile 수동 편집은 수행하지 않았다.

## 10. 실제 측정값과 미검증 항목 구분

실제 측정:

- Ubuntu·kernel·architecture·Node/npm·RAM·filesystem
- 두 installation attempt의 elapsed, partial size와 maximum RSS
- 1차 ENOSPC와 2차 signal 9
- 정리 후 disk/swap/PM2 상태

partial 결과:

- direct dependency 이름과 version 일부
- 1.2GiB/1.6GiB까지 생성된 불완전 `node_modules`
- extraneous package가 포함된 비정상 tree

미검증:

- 완료된 A 설치 크기·파일 수·시간
- sharp·image OCR·PDF runtime
- HWP 대표 4건과 출력 일치
- kordoc peak RSS·timeout·process tree·cleanup
- 최종 Linux 보안 감사

후속 판단 필요:

- 더 큰 EC2 root volume에서 A가 수용 가능한지
- 별도 build artifact로 운영 디스크와 설치 peak를 분리할지
- A가 과도할 경우 C를 선택할지

## 11. 최종 선택과 다음 단계

선택은 **D. 아직 결정 불가**다.

- A: 실제 실행했지만 두 번 모두 설치 완료 전에 실패했다.
- B: 현재 npm package-type flag로 부모별 optional 선택이 불가능하다.
- C: 설계 가능하지만 더 큰 disk/build 환경에서 A를 완료해 보기 전에는 확정하지 않는다.

전체 26건 실행은 허용할 수 없다. 다음 검증은 운영 서버가 아닌, 충분한 disk와 memory를 가진 깨끗한 Ubuntu 24.04·Node.js 22 환경에서 진행한다.

1. swap과 `node_modules`를 포함한 설치 peak를 수용할 disk를 확보한다.
2. `set -o pipefail`을 적용하거나 npm exit code를 별도로 보존해 pipeline 상태 오판을 막는다.
3. `npm ci --omit=dev` 완료와 clean `npm ls`를 확인한다.
4. 최종 tree 크기·파일 수·설치 시간과 `npm audit --omit=dev`를 기록한다.
5. sharp native smoke, image OCR mock과 PDF smoke를 통과시킨다.
6. 대표 HWP 4건을 DB 무쓰기 dry-run하여 Windows 결과와 비교한다.
7. kordoc 파일별 peak RSS, timeout, child/process-tree와 temp cleanup을 확인한다.
8. EC2 disk·memory·배포 시간 한도에 따라 A 또는 C를 선택한다.

위 검증과 운영 승인 전에는 현재 운영 서버에 적용하거나 나머지 22건을 실행하지 않는다.
