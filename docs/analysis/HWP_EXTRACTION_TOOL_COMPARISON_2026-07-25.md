# HWP 본문 추출 도구 비교 결과

## 1. 비교 목적과 범위

활성 HWP/HWPX 26건의 구조 분석에서 확인된 OLE/CFB HWP 5.x 대표 표본 4건으로 본문 추출 도구를 비교했다. 이번 단계에서는 DB 저장, 추출 상태 변경, 정식 HWP CLI, HWPX 본문 추출을 구현하지 않았다.

- 입력 형식: 압축된 `BodyText`, section 1개
- 버전: HWP 5.1.0.1 및 5.1.1.0
- 표본: 지정된 attachment ID 4건
- 동시성: 1
- DB: PostgreSQL `READ ONLY` transaction의 SELECT만 사용
- 원본 및 추출 전문: `apps/backend/.local/hwp-tool-comparison`에만 저장
- 개인정보: 원문과 실제 문장을 이 문서에 포함하지 않음

## 2. 실행 환경

- 분석 일자: 2026-07-25 (Asia/Seoul)
- OS: Windows 11 x64
- Node.js: 22.17.0
- npm: 10.9.2
- Python: MSYS2 CPython 3.12.10
- LibreOffice: 설치되지 않음
- Rust/Cargo: 설치되지 않음
- Backend lint: 프로젝트에 lint script 및 ESLint 설정이 없어 대상에서 제외

## 3. 실제 데이터와 표본

| 구분 | Attachment ID | ProgramCase ID | 파일명 | 크기 | 버전 |
|---|---|---|---|---:|---|
| 표·문단 보존 후보 | `7d6e2509-23a0-431c-b624-b9b7fa70faef` | `c556f364-19f4-482d-8efb-d34b3dbdf936` | `2026_들락날락_강의계획서_금정아이꿈자람 작은도서관_초등 (1).hwp` | 92,672 | 5.1.1.0 |
| 대용량·성능 후보 | `88b3ab83-7b66-44c7-a3c8-e7e0245c770c` | `b14957d3-c6fe-47fc-b698-a66b34e8e352` | `강의계획서(22. 겨울방학).hwp` | 4,425,216 | 5.1.0.1 |
| 본문형 후보 | `bd7ffc09-ef85-4288-a44c-4b97dfc9ddf1` | `b1e9ca8e-ddb6-4491-9674-804a155be9bf` | `소설가의 삶과 문화콘텐츠 스토리텔링(금정북파크_8.11.).hwp` | 421,888 | 5.1.0.1 |
| 소형 기준 후보 | `41a0d307-62e4-42de-a199-93aaf02419a0` | `21d02b45-0ebe-4394-9d71-10743c5966f5` | `강의계획서(책 속에 퐁당 독서 놀이).hwp` | 52,736 | 5.1.0.1 |

네 파일 모두 비공개 로컬 비교 전용이다. 강사명, 연락처 등 포함 가능성을 원문 전체 검토로 배제하지 않았으므로 PR 스크린샷이나 공개 fixture로 사용하면 안 된다.

## 4. 비교 후보와 정확한 상태

| 후보 | 확인 버전 | 유지보수 상태 | 라이선스 | 실행 결과 |
|---|---|---|---|---|
| `hwp.js` | 0.0.3 | npm 최신 release 2020-10-01, 오래됨 | Apache-2.0 | Node 22에서 4/4 성공 |
| `kordoc` | 4.2.7 | npm publish 2026-07-22, 활발함 | MIT | Node 22에서 4/4 성공 |
| `pyhwp` | 0.1b15 | PyPI 최신 prerelease 2020, 공식 문서 요구 Python은 3.8까지 명시 | AGPL-3.0 | Python 3.12 설치 실패, 표본 미실행 |
| LibreOffice headless | 미설치 | 공식 CLI 변환 기능 존재 | MPL-2.0 / LGPL-3.0+ 배포 | 현재 Windows 환경 미설치, 표본 미실행 |
| Rust 후보 | 조사만 수행 | `openhwp` 등 유지보수 후보 존재 | 후보별 MIT 등 | Cargo 미설치, binding/빌드 범위 제외 |

