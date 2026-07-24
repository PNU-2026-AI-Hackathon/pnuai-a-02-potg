# HWP·HWPX 첨부파일 구조 분석 결과

- 분석 일자: 2026-07-24T15:13:31.711Z
- 실행 환경: win32/x64, Node v22.17.0, 10.0.26200
- 선정 조건: `isActive = true`, DB `fileType IN (HWP, HWPX)`
- DB 접근: PostgreSQL `READ ONLY` transaction, SELECT only
- 전체 대상 건수: 26

## 집계

- OLE HWP: 26
- HWPX: 0
- 기타/판별 실패: 0
- 형식 불일치: 0
- 암호화 의심: 0
- 배포용 문서 의심: 0
- 손상 또는 미지원 의심: 0
- 다운로드 실패: 0
- 고유 SHA-256 파일 수: 22
- 파일 크기(bytes): 최소 52736, 중앙값 83200, 최대 4425216, 합계 27220992
- 문서 버전 분포: 5.1.0.1: 23, 5.1.1.0: 3
- section 수 분포: 1: 26

## 파일별 분석 결과

| attachment ID | programCase ID | 파일명 | URL(쿼리 마스킹) | 확장자 | DB 형식 | 상태 | 기존 추출기 | 텍스트 존재(raw/clean) | 다운로드 | 크기 | SHA-256 | 실제 형식 | OLE/HWP signature | 버전 | 압축/암호화/배포용 | Body/View | section | 일치 | 오류 |
|---|---|---|---|---|---|---|---|---|---|---:|---|---|---|---|---|---|---:|---|---|
| 7d6e2509-23a0-431c-b624-b9b7fa70faef | c556f364-19f4-482d-8efb-d34b3dbdf936 | 2026_들락날락_강의계획서_금정아이꿈자람 작은도서관_초등 (1).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2026031710360233053.hwp | HWP | hwp | PENDING | - | N/N | Y | 92672 | fba6659b519863beeb6239284ed1c97ea1351bdb2dbf2b69a63ef0c3506281d2 | HWP | Y/Y | 5.1.1.0 | Y/N/N | Y/N | 1 | Y/Y | - |
| 6ffb7aed-27e9-40b0-9d94-9ff631055f1f | e69f3228-b9d9-4eba-a26f-b04f83f82280 | 2026_들락날락_강의계획서_금정아이꿈자람 작은도서관_유치 (2).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2026031710292888787.hwp | HWP | hwp | PENDING | - | N/N | Y | 93696 | 9d99eafc19bca4549da966e7ccc1ab65cf9823b59971b3c1d618b174d20387e2 | HWP | Y/Y | 5.1.1.0 | Y/N/N | Y/N | 1 | Y/Y | - |
| bf5d67f8-f19c-49f1-b42f-caf44d02a487 | 4f3093f3-9357-4010-8173-8937af870711 | level 2_Group B_강의 계획서_최종본(초등반) (1).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2025072416232613852.hwp | HWP | hwp | PENDING | - | N/N | Y | 88064 | 2a98b819fae0e18f4d7d6e1d3899f4066bb51da48fdff04a760ca2dcd7d439c2 | HWP | Y/Y | 5.1.1.0 | Y/N/N | Y/N | 1 | Y/Y | - |
| a59174db-94e4-4744-afe8-bebea25ddb68 | 3671fa6f-c9e4-4812-8740-3e129e622a86 | 애니메이션 콘서트(금정북파크_8.9.).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2024062811263287471.hwp | HWP | hwp | PENDING | - | N/N | Y | 53760 | 7e1869ce49047000c218323f7ba59e559e0dd23135d492721874d516fa3a9b5b | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 8b8ab2d3-f4e8-40bf-aca6-5f41eb2f7e9e | 4274b332-a5ec-48dc-bf00-238d4091572c | 내 마음을 알려줘(금정북파크_8.10.).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2024062811173294022.hwp | HWP | hwp | PENDING | - | N/N | Y | 190464 | 5b256f09f6c47a59e2f4444991cdb58911493c9a2f7c36a1033dace7c4ef92e3 | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| bd7ffc09-ef85-4288-a44c-4b97dfc9ddf1 | b1e9ca8e-ddb6-4491-9674-804a155be9bf | 소설가의 삶과 문화콘텐츠 스토리텔링(금정북파크_8.11.).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/202406281003109948.hwp | HWP | hwp | PENDING | - | N/N | Y | 421888 | 162504d127ad3ddb14d38a02ac318fef26236ad66c0f6377fe0d53add5a173a4 | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| cd331a38-a8b9-4045-bf45-e290cd5f2766 | 02aef93f-1c75-4091-a442-23b0265fc067 | 영화속역사이야기.hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2023081615391449109.hwp | HWP | hwp | PENDING | - | N/N | Y | 56832 | 9b0e9f07bdacbecffc1cbac6fb2bf85b63a8dbf08c56890bb72025d910bbbf6d | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 88b3ab83-7b66-44c7-a3c8-e7e0245c770c | b14957d3-c6fe-47fc-b698-a66b34e8e352 | 강의계획서(22. 겨울방학).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/202201041456313441.hwp | HWP | hwp | PENDING | - | N/N | Y | 4425216 | 09779effba1d858ce0d4370b6894ef077459edd9ec1ab44c6e0ead7f7eca702c | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| b7f5acd4-2e8b-4212-ba78-5a3ff5305411 | e0af3869-16be-45e9-b8f4-f55e0484229c | 강의계획서(22. 겨울방학).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2022010414564372577.hwp | HWP | hwp | PENDING | - | N/N | Y | 4425216 | 09779effba1d858ce0d4370b6894ef077459edd9ec1ab44c6e0ead7f7eca702c | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 7fccf04e-7e5a-4eb6-8757-bfcc34c68c65 | 7b1e6f7a-14f0-418c-adac-f589eae22667 | 강의계획서(22. 겨울방학).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2022010414592649995.hwp | HWP | hwp | PENDING | - | N/N | Y | 4425216 | 09779effba1d858ce0d4370b6894ef077459edd9ec1ab44c6e0ead7f7eca702c | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 8e39557a-fb32-466f-875c-6343bf171d10 | 2ca143ec-4847-43ed-8ebc-5b1f7660d62e | 강의계획서(22. 겨울방학).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2022010414595423268.hwp | HWP | hwp | PENDING | - | N/N | Y | 4425216 | 09779effba1d858ce0d4370b6894ef077459edd9ec1ab44c6e0ead7f7eca702c | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 06c35ef8-9680-4233-8301-bdba6001bf24 | 23c7a257-6e0f-4a0b-9293-aa176b8bc240 | 강의계획서(22. 겨울방학).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2022010415001672515.hwp | HWP | hwp | PENDING | - | N/N | Y | 4425216 | 09779effba1d858ce0d4370b6894ef077459edd9ec1ab44c6e0ead7f7eca702c | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 3d5b6b93-e74c-40ed-b07a-e3f494ce6f70 | 0f303a92-177e-4499-b624-b4a9671638a7 | 한자를 알면 세상이 보인다!.hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021101808421199191.hwp | HWP | hwp | PENDING | - | N/N | Y | 77824 | fce2a90178381578e691e7be91803af064f4e140b9bf8bc11a8961d2cbff0a0c | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| a9d40563-27ae-4f2e-b8ca-9b2cd0f0e112 | 13ca7dd9-e729-43ac-a2af-474904809851 | 청소년을 위한 독서 처방전.hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021101813131879859.hwp | HWP | hwp | PENDING | - | N/N | Y | 94720 | 525cad9e8f2a8cfcd2c92edb9aa1d73f21a079a5de2a14cf0cc9e5ea64b9983b | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 41a0d307-62e4-42de-a199-93aaf02419a0 | 21d02b45-0ebe-4394-9d71-10743c5966f5 | 강의계획서(책 속에 퐁당 독서 놀이).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021082417013068428.hwp | HWP | hwp | PENDING | - | N/N | Y | 52736 | 7eb82412fd7760c9de321a4e1f00d002dc017101246139a13e61ced67c01509c | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 23a20b72-a24e-4a5b-ad07-d51a1300d92d | 8804ba7d-5fbd-4b04-a63a-711ba4681554 | 강의계획서(어린이를 위한 슬기로운 글쓰기 생활).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021082417000123687.hwp | HWP | hwp | PENDING | - | N/N | Y | 78336 | 0b125c14c7349fa28ebfbaf2ce140cc422cba4936c2d00ff51905a36f24c76b0 | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 8270fb1e-b834-4e03-b502-53c1c551ebce | eb974f4c-4100-4963-aa19-49f1710c6daa | 강의계획서(아이와 함께 성장하는 행복한 책읽기).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021082509031732932.hwp | HWP | hwp | PENDING | - | N/N | Y | 1687040 | 7b2de7e37e997052fe0fb0d24e94317d96961ed33f5bdf734a008131b85fd1ca | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 04917ea8-837a-4043-982f-8a39917acc35 | bc37538f-24c5-4205-9583-b64d074e4a42 | 강의계획서(슬로우 리딩으로 메타인지를 높여라).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021082416525967229.hwp | HWP | hwp | PENDING | - | N/N | Y | 69120 | abb5900f6bec9f54461adf1611c96dc1ca72e88d664f260a35f6cdb88fc20fbd | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 3956c023-f29d-407a-a433-38412baed494 | 643df2b3-479d-438b-9579-cd8c978b5cac | 강의계획서(미리 써보는 오감만족 글쓰기).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021082416505722495.hwp | HWP | hwp | PENDING | - | N/N | Y | 76800 | 2e9ee50776172ba52766bd7d74d52657b2d47eca12d155534e8522d36f1f5adc | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 5eabe78d-f690-48b2-9727-ce58538b5eb3 | 4307b857-efc4-4fb5-be14-cd9beed85d8c | 강의계획서(나는야 꼬마과학자).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021082416453367757.hwp | HWP | hwp | PENDING | - | N/N | Y | 60416 | 693e4e51fc49713e2c42f65b23eb7dc44ee9a2bc5710f3bc2e86b73ecdbfe442 | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 996e6898-fd87-4183-b06a-758f451044c5 | 2467b075-bb5b-4b06-b36b-601f3160e10f | 강의계획서(호기심 해결! 창의과학교실).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021082416394820971.hwp | HWP | hwp | PENDING | - | N/N | Y | 63488 | 5bb744fec461cf8a1a511d73555d82374b2d12f4f310dc336a7348752bdb0cee | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 62360b4c-a3a9-4ef3-a350-e236d23f2448 | 5cd58c2c-cd47-4843-b89c-acfec56fb707 | 강의계획서(소설로 문화 읽기).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021082413593810981.hwp | HWP | hwp | PENDING | - | N/N | Y | 54272 | 8b3c1e1cd4d4889953ac181a1496dba5e0ebe204e0016e7236d74e3c79e8cad7 | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| 5ab8bb0a-4bdd-415e-8bc2-b8c789e16bb0 | 3909b373-b280-477f-b154-86b1a020e0a9 | 강의계획서(마음과 만나는 그림책 테라피).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021082413562761288.hwp | HWP | hwp | PENDING | - | N/N | Y | 1605120 | b7aab7f4dd855d72f7438c90e42e339e5d1ba986256cb0f1118b5ac0eb87c8be | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| f56d6009-2c88-4864-89e9-ec870b30cf62 | 1fd1da6a-84f1-4e31-8680-b7ef2510adf5 | 강의계획서(사고력 쑥쑥 독서 논술).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021082413530057481.hwp | HWP | hwp | PENDING | - | N/N | Y | 64512 | d29a217ad7aab4aafbf40a6d35af83b5b5feda0b96f174595d489476a5a2f32a | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| c8e99978-7a48-496d-8ef0-2c24ce091805 | a0b06d2d-116c-49a1-8ffa-34a27fb0ee4c | 강의계획서(일본어 초급반).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021082417200999354.hwp | HWP | hwp | PENDING | - | N/N | Y | 60416 | b7a394595e4bca8956128f12d031b9e8b8ed9d6e992cbe2601624065ef2a1af1 | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |
| d285e3f2-de78-44a5-9007-3f97a674d4f6 | bdc2f80d-5e92-4bbc-8824-991412214ded | 강의계획서(알콩달콩책놀이세상).hwp | https://www.geumjeong.go.kr/upload_data/libary_data/2021062814082664062.hwp | HWP | hwp | PENDING | - | N/N | Y | 52736 | 1328c3551c8d53007b847008e5fc7ef01c1a6389a1eaea12b5408c1a66f1d32c | HWP | Y/Y | 5.1.0.1 | Y/N/N | Y/N | 1 | Y/Y | - |

