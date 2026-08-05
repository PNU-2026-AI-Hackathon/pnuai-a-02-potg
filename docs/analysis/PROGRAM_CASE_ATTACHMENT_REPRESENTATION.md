# ProgramCase Attachment Representation 구현 분석

## 입력

Issue #114의 dataset snapshot hash `16c7135e1620dd07c9be3b57bcbb60865a34dec2ef19c55438f839f0e73a2e9c`를 입력으로 사용했다.

| 유형 | 고유 binary | Attachment reference |
|---|---:|---:|
| PDF | 12 | 55 |
| JPEG | 83 | 125 |
| PNG | 19 | 31 |
| HWP | 22 | 26 |
| 합계 | 136 | 237 |

외부 URL 재다운로드, 운영 DB 조회·write, Prisma 변경, 기존 OCR/Document/Chunk/Embedding 변경은 수행하지 않았다.

## 복원 가능성과 한계

PDF.js는 12개 PDF 모두에서 page와 text item을 제공했다. text item transform을 보존하지만 이를 PDF line으로 확정하지 않았다.

CLOVA 응답은 field polygon·confidence·lineBreak를 제공하지만 기존 DB에는 평탄화된 text와 평균값만 남아 있다. 따라서 구조 복원에는 snapshot을 사용한 재호출이 필요하다. 이번 단계에서는 fixture parser만 검증했고 실제 API 호출은 하지 않았다.

kordoc은 22개 HWP 모두에서 Markdown 문단과 HTML table을 생성했다. 표의 row/cell/병합 정보는 복원할 수 있지만 HWP 원본 paragraph ID, heading style, page coordinate와 source span은 복원할 수 없다.

## 외부 API 이전 실행 결과

| 항목 | 결과 |
|---|---:|
| 입력 snapshot | 136 |
| PDF 성공/실패 | 12 / 0 |
| PDF page | 63 |
| PDF text item | 7,109 |
| PDF OCR candidate page | 1 |
| HWP 성공/실패 | 22 / 0 |
| HWP paragraph | 62 |
| HWP table | 29 |
| HWP row | 443 |
| HWP cell | 1,483 |
| Heading candidate | 53 |
| OCR field/line/block | 0 / 0 / 0 |
| Section candidate | 118 |
| ProgramCase candidate | 119 |
| AMBIGUOUS | 2 |
| NO_RELIABLE_MATCH | 60 |
| Representation 미생성 snapshot | 102 |
| Dangling reference | 0 |
| Parser/provenance 누락 | 0 |

Representation 미생성 102개는 외부 OCR gate에서 의도적으로 멈춘 image binary다. 이 상태의 dataset hash는 다음과 같다.

```text
487aedc520601328d214e66a92f0c6ec8f38812a701dc8bba8735b91e3e50b7c
```

PDF/HWP, section, candidate와 validation 전체를 다시 실행한 뒤 동일 hash가 생성됐다.

## 테스트

`test:program-case-attachment-representation`은 다음을 외부 API와 DB 없이 검증한다.

- stable serialization과 결정적 record ID
- PDF page 순서/hash/type, OCR 후보와 text item
- OCR field order/polygon/confidence 보존
- lineBreak와 coordinate fallback line 생성
- line/block confidence 및 반복 실행 동일성
- HWP paragraph/table/row/cell/rowspan/colspan/structuralOrder
- heading이 parser-native heading으로 기록되지 않음
- 빈 section 금지와 약한 경계의 전체 attachment 유지
- linked ProgramCase 외 후보 금지
- threshold 미달 `NO_RELIABLE_MATCH`
- 외부 OCR flag·source hash·호출 상한 gate
- output 경로가 source snapshot의 형제 representation 경로인지 검증

## 다음 안전 Gate

