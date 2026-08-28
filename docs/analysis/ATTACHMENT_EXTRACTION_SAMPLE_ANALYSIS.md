# 첨부파일 추출 대상과 실행 환경 분석

- 분석일: 2026-07-20
- 브랜치: `feat/attachment-text-extraction`
- 범위: 운영 PostgreSQL 읽기 전용 집계 및 대표 표본 15건 분석
- 주의: 이 문서에는 DB 연결 문자열, API 키, 전체 URL, URL 쿼리 값이 없다.

## 1. 분석 목적

Phase 5 텍스트 추출 파이프라인 구현 전에 실제 `ProgramCaseAttachment` 분포, 다운로드 가능성, 파일 시그니처, PDF 텍스트 레이어, HWP 컨테이너, 이미지 OCR 적합성을 확인했다. DB는 `BEGIN READ ONLY` 트랜잭션으로 조회했고 레코드를 변경하지 않았다. 선정한 15건만 파일별 20초 GET 제한, 30 MiB 상한, 순차 스트리밍 방식으로 임시 다운로드했다.

## 2. 현재 DB 첨부파일 현황

| 항목 | 결과 |
|---|---:|
| 전체 | 237 |
| HWP | 26 |
| PDF | 55 |
| JPG | 125 |
| PNG | 31 |
| 이미지 합계 | 156 |
| `PENDING` | 237 |
| 빈 URL / 빈 파일명 | 0 / 0 |
| 중복 URL 값 | 0 |

사전 공유 수치(237, 이미지 156, PDF 55, HWP 26)와 일치한다. Content-Type과 파일 크기는 DB에 저장되지 않는다. 237개 프로그램에 첨부파일이 각 1개씩 연결되어 프로그램별 개수 분포는 `1개: 237프로그램`이다.

## 3. 현재 `ProgramCaseAttachment` 구조

Prisma 7.8.0 모델은 `id`, `programCaseId`, `fileName`, `fileUrl`, `fileType`, `extractionStatus`, `programCase`, `createdAt`, `updatedAt`으로 구성된다. `ProgramCase`와 다대일 관계이며 삭제는 cascade, 복합 unique는 `(programCaseId, fileUrl)`이다. 상태는 enum이 아닌 필수 `String`이고 현재 값은 모두 `PENDING`이다. 추출 텍스트, 오류, 재시도 횟수, 실제 MIME/크기/hash를 저장할 필드는 없다.

로컬 환경은 Windows 10 계열 AMD64, Node.js 22.17.0이다. 백엔드는 Express/TypeScript(CommonJS, ES2020), Prisma Client 기본 생성 위치인 `node_modules/@prisma/client`, `dotenv/config`, `pg` 및 `@prisma/adapter-pg`를 사용한다. 별도 HTTP 클라이언트와 파일 유틸리티는 현재 의존성에 없다.

## 4. 현재 첨부파일 동기화 방식과 추출 결과 손실 위험

PR #75 대응 브랜치(`feat/program-case-sync-api`, 커밋 `101007f` 등)의 동기화 서비스는 프로그램별 트랜잭션에서 기존 첨부파일을 `deleteMany`한 후 원천 배열 전체를 `createMany`한다. 따라서 첨부 레코드 ID가 매번 바뀌며, 향후 같은 행에 추출 텍스트·상태·오류를 저장하면 재동기화 때 모두 삭제된다. 구현 전 URL 기반 upsert 또는 `(programCaseId, fileUrl)` 기반 보존 갱신으로 바꾸고, 원천에서 사라진 파일을 명시적으로 처리해야 한다.

## 5. 대표 표본 선정 기준

형식별로 서로 다른 프로그램을 우선하고 파일명 정렬 구간을 나눠 오래된/최근 데이터와 파일명 유형을 분산했다. HWP 3, PDF 6, 이미지 6으로 총 15건이다. DB에 크기가 없으므로 크기 층화는 다운로드 후 검증했다. GIF/WEBP는 DB에 없었다. 이미지 표본은 JPG 5와 PNG 1을 포함하며, 실제 렌더링 결과 모두 포스터 또는 강의계획서였다. 일반 사진형을 찾지 못했다는 점은 표본 한계로 남긴다.

