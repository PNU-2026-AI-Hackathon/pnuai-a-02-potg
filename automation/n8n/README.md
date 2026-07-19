# 금정구 작은도서관 프로그램 크롤링

이 디렉터리는 금정구 공공예약서비스의 작은도서관 행사·교육 프로그램 사례를 수집하는 n8n 워크플로우와 검증 결과를 관리합니다. 워크플로우는 수동으로 실행하며, 프로그램 목록과 상세 페이지를 순서대로 요청한 뒤 공통 DTO로 정리합니다.

- 수집 대상: [금정구 공공예약서비스 작은도서관 프로그램](https://www.geumjeong.go.kr/booking/index.geumj?menuCd=DOM_000000901008000000)
- 최종 워크플로우: [`geumjeong-program-crawler-workflow.json`](./geumjeong-program-crawler-workflow.json)
- 전체 프로그램 349건: [`data/geumjeong-programs-349.json`](./data/geumjeong-programs-349.json)
- 전체 실행 요약: [`data/geumjeong-crawl-summary-349.json`](./data/geumjeong-crawl-summary-349.json)

기존 `geumjeong-small-library-crawler.json`은 초기 워크플로우이며, 전체 크롤링과 예외 처리가 반영된 최종본은 `geumjeong-program-crawler-workflow.json`입니다.

## 처리 흐름

```text
Manual Trigger
→ 수집 설정
→ 목록 페이지 요청 및 페이지네이션
→ 목록 HTML 추출
→ 프로그램별 항목 생성
→ ID 및 URL 중복 제거
→ 상세 페이지 순차 요청
→ 상세 정보 추출
→ 프로그램 DTO 생성
→ DTO 검증
→ 최종 중복 제거
→ 전체 실행 결과 요약
```

## 안전 설정

최종 실행에는 다음 상한과 요청 간격을 적용했습니다.

```text
maxPages: 50
maxPrograms: 500
requestDelaySeconds: 1
```

목록 응답에서 실제 전체 페이지 수를 확인하며, 이번 실행에서는 35페이지에서 자동 종료되었습니다. 상세 페이지는 한 번에 1건씩 순차 요청하고 요청 사이에 1초를 기다립니다.

## 예외 처리

- 상세 요청 실패 시 최대 3회 시도합니다.
- 재시도 사이에 2초를 기다립니다.
- 한 프로그램의 요청이 실패해도 전체 실행을 중단하지 않습니다.
- 실패한 게시글 ID, URL, 상태 코드와 오류 메시지를 결과에 기록합니다.
- 2026-07-19 최종 실행에서는 상세 요청 실패가 0건이었습니다.

## 전체 실행 검증 결과

- 검증 일시: 2026-07-19
- 목록 페이지: 35개
- 발견 프로그램: 349건
- ID 중복: 0건
- URL 중복: 0건
- 상세 요청 성공: 349건
- 상세 요청 실패: 0건
- 파싱 경고 프로그램: 237건
- 첨부파일 포함 프로그램: 237건
- 전체 첨부파일: 237개
  - 이미지: 156개
  - PDF: 55개
  - HWP: 26개
- 최종 프로그램: 349건
- 실행 시간: 1,109초(약 18분 29초)

237건의 파싱 경고는 모두 `세부 회차 정보가 첨부파일에만 존재할 수 있습니다.`이며 크롤링 실패가 아닙니다.

## 알려진 제한 사항

- 첨부파일은 URL, 파일명, 형식 등 메타데이터만 수집합니다.
- JPG·PNG 이미지 OCR은 구현하지 않았습니다.
- PDF와 HWP 본문 추출은 구현하지 않았습니다.
- 첨부파일 내부의 회차 정보는 현재 `sessions`에 포함되지 않을 수 있습니다.
- 이 경우 오류 대신 `parseWarnings`에 `세부 회차 정보가 첨부파일에만 존재할 수 있습니다.`를 기록합니다.

첨부파일 텍스트 추출은 후속 이슈에서 진행합니다.

## 현재 범위에서 제외한 작업

- PostgreSQL 저장
- Prisma 모델 및 마이그레이션
- Express 저장 API 및 Upsert
- 첨부파일 텍스트 추출
- 임베딩, pgvector, RAG
- 모이라 스튜디오 연동
- 정기 실행

다음 단계는 **프로그램 사례 DB 스키마 설계 및 Prisma 마이그레이션**입니다.

## n8n에서 가져오기

1. n8n의 워크플로우 화면에서 **Import from File**을 선택합니다.
2. `geumjeong-program-crawler-workflow.json`을 선택합니다.
3. 가져온 노드와 연결, 요청 URL 및 실행 옵션을 확인합니다.
4. 필요한 인증이 추가되는 경우 n8n에서 credentials를 별도로 설정합니다.

저장된 최종 워크플로우에는 Credential 값, API 키, 비밀번호, 인증 토큰, 쿠키, pinned data 및 n8n 인스턴스 식별자를 포함하지 않습니다.