실제 OCR 전에 5~10개 고유 image hash를 공유 수, 크기·종횡비, 기존 flattened OCR 문자 수 같은 비민감 통계로 선정한다. 계획에는 hash, 선정 이유, 예상 호출 수, 중복 제거와 개인정보 전송 가능성을 명시한다. 사용자 승인 후에만 retry 0과 명시적 호출 상한으로 실행한다.

표본의 field/line/block/section 구조를 검토한 뒤 image 102개 전수 실행 여부를 다시 보고한다. Search Corpus와 최종 ProgramCase-section 연결은 후속 이슈에서 수행한다.

## CLOVA 구조화 OCR 표본 9건

승인된 고유 image snapshot 9개를 retry 0, 최대 호출 9 조건으로 실행했다. 실제 호출은 9회, 재사용 0, 성공 9, 실패·빈 응답·field 없는 응답은 모두 0이었다. 외부 URL 다운로드와 DB write는 없었다.

| 집계 | 결과 |
|---|---:|
| OCR field | 2,599 |
| Derived line | 925 |
| Derived block | 56 |
| Derived section | 56 |
| 평균/최소 field confidence | 0.9280 / 0.2894 |
| polygon 누락 | 0 |
| lineBreak 보유 field | 2,599 |
| 고/중/저 section confidence | 36 / 18 / 2 |
| CANDIDATE / AMBIGUOUS / NO_RELIABLE_MATCH | 14 / 6 / 48 |

### 표본별 구조 품질

원문과 OCR text는 공개 문서에 기록하지 않았다. 예상 프로그램 블록 수는 화면 구조를 사람이 확인한 보수적인 범위다.

| sourceSha256 | 연결 | field/line/block/section | 예상 프로그램 블록 | 판정 |
|---|---:|---:|---:|---|
| `5ac25cc062ef…c1bed` | 22 | 68/28/6/6 | 약 6 | `UNDER_SEGMENTED` |
| `ff8e4ca3737b…61121a` | 8 | 108/61/4/4 | 1 | `OVER_SEGMENTED` |
| `5ee58be5081c…642138` | 5 | 102/51/5/5 | 1 | `OVER_SEGMENTED` |
| `be306b643bc2…a3dc68` | 2 | 294/74/10/10 | 1~2 | `OVER_SEGMENTED` |
| `826f59cebfb3…bf752f` | 2 | 173/37/5/5 | 1 | `OVER_SEGMENTED` |
| `99ba2e1ce938…dee6d2` | 1 | 894/333/10/10 | 1 | `OVER_SEGMENTED` |
| `76c855230729…84b091` | 1 | 763/257/1/1 | 1 | `CANDIDATE_MATCH_WEAK` |
| `00433a31b458…306785` | 1 | 166/65/13/13 | 1 | `OVER_SEGMENTED` |
| `f68a6abfda32…8377e7` | 1 | 31/19/2/2 | 1 | `OVER_SEGMENTED` |

최대 공유 포스터에서는 실제 프로그램 제목과 세부 항목이 큰 OCR block 안에 함께 남고, 로고·상단 제목·하단 문의 같은 layout region이 별도 section으로 승격됐다. 단일 프로그램 표와 계획서는 행 사이 vertical gap이 section 경계가 되어 과분할됐다. 따라서 `block = program section` 가정은 성립하지 않는다.

후보 68개 중 reliable candidate/ambiguous는 20개였다. 이 20개에서는 title evidence가 17개로 주 신호였고 target/date evidence는 각각 6/3개로 보조 역할을 했다. location은 표본 source metadata가 비어 있어 평가할 수 없었다. Keyword evidence는 title token과 거의 같이 움직여 독립적인 품질 개선 신호가 아니었다. linked ProgramCase 범위 제한은 최대 공유 포스터에서 전역 후보 폭증을 막았지만 잘못된 section 경계를 보완하지는 못했다.

### 결정성과 권고

저장된 safe response만 재사용한 두 번째 실행은 API 호출 0, artifact 재사용 9였다. OCR field/line/block, section, candidate 파일 SHA-256과 전체 dataset hash가 모두 같았다.