## 추천 대표 표본

1. `7d6e2509-23a0-431c-b624-b9b7fa70faef` — 2026_들락날락_강의계획서_금정아이꿈자람 작은도서관_초등 (1).hwp
   - 선정 이유: 최신 버전군(5.1.1.0)의 강의계획서로 표·문단 구조 비교에 적합
   - 공개 적합성: 원문 확인 전 공개 예시 사용 금지
2. `88b3ab83-7b66-44c7-a3c8-e7e0245c770c` — 강의계획서(22. 겨울방학).hwp
   - 선정 이유: 최대 크기(4,425,216 bytes)로 성능·메모리 비교에 적합. 동일 SHA-256이 5개 행에 반복되므로 이 ID 하나만 사용
   - 공개 적합성: 원문 확인 전 공개 예시 사용 금지
3. `bd7ffc09-ef85-4288-a44c-4b97dfc9ddf1` — 소설가의 삶과 문화콘텐츠 스토리텔링(금정북파크_8.11.).hwp
   - 선정 이유: 1MB 미만 파일 중 가장 큰 편(421,888 bytes)으로 일반 문서의 이미지·표 영향 비교에 적합
   - 공개 적합성: 원문 확인 전 공개 예시 사용 금지
4. `41a0d307-62e4-42de-a199-93aaf02419a0` — 강의계획서(책 속에 퐁당 독서 놀이).hwp
   - 선정 이유: 최소 크기군(52,736 bytes)의 일반 HWP로 기준 성능과 텍스트 품질 비교에 적합
   - 공개 적합성: 원문 확인 전 공개 예시 사용 금지