공식 근거:

- [`hwp.js` 저장소와 LICENSE](https://github.com/hahnlee/hwp.js)
- [`kordoc` 저장소와 LICENSE](https://github.com/chrisryugj/kordoc)
- [`pyhwp` 저장소와 LICENSE](https://github.com/mete0r/pyhwp)
- [LibreOffice CLI conversion filter 문서](https://help.libreoffice.org/latest/ug/text/shared/guide/convertfilters.html)
- [`openhwp` 저장소](https://github.com/openhwp/openhwp)

## 5. 설치 결과와 배포 크기

### hwp.js

- 설치: 성공
- 설치 명령: `npm install --prefix .local/hwp-tool-comparison/node-runtime hwp.js@0.0.3`
- 로컬 설치 크기: 약 3.4MB
- 의존성: `cfb`, `pako` 등 소수
- Node 22: 공식 buffer option을 사용하면 실행 가능
- 최초 입력 형태를 지정하지 않았을 때 `input.replace is not a function`으로 실패했으며, 공식 CFB option인 `{ type: "buffer" }` 적용 후 성공

### kordoc

- 설치: 성공
- 설치 명령: `npm install --prefix .local/hwp-tool-comparison/kordoc-runtime kordoc@4.2.7`
- 로컬 설치 크기: 약 745.8MB
- Node engine: `>=18`
- Windows CLI 실행: 성공
- HWP만 필요한 용도에 비해 PDF/OCR 등 광범위한 의존성이 함께 설치되는 것이 운영 비용 위험

### pyhwp

- Python 3.12 가상환경 생성: 성공
- `pyhwp==0.1b15` 설치: 실패
- 실패 단계: `cryptography 49.0.0` build dependency
- 실패 원인: 현재 MSYS2 Python 3.12 플랫폼용 wheel 부재, Rust toolchain 미설치
- 억지로 Rust 또는 구버전 cryptography를 설치하지 않았음
- Python 3.12 서버 배포 적합성을 확인하지 못했으므로 최종 후보로 추천할 수 없음

### LibreOffice

- Windows 개발 환경에 `soffice` 없음
- 실제 HWP→TXT/HTML/DOCX 변환 미실행
- Ubuntu 24.04 재현성과 설치 크기·cold start는 실측하지 못함
- 공식 CLI 문서상 headless conversion은 가능하지만 이 데이터의 HWP 5.x 품질은 확인되지 않음

## 6. 표본별 성공·문자 수·실행 시간

각 시간은 별도 Node subprocess를 시작해 측정했으므로 warm worker가 아닌 cold-start 성격을 포함한다.

| 표본 | 도구 | 성공 | raw 문자 | 공백 제외 | 줄 | 빈 줄 | 실행 시간 | RSS |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 표·문단 | hwp.js | Y | 5,971 | 4,817 | 54 | 0 | 121ms | 45.2MB |
| 표·문단 | kordoc | Y | 8,644 | 7,712 | 51 | 3 | 329ms | 미측정 |
| 대용량 | hwp.js | Y | 3,752 | 2,821 | 101 | 0 | 315ms | 71.7MB |
| 대용량 | kordoc | Y | 8,997 | 8,141 | 118 | 17 | 434ms | 미측정 |
| 본문형 | hwp.js | Y | 678 | 521 | 8 | 0 | 153ms | 47.8MB |
| 본문형 | kordoc | Y | 1,057 | 921 | 10 | 2 | 342ms | 미측정 |
| 소형 | hwp.js | Y | 555 | 409 | 20 | 0 | 125ms | 43.3MB |
| 소형 | kordoc | Y | 1,488 | 1,346 | 22 | 2 | 334ms | 미측정 |

`kordoc`의 raw 문자 수가 더 큰 주된 이유는 표를 HTML `<table>/<tr>/<td>` 구조로 출력하기 때문이다. 마크업을 제거하고 한글·영문·숫자만 정규화했을 때 두 도구의 문자 순서는 네 표본 모두 100% 동일했다.

## 7. 본문 품질

| 평가 항목 | hwp.js | kordoc |
|---|---|---|
| 한글 완성형 문자 | 4건 모두 추출 | 4건 모두 추출 |
| U+FFFD replacement | 4건 모두 0 | 4건 모두 0 |
| 자모 분리 | 관찰되지 않음 | 관찰되지 않음 |
| 제목·주요 비민감 키워드 | 두 도구가 동일하게 보존 | 두 도구가 동일하게 보존 |
| 날짜형 값 | 표본별 탐지 수가 hwp.js와 동일 | 표본별 탐지 수가 hwp.js와 동일 |
| 바이너리 제어문자 | 0 | 0 |
| Private Use Area | 본문형 표본에서 3개 | 0 |

두 도구의 핵심 텍스트 순서가 동일하므로, HWP record 해석의 본문 정확도는 대표 4건에서 동등했다. `kordoc`은 본문형 표본의 PUA 3개를 결과에 남기지 않아 저장 전 정규화 측면에서 우세했다.

## 8. 문단 순서와 줄바꿈

- 정규화된 한글·영문·숫자 positional sequence가 모든 표본에서 일치했다.
- hwp.js는 빈 줄 없이 비교적 압축된 plain text를 생성했다.
- kordoc은 block 사이에 빈 줄을 두어 Markdown 문단 경계가 더 명확했다.
- 표·문단 표본에서 hwp.js 결과에는 1글자짜리 줄 2개가 있었고 kordoc에는 없었다.
- 두 도구 모두 글자 단위로 전체 문서를 분리하거나 머리말을 무작위로 섞는 현상은 통계상 관찰되지 않았다.

원본 HWP를 렌더링한 화면과 줄 단위 대조는 수행하지 않았다. 따라서 “원본 레이아웃과 완전히 동일한 순서”까지 입증한 것은 아니다.

## 9. 표 텍스트 평가

| 표본 | 추정 표 수 | hwp.js 표현 | kordoc 표현 |
|---|---:|---|---|
| 표·문단 | 2 | `[TABLE]`, tab 구분 38행 | HTML table 2개, 42행, 138셀 |
| 대용량 | 6 | `[TABLE]`, tab 구분 72행 | HTML table 6개, 77행, 259셀 |
| 본문형 | 1 | `[TABLE]`, tab 구분 4행 | HTML table 1개, 4행, 11셀 |
| 소형 | 1 | `[TABLE]`, tab 구분 16행 | HTML table 1개, 16행, 48셀 |

- 두 도구 모두 표 셀 텍스트를 추출했다.
- hwp.js adapter는 행을 줄, 셀을 tab으로 표현해 가볍지만 `rowSpan/colSpan`과 명시적 셀 구조가 결과에 남지 않는다.
- kordoc은 표를 HTML로 보존해 행·열·셀 경계 및 병합 구조를 후속 처리하기 쉽다.
- 마크업을 제거한 실제 문자 순서는 두 도구가 동일했다.
- 표 결과를 실제 렌더링 화면과 셀별로 대조하지 않았으므로 병합 셀 정확도를 완전히 검증한 것은 아니다.

## 10. 라이선스 검토

이 항목은 기술 검토이며 법률 의견이 아니다.

| 후보 | LICENSE | 직접 의존성 | 개발 도구 | 서버 subprocess | 공개·배포 의무 판단 |
|---|---|---|---|---|---|
| hwp.js | Apache-2.0 | 기술적으로 가능 | 가능 | 가능 | notice·license 의무 준수 필요, 일반적으로 허용적이나 최종 정책 확인 필요 |
| kordoc | MIT | 기술적으로 가능 | 가능 | 가능 | 저작권·license 고지 필요, 최종 사내 정책 확인 필요 |
| pyhwp | AGPL-3.0 | 추가 법률 검토 필요 | 비공개 비교 도구도 정책 확인 필요 | 네트워크 서비스와 결합 시 의무 범위 추가 검토 필요 | 최종 구현 채택 전 법률 검토 필수 |
| LibreOffice | MPL-2.0 / LGPL-3.0+ | 라이브러리 직접 통합은 별도 검토 | 가능 | 독립 프로그램 호출 가능성은 있으나 배포 조건 검토 필요 | 서버 이미지 재배포 시 notice/source 제공 범위 확인 필요 |

`pyhwp`는 설치 실패와 AGPL 불확실성이 동시에 있어 이번 결과로 최종 구현 후보라 단정할 수 없다.

## 11. Windows·Ubuntu 운영 적합성

### hwp.js

- Windows Node 22 실측 성공
- 순수 Node 의존성이라 Ubuntu 24.04 재현 가능성이 높음
- 설치 크기가 작고 기존 backend와 동일 runtime
- release 노후화와 비정상 문서 안전성 테스트 부족이 위험

### kordoc

- Windows Node 22 CLI 실측 성공
- 공식 engine이 Node 18+이며 저장소가 Windows/Linux 사용을 안내
- HWP 표 구조와 정규화 결과가 우수
- 약 745.8MB의 설치 크기는 현재 전체 dependency tree 기준으로 큼
- HWP 전용 최소 dependency 구성이 가능한지 다음 단계에서 확인 필요

### pyhwp

- 현재 Python 3.12 환경에서 설치 실패
- subprocess timeout·출력 제한은 기존 `runSubprocess()`로 적용 가능하지만 설치·라이선스 문제가 선행
- Ubuntu에서 Rust/cryptography build를 추가하면 가능할 수 있으나 이번 단계에서 검증하지 않음

### LibreOffice

- 현재 Windows 환경에 없어 미실행
- Ubuntu 패키지 설치, profile 격리, macro 비활성화, 프로세스 kill 검증이 필요
- 최종 parser가 아니라 품질 baseline으로만 유지

## 12. 보안과 프로세스 격리

- DB 행은 `READ ONLY` transaction으로만 조회했다.
- URL은 기존 allowlist·SSRF·redirect 재검증을 사용하는 `downloadAttachment()`로 처리했다.
- 원본은 기존 임시 job 디렉터리에만 저장했다.
- 도구는 `runSubprocess()`의 `shell: false`, 60초 timeout, stdout/stderr 제한으로 실행했다.
- 비교 결과는 5MB로 제한했다.
- 각 표본은 순차 실행했으며 실패가 다음 표본을 중단하지 않게 했다.
- kordoc 임시 변환 파일은 `finally`에서 삭제했다.
- 다운로드 job 디렉터리는 각 표본의 `finally`에서 cleanup했다.
- 실행 후 attachment 임시 루트에 남은 job 항목과 `kordoc-output.md`가 없음을 확인했다.
- `soffice` 및 Python 비교 subprocess는 실행되지 않았다.

별도의 OS sandbox, CPU quota, Windows Job Object, Linux cgroup은 적용하지 않았다. 최종 서버 구현 전에 process-level resource limit이 추가로 필요하다.

## 13. 최종 분류

### 최종 구현 권장: kordoc 4.2.7의 HWP parser

근거:

1. 대표 4건에서 4/4 성공했다.
2. hwp.js와 정규화된 핵심 문자 순서가 100% 일치했다.
3. 표를 구조화된 HTML로 보존해 셀·행 후처리에 유리했다.
4. PUA 문자를 결과에서 제거했다.
5. Node 22 및 Windows에서 바로 실행됐고 공식 engine은 Node 18+이다.
6. MIT로 명시되어 pyhwp보다 라이선스 위험이 낮다.
7. 2026-07-22까지 release가 확인되어 hwp.js보다 유지보수 상태가 낫다.

조건:

- 전체 `kordoc` dependency를 그대로 production에 넣기 전에 HWP parser만 최소 의존성으로 사용할 수 있는지 확인한다.
- 약 745.8MB 설치 크기와 transitive dependency 보안 검토를 통과해야 한다.
- direct API와 CLI 중 더 작은·안전한 호출 방식을 확인한다.

### 차선책: hwp.js 0.0.3

- 4/4 성공, 가장 빠르고 설치 크기가 작다.
- 표 셀 텍스트와 핵심 문자 순서는 kordoc과 동일했다.
- Apache-2.0이며 Node 직접 통합이 쉽다.
- 다만 release가 2020년에 멈췄고, 표 구조 보존을 위해 자체 adapter 유지보수가 필요하다.

### 비교 baseline: LibreOffice headless

- 현재 환경 미설치로 실제 비교하지 못했다.
- Ubuntu staging에서 HWP→HTML 또는 DOCX 변환을 별도 검증할 때만 baseline으로 사용한다.

### 제외: pyhwp 0.1b15

- Python 3.12 설치 실패
- 공식 배포·지원 정보가 오래됨
- AGPL-3.0의 서버 사용 영향은 추가 법률 검토 필요
- 이번 환경에서는 표본 결과를 생성하지 못했으므로 성능·품질 비교 대상에서 제외

### 조사만 수행: Rust 후보

- 명확한 라이선스의 유지보수 후보는 있으나 Cargo가 없고 Rust binding 개발은 이번 범위를 벗어남
- kordoc과 hwp.js가 실제 4건을 처리했으므로 이번 단계에서 빌드 비용을 추가하지 않음

## 14. 알려진 한계

- 대표 4건은 모두 정상·비암호화·비배포용·section 1개다.
- 손상 CFB, 암호화, 배포용, 다중 section의 안전한 실패를 실제 파일로 비교하지 않았다.
- 원본 렌더 화면과 셀별 대조를 수행하지 않았다.
- kordoc RSS 최대값은 이번 CLI 실행에서 측정하지 못했다.
- LibreOffice와 pyhwp는 실제 추출 결과가 없다.
- Windows 실측만 수행했으며 Ubuntu 24.04는 문서·runtime 조건만 조사했다.
- 결과 전문의 개인정보를 자동 탐지하는 검사는 보조 수단일 뿐 완전한 비식별 검증이 아니다.

## 15. 테스트 결과

- `npm.cmd run build`: 통과
- `npm.cmd run test:hwp-tool-comparison`: 통과
- hwp.js 0.0.3 실제 표본: 4/4 성공
- kordoc 4.2.7 실제 표본: 4/4 성공
- pyhwp 0.1b15 설치: 실패, 실제 표본 미실행
- LibreOffice: 미설치, 실제 표본 미실행
- timeout 후 고아 프로세스: 이번 실행에서 발생하지 않음
- 임시 download job 및 kordoc 변환 파일: 실행 후 잔존 없음
- 결과 파일 크기 제한: 모든 결과 5MB 미만
- 원문·추출 전문 Git 추적 여부: `.local`로 제한
- 문서 내 전화번호·이메일·민감 URL query: 포함하지 않음

## 16. 다음 구현 단계 권장안

1. `kordoc`의 HWP 전용 API와 실제 dependency subset을 조사한다.
2. MIT LICENSE 및 transitive license 목록을 저장소 정책과 대조한다.
3. 대표 표본을 비공개로 유지한 채 direct API 결과와 현재 CLI 결과가 동일한지 검증한다.
4. 손상·암호화·배포용·다중 section 합성 fixture로 timeout 및 오류 코드를 검증한다.
5. Ubuntu 24.04 container에서 install size, cold start, RSS, 4건 결과를 재측정한다.
6. 위 조건을 통과한 뒤에만 HWP dry-run 추출 서비스를 설계하고 DB 저장은 별도 단계로 진행한다.