```text
cddd5214725ee367cf40664f9c82658b89c7dc569418e2d133a8a1e3fcb0a6aa
```

전체 102건 실행 전 최소 수정은 다음과 같다.

1. visual block과 program section을 분리한다.
2. 단일 linked ProgramCase 이미지는 강한 복수 제목 근거가 없으면 전체 attachment section을 유지한다.
3. 표·격자에서는 vertical gap을 program boundary로 사용하지 않는다.
4. 다단 layout의 column/row 전환을 인식해 큰 upward y jump를 block 경계 후보로 다룬다.
5. 로고·문의·footer 같은 주변 영역을 삭제하지는 않되 독립 program section으로 승격하지 않는다.
6. 공유 포스터는 큰 block 내부의 제목형 line과 반복 일정 패턴을 section 후보 근거로 사용한다.

최종 권고는 `C. section/block 전략을 수정한 뒤 새 표본 검증 필요`다. 구조화 OCR은 field 좌표, confidence와 재처리 가능한 provenance를 제공하므로 평탄화 OCR보다 분명한 이점이 있지만, 현재 section 결과 그대로 전수 호출할 품질은 아니다.

## Section 전략 2차 검증

기존 9개 safe response만 재사용하여 외부 API 호출 없이 visual block과 program section 책임을 분리했다.

- block role 후보와 confidence/evidence/version 추가
- block reading order 후보 추가
- 단일 linked ProgramCase는 강한 복수 프로그램 근거가 없으면 whole-document section 하나 유지
- table row, vertical gap, header/footer/contact를 단독 경계에서 제외
- 공유 image는 제목형 line과 근접 metadata의 반복 근거가 있을 때만 분할
- title token을 그대로 복사하던 keyword evidence의 이중 점수 제거

표본 block 역할은 program content 28, title candidate 5, program metadata 5, table/grid 4, header/branding 1, contact/footer 2, administrative notice 8, unknown 3으로 분류됐다. Reading order는 row-major 27, hybrid 24, unresolved 5였으며 불확실한 block을 column-major로 억지 확정하지 않았다.

| sourceSha256 | 수정 전 section | 수정 후 section | 예상 프로그램 구간 | 수정 후 candidate/ambiguous/no-match | 판정 |
|---|---:|---:|---:|---:|---|
| `5ac25cc062ef…c1bed` | 6 | 4 | 약 6 | 7/6/3 | `UNDER_SEGMENTED` |
| `ff8e4ca3737b…61121a` | 4 | 6 | 약 6~8 일정 항목 | 0/0/6 | `CANDIDATE_MATCH_WEAK` |
| `5ee58be5081c…642138` | 5 | 6 | 약 6 일정 항목 | 0/0/6 | `CANDIDATE_MATCH_WEAK` |
| `be306b643bc2…a3dc68` | 10 | 3 | 1~2 | 0/0/3 | `USABLE_WITH_MINOR_RULES` |
| `826f59cebfb3…bf752f` | 5 | 1 | 1 | 0/0/1 | `GOOD` |
| `99ba2e1ce938…dee6d2` | 10 | 1 | 1 | 1/0/0 | `GOOD` |
| `76c855230729…84b091` | 1 | 1 | 1 | 0/0/1 | `CANDIDATE_MATCH_WEAK` |
| `00433a31b458…306785` | 13 | 1 | 1 | 1/0/0 | `GOOD` |
| `f68a6abfda32…8377e7` | 2 | 1 | 1 | 1/0/0 | `GOOD` |

단일 연결 표본 5개는 모두 1 section으로 안정화되어 행·footer·문의 영역 과분할이 해소됐다. 공유 일정형 포스터는 시각적 일정 항목 분리는 개선됐지만 source ProgramCase title과 section title의 표현 차이로 candidate가 약하다. 최대 공유 포스터는 layout region 6개를 그대로 section으로 쓰던 문제는 제거했으나 약 6개 프로그램 영역 중 4개만 감지하여 여전히 미분할이다.