암호화·배포용·손상·형식 불일치 표본은 이번 데이터셋에서 발견되지 않아 실제 파일 표본으로 선정하지 않았다. 해당 오류 경로는 합성 fixture로 비교해야 한다.

## 실행 인터페이스

작업 디렉터리는 `apps/backend`이다. 출력 경로를 생략하면 마스킹된 JSON을 stdout으로 출력한다.

```powershell
# 전체 HWP/HWPX 분석
npm.cmd run analyze:hwp-attachments -- --json .local/hwp-analysis.json --markdown .local/hwp-analysis.md

# 특정 attachment ID
npm.cmd run analyze:hwp-attachments -- --attachment-id <UUID> --json .local/hwp-one.json

# 분석 개수 제한
npm.cmd run analyze:hwp-attachments -- --limit 5 --markdown .local/hwp-five.md
```

`--json`과 `--markdown`은 함께 지정할 수 있다. CLI의 DB 세션은 `BEGIN TRANSACTION READ ONLY`이며 조회 완료 후 종료된다.

## 추출 도구에 필요한 기능

- HWP 5.x OLE/CFB 및 압축 BodyText 지원
- 표, 문단, 다중 section의 안정적인 읽기 순서 보존
- 배포용 ViewText 및 암호화 문서의 명시적인 진단
- HWPX ZIP/XML의 namespace, 표, section 지원
- 파일·stream·출력 크기와 실행 시간 제한
- 외부 실행 도구 사용 시 버전 고정, `shell: false`, 격리 및 preflight

