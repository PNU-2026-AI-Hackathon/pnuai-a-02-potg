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