재실행 validation은 dangling reference와 parser/provenance 누락 0으로 통과했다. 동일 safe response 재실행에서 block/section/candidate 파일 hash와 전체 dataset hash가 일치했다.

```text
d16a025967991b46176d00397f6e0b81fc48a231d4464b913104873f0824be3b
```

최종 권고는 여전히 `C`다. 단일 프로그램 정책은 전체 실행 가능한 수준으로 개선됐지만, 공유 포스터의 제목 anchor recall과 일정형 section의 candidate 연결이 해결되지 않았다. 전체 102건 호출 전에 같은 safe artifact로 공유 포스터 anchor와 column-local title-to-body attachment를 한 번 더 개선해야 한다.

## 전수 실행 및 #117 완료 판단

계약 감사에서 이미지 크기와 좌표 연결, orientation unresolved 상태, safe response artifact hash의 직접 추적을 보완했다. 기존 9건과 신규 일반화 표본 5건에서 polygon, field order, source hash 연결과 parser-native/derived 구분을 확인한 뒤 나머지 이미지를 처리했다.

| 항목 | 결과 |
|---|---:|
| 기존 safe artifact 재사용 | 9 |
| 일반화 표본 신규 호출 | 5 |
| 나머지 이미지 신규 호출 | 88 |
| 전체 신규 호출 | 93 |
| retry | 0 |
| 성공/실패 | 93/0 |
| 최종 Image artifact | 102/102 |
| 외부 URL 다운로드 / DB write | 0 / 0 |

전체 Representation 통계:

| 항목 | 수 |
|---|---:|
| PDF page / text item | 63 / 7,109 |
| OCR image / field / line / block | 102 / 21,395 / 7,180 / 996 |
| HWP structural unit | 2,070 |
| Section candidate | 249 |
| ProgramCase candidate | 269 |
| AMBIGUOUS / NO_RELIABLE_MATCH | 21 / 122 |
| Representation 없는 snapshot | 0 |
| dangling reference / provenance failure | 0 / 0 |

공유 binary 21건의 관계 후보는 날짜 차이 7, 시간 차이 5, 차수 차이 1, 대상 차이 2, 여러 프로그램 통합 문서 5, 행사 개요와 활동 슬롯 1건이다. 동일 ProgramCase 내부 중복은 없었다. 최대 22개 공유 이미지는 약 6개 의미 활동을 시간대별 22개 접수 ProgramCase로 확장한 행사 개요 포스터이므로 section 수를 22로 강제하지 않는다.

전수 예외 탐지는 확정 오류가 아니라 후속 rule 개선 후보이다. 주요 분포는 multi-column 94, reading-order unresolved 82, low-confidence field 후보 67, no-reliable-match source 63, merged-cell HWP 21, ambiguous source 8, under-segmentation 후보 6이다. 25건 층화 표본에는 단일/공유 이미지, 최대 공유 그룹, PDF text/OCR candidate, HWP paragraph/table, ambiguous/no-match 및 과소분할 후보를 포함했다.

저장된 parser-native artifact만 사용한 전수 재실행에서 외부 호출은 0이었다. OCR field/line/block, section, candidate, 공유 관계, 예외와 층화 표본 파일 hash가 모두 동일했고 dataset hash는 다음과 같다.

```text
c5337769c4d2a498ee54045752552fb9a10bf5750d9d11322bbd20b508e86b6d
```

#117의 완료 조건인 136건 Representation 상태, parser-native 재사용, 전체 section/candidate, validation, 결정성, 예외 분포와 층화 검토가 충족됐다. 공유 포스터 section과 candidate 품질은 완벽하지 않지만 `AMBIGUOUS`, `NO_RELIABLE_MATCH`, 예외 후보로 안전하게 보류되며 OCR 재호출 없이 후속 Search Corpus 단계에서 개선할 수 있다. 따라서 #117 완료를 권장한다.