## 6. 표본 분석 결과

모든 URL 호스트는 `www.geumjeong.go.kr`이었다. 15건 모두 HEAD 200, GET 200, 리다이렉트 없음, Content-Disposition 없음, 직접 다운로드 가능이었다. 응답은 약 0.47~2.24초였다.

| # | 구분 | attachmentId | programCaseId | sourcePostId | 파일명 | DB/실제 형식 | 크기 | 주요 결과 | 추출 후보 |
|---:|---|---|---|---:|---|---|---:|---|---|
| 1 | HWP | `6ffb7aed-27e9-40b0-9d94-9ff631055f1f` | `e69f3228-b9d9-4eba-a26f-b04f83f82280` | 4224 | `2026_들락날락_강의계획서_..._유치 (2).hwp` | HWP/OLE HWP | 93,696 B | 시그니처 정상 | pyhwp/LibreOffice 검증 |
| 2 | HWP | `7fccf04e-7e5a-4eb6-8757-bfcc34c68c65` | `7b1e6f7a-14f0-418c-adac-f589eae22667` | 2605 | `강의계획서(22. 겨울방학).hwp` | HWP/OLE HWP | 4,425,216 B | 표본 중 최대 | pyhwp/LibreOffice 검증 |
| 3 | HWP | `41a0d307-62e4-42de-a199-93aaf02419a0` | `21d02b45-0ebe-4394-9d71-10743c5966f5` | 2494 | `강의계획서(책 속에 퐁당 독서 놀이).hwp` | HWP/OLE HWP | 52,736 B | 표본 중 최소급 | pyhwp/LibreOffice 검증 |
| 4 | PDF | `5d305e9c-2529-48c6-9ff0-f9c324bf83d7` | `322a6b0f-8d54-4382-8b11-73f857d9bd8f` | 4330 | `(유아)금정아이꿈자람작은도서관 (1).pdf` | PDF/PDF | 1,157,777 B | 4쪽, 1,635자, 마지막 쪽 0자 | PDF.js + 선택 OCR |
| 5 | PDF | `6c0f8395-8a53-4a60-9043-a422e7ad12a8` | `313f851c-0476-48fd-b645-dfc88a06d017` | 3849 | `강의계획서_유치부(금정아이꿈자람).pdf` | PDF/PDF | 65,067 B | 3쪽, 4,830자 | PDF.js |
| 6 | PDF | `03783b62-3b6f-4983-b8e7-45755ebb47de` | `82fbfecd-cf11-4be6-b6f3-6bd59cc4b628` | 2889 | `강의계획서_하반기.pdf` | PDF/PDF | 313,941 B | 15쪽, 7,803자 | PDF.js |
| 7 | PDF | `4b7c7340-85aa-4b4c-87e4-c69ca64adabe` | `56f38c9e-673f-4801-b511-4e9d600b6a83` | 2706 | `강의계획서(상반기).pdf` | PDF/PDF | 651,487 B | 17쪽, 8,459자 | PDF.js |
| 8 | PDF | `46d4b572-1303-45fb-a469-91984cff44ca` | `0104706d-6567-41ee-968a-fa36201c0974` | 2709 | `강의계획서(상반기).pdf` | PDF/PDF | 651,487 B | #7과 바이트 크기·분석값 동일 | PDF.js |
| 9 | PDF | `2e2ae31c-3bb1-47b6-b9b2-80c5392cbe26` | `7148f37d-e963-4ed9-9345-0f5762bbd54c` | 2742 | `강의계획서(풍선아트).pdf` | PDF/PDF | 52,436 B | 1쪽, 102자와 이미지 2개 | PDF.js |
| 10 | 이미지 | `304e7d28-8083-412d-ade4-ec50c3f8158f` | `dc7850a2-694d-4943-b13f-15b21a6c1224` | 2989 | `1인극공연(이영경).jpg` | JPG/JPEG | 674,280 B | 794×1,123 포스터 | OCR |
| 11 | 이미지 | `e1f38a32-5c4e-44bd-9431-32d071503502` | `4ec8cc70-d5c6-40e4-afc9-24a321f78bfa` | 4041 | `2025년 동화나라 하반기 홍보문.jpg` | JPG/JPEG | 1,185,796 B | 2,781×3,933 포스터 | OCR |
| 12 | 이미지 | `2f95bbdc-bb5c-4c05-80d4-71fbbf22d8ed` | `c6cb7c33-e20d-4891-8ddb-668b18828279` | 3853 | `금정강의계획서001.jpg` | JPG/JPEG | 165,683 B | 992×1,403 계획서 | OCR |
| 13 | 이미지 | `ead7c478-289a-482a-839c-f5f614757e6a` | `bbb55504-7ea2-41a6-8f33-81ecca162415` | 3565 | `삶의 지혜를 ... 그림책(최종)001.jpg` | JPG/JPEG | 150,778 B | 992×1,403 계획서 | OCR |
| 14 | 이미지 | `2380a8c5-70bf-467a-a4cb-9c5f924742f5` | `e3d832f2-84f6-40d5-90bc-913c433308b8` | 4110 | `...크리스마스계획서 (1) (1)001.jpg` | JPG/JPEG | 415,912 B | 992×1,403 계획서 | OCR |
| 15 | 이미지 | `818bd105-6fcc-48c2-8798-cf732be88f5e` | `c22a7dbd-a864-499c-b163-4ec1d0e907a1` | 3683 | `조이풀 잉글리쉬 강의 계획서.png` | PNG/PNG | 365,435 B | 1,087×1,503, 4쪽 축소 배치 | 분할 후 OCR |