## 예상 위험 요소

- OLE magic만으로는 일반 CFB 문서와 HWP를 구분할 수 없음
- 암호화·배포용 문서는 일반 BodyText 추출과 다른 경로가 필요할 수 있음
- 표 셀과 문단의 읽기 순서가 도구별로 달라질 수 있음
- 문서 원문과 URL에는 개인정보 또는 접근 토큰이 포함될 수 있으므로 외부 공개 금지
- HWPX가 없더라도 향후 입력 호환성을 위해 최소한의 검증·명시적 미지원 처리는 필요
- 동일 SHA-256인 대용량 문서가 여러 attachment ID에서 반복되어, 향후 추출 결과 재사용 정책이 비용에 큰 영향을 줌

## 다음 단계 권장안

1. 추천 표본을 로컬 비공개 상태로 유지하며 도구별 텍스트 품질을 비교한다.
2. HWP 파서는 [`hwp.js`](https://github.com/hahnlee/hwp.js), [`pyhwp/hwp5`](https://github.com/mete0r/pyhwp), [`openhwp`](https://github.com/openhwp/openhwp) 또는 [`rhwp`](https://github.com/edwardkim/rhwp), LibreOffice headless의 지원 범위·라이선스·운영성을 비교한다.
3. HWPX는 제한된 ZIP/XML 직접 파싱과 LibreOffice 변환 결과를 비교한다.
4. 선택한 도구에 timeout, 출력 제한, 오류 분류를 적용한 뒤 dry-run 추출기를 구현한다.

## 테스트 결과

- TypeScript: `npm.cmd run build` 통과
- HWP 분석 합성 테스트: 통과
- 기존 다운로드·형식 판별·PDF 추출 모듈 테스트: 통과
- CLOVA OCR, IMAGE CLI, PDF OCR foundation/write, recovery mock 테스트: 통과
- backend lint: lint script 및 ESLint 설정이 없어 별도 실행 불가
- DB 상태 전이 통합 테스트: 실제 DB에 테스트 행을 쓰는 구조이므로 이번 읽기 전용 단계에서는 실행하지 않음
- 실제 DB/네트워크 분석: 26건 조회·다운로드 성공, DB 쓰기 없음