확장자, 응답 Content-Type, magic bytes가 15건 모두 일치했고 HTML 오류 페이지와 빈 파일은 없었다. URL은 의도적으로 기록하지 않았다.

## 7. PDF 분석 결과

6개 모두 암호화되지 않았고 pypdf 파싱 및 Poppler 첫 페이지 렌더링에 성공했다. 5개는 모든 페이지에 100자 이상 텍스트가 있어 텍스트 PDF, #4는 앞 3쪽에 516~602자, 마지막 쪽에 0자가 있어 혼합 PDF로 분류했다. 스캔 PDF와 오류 PDF는 0개다. 한 파일에서 Poppler가 stream length 경고를 냈지만 렌더링과 텍스트 추출은 성공했으므로 손상으로 단정하지 않고 “관대한 파서 필요”로 기록한다.

권장 판별은 문서 전체 고정 임계값보다 페이지별로 한다. 공백 제외 100자 이상이면 텍스트 페이지 후보, 30자 미만이면서 렌더 이미지가 있으면 OCR 후보로 두되, 페이지 면적·글자 밀도와 추출 문자열의 한글/영문 비율도 함께 본다. 텍스트 페이지와 OCR 후보 페이지가 함께 있으면 혼합형으로 처리한다. PDF 처리는 순수 Node.js인 [Mozilla PDF.js](https://github.com/mozilla/pdf.js)(Apache-2.0)를 1차 후보로 하고, 파싱 실패/렌더링 및 OCR 입력 생성에는 Poppler CLI를 보조 후보로 둔다.

## 8. HWP 분석 결과

3개 모두 `D0 CF 11 E0 A1 B1 1A E1` 시그니처의 OLE Compound File 기반 HWP이며 ZIP 기반 HWPX는 0개다. 크기와 헤더는 정상이지만 현재 저장소/Node 런타임에는 OLE 내부 스트림과 암호화 플래그를 검사할 도구가 없어 암호화·본문/표 추출 성공 여부는 확인 필요다. HWPX는 ZIP/XML이므로 별도 분기로 처리해야 한다.

후보는 다음과 같다.

| 후보 | 라이선스 | Node 호환 | 한글/표 | EC2/시스템 요구 | 한계 |
|---|---|---|---|---|---|
| [pyhwp](https://pyhwp.readthedocs.io/en/latest/) | AGPL-3.0+ | Python subprocess | HWP v5, `hwp5txt`; 표 구조 별도 검증 | Python | 오래된 베타 계열, AGPL 검토 필요 |
| [LibreOffice headless](https://www.libreoffice.org/licenses/) | MPL-2.0 중심 | CLI subprocess | HWP import 후 변환 가능성 | LibreOffice 패키지/폰트 | 무겁고 HWP 버전별 호환 검증 필요 |
| 한컴 공개 규격 기반 전용 파서 | 구현물에 따름 | 직접 통합 가능 | 제어 가능 | 없음 또는 Node만 | 개발·보안·표 처리 비용 큼 |

현재 표본이 모두 OLE HWP이므로 HWPX 전용 ZIP 파서만으로는 부족하다. 2단계에서 pyhwp와 LibreOffice를 이 3개로 실제 비교하고 라이선스 검토 후 선택해야 한다.

## 9. 이미지 분석 결과

JPEG 5개, PNG 1개 모두 RGB, 방향 EXIF 없음, 비애니메이션 1프레임이다. 렌더링 육안 검토에서 전부 글자가 많은 포스터/강의계획서였으므로 OCR 적합 표본은 6개, 일반 사진/텍스트 없음은 0개다. 특히 #15는 한 이미지 안에 4쪽이 축소 배치되어 페이지 영역 감지·분할·확대가 필요하다. #10~#11은 색상 배경과 장식 요소가 있어 대비 보정, #12~#14는 표 선 제거/기울기 보정이 유효하다.

로컬에는 Tesseract가 설치되어 있지 않아 임시 OCR 품질 검증은 수행하지 못했다. [Tesseract 공식 설치 문서](https://github.com/tesseract-ocr/tessdoc/blob/main/Installation.md)는 Apache-2.0 엔진과 별도 언어 데이터를 설명하고, 공식 데이터에는 한국어 `kor.traineddata`가 있다. EC2에서 `tesseract-ocr`, 한국어/영어 데이터와 이미지 전처리 도구를 설치한 뒤 원본 1~2개로 정확도를 확인한다.

## 10. 다운로드 정책 제안

- 허용 도메인: 초기에는 DB 표본에서 확인된 `www.geumjeong.go.kr` 정확 일치. 향후 도메인은 설정 기반 allowlist로 승인한다.
- 타임아웃: HEAD 10초, GET 20초. connect/read를 구분할 수 있으면 각각 제한한다.
- 최대 크기: 현재 확인 최대 4,425,216 B이고 초기 운영 상한은 30 MiB가 충분하다. DB 전체의 실제 크기 분포 수집 후 조정한다.
- 리다이렉트: 최대 3회, 매 단계 HTTPS와 allowlist를 재검사해 SSRF를 막는다.
- 재시도: 네트워크/5xx만 지수 backoff 1~2회. 4xx와 형식 오류는 자동 반복하지 않는다.
- 스트리밍: Content-Length 사전 검사 후 스트림 누적 바이트를 다시 검사한다. 전체 파일을 메모리에 모으지 않고 임시 파일에 쓴다.
- 검증: HTTP 상태, 최종 URL, MIME, Content-Disposition, magic bytes를 교차 확인하고 HTML/빈 파일을 거부한다.
- 임시 파일: 작업별 임의 디렉터리, 제한 권한, 처리 직후 삭제, 시작 시 잔여 파일 청소 정책을 둔다.

## 11. 형식별 추출 도구 후보

| 형식 | 후보 | 라이선스 | Node/한글 | 시스템 패키지 | 유지보수성과 한계 |
|---|---|---|---|---|---|
| PDF | PDF.js (`pdfjs-dist`) | Apache-2.0 | Node 가능, Unicode 텍스트 | 없음 | 1차 텍스트 추출에 적합; 복잡/손상 PDF fallback 필요 |
| PDF 렌더 | Poppler (`pdftoppm`, `pdfinfo`) | GPL 계열 구성 확인 필요 | CLI, 한글 폰트 영향 | 필요 | 성숙하지만 프로세스/패키지 관리 필요 |
| HWP | pyhwp | AGPL-3.0+ | Python, 한글 HWP v5 | Python | CLI 연동·라이선스·유지보수 검토 필요 |
| HWP | LibreOffice headless | MPL-2.0 중심 | CLI 변환 | LibreOffice/폰트 | 설치 크기와 버전별 변환 품질 |
| 이미지/PDF OCR | Tesseract + `kor`/`eng` | Apache-2.0 | Node wrapper 또는 CLI, 한국어 지원 | 엔진/언어 데이터 | 표·작은 글자·장식 배경은 전처리와 품질 측정 필요 |

순수 Node.js는 배포가 단순하지만 HWP/OCR 범위가 약하다. Python 보조 프로세스는 라이브러리 선택 폭이 넓지만 별도 런타임과 의존성 고정이 필요하다. OS 패키지/CLI는 검증된 렌더·OCR 기능을 제공하지만 EC2 이미지 빌드, 보안 업데이트, 프로세스 제한이 필요하다. 특정 도구는 아직 최종 선택하지 않는다.

## 12. 권장 파이프라인

```text
작업 큐
→ allowlist/SSRF 검증과 제한 스트리밍 다운로드
→ MIME + magic bytes 실제 형식 판별
→ PDF / OLE HWP / HWPX / 이미지 분기
→ 페이지별 텍스트 추출 또는 선택 OCR
→ 정규화·중복 공백 제거·품질 지표 계산
→ 상태·결과·오류·도구 버전 저장
→ 임시 파일 삭제
```

PDF는 먼저 텍스트 레이어를 추출하고 페이지 단위로 OCR 여부를 정한다. HWP는 격리된 subprocess/worker에서 시간·메모리를 제한한다. 이미지 OCR은 EXIF 회전, 문서 영역 검출, 분할, 확대, 회색조/대비/기울기 보정 후 `kor+eng`를 사용한다.

## 13. 다음 구현 단계 제안

1. Prisma에 실제 형식, MIME, 바이트 크기, checksum, 추출 상태 enum, 텍스트, 오류 코드/메시지, 시도 횟수, 도구 버전, 처리 시각을 설계한다. 큰 본문은 별도 1:1 테이블도 검토한다.
2. 첨부파일 동기화를 URL 기준 보존 upsert로 바꾸고 추출 결과를 원천 메타데이터 갱신과 분리한다.
3. allowlist, SSRF 방어, timeout/redirect/size 제한, 스트리밍, magic bytes 검증을 공통 다운로드 모듈로 만든다.
4. PDF.js 기반 텍스트 추출과 페이지별 선택 OCR을 구현한다.
5. HWP 도구 후보를 3개 표본으로 비교해 표·암호화·오류 동작과 라이선스를 확정한다.
6. 작업 큐, lease/재시도, idempotency, checksum 중복 제거, 관측 지표를 설계한다.

## 14. 확인이 필요한 사항

- EC2 운영체제, 아키텍처, CPU, 메모리, 임시 디스크, Docker/PM2 사용 여부
- EC2에 Python, LibreOffice, Poppler, Tesseract 및 한국어 폰트를 설치할 권한과 배포 방식
- HWP 3개 내부 암호화 플래그, 손상 여부, 표 텍스트의 실제 추출 품질
- HWPX가 향후 유입될 가능성과 테스트 파일 확보
- 일반 사진/GIF/WEBP 표본 확보 및 OCR 생략 기준
- 전체 237건의 실제 Content-Length 분포와 30 MiB 상한의 최종 적정성
- #7과 #8이 실제 동일 바이트인지 checksum으로 확인하고 중복 처리 정책 결정
- 추출 텍스트 보관 기간, 최대 길이, 개인정보/저작권 정책
- PR #75 동기화 로직과 본 파이프라인의 병합 순서

## 검증 및 정리 기록

- DB: 읽기 전용 트랜잭션, 총 237건 집계 성공
- HTTP: 표본 15건 HEAD/GET 200, 실패 0
- 형식: 15건 모두 확장자/MIME/magic bytes 일치
- PDF: pypdf 구조 검사와 Poppler 첫 페이지 렌더링 성공
- 이미지: Pillow 메타데이터 검사와 축소 렌더링 육안 확인
- 임시 원본, 렌더 이미지, 검사 스크립트, URL 포함 결과 파일은 보고서 완료 후 삭제한다.
