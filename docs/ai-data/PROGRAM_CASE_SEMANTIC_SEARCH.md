# 프로그램 사례 청크 의미 검색

## 목적과 범위

`ProgramCaseDocumentChunk`를 Windows 로컬 PC에서 KURE-v1으로 임베딩하고,
AWS RDS PostgreSQL의 pgvector에 저장한 뒤 로컬 CLI에서 cosine 유사도 검색을
검증한다. OpenAI 등 유료 API, EC2 모델 설치, Express API, RAG, reranker,
프로그램 단위 dedupe와 vector index는 이 범위에 포함하지 않는다.

```text
RDS ProgramCaseDocumentChunk
  -> Windows Python / Sentence Transformers / KURE-v1
  -> RDS VECTOR(1024)
  -> Windows 검색 CLI
  -> exact cosine Top K 청크
```

## 모델 결정

| 항목 | 값 |
|---|---|
| provider | `LOCAL_SENTENCE_TRANSFORMERS` |
| model | `nlpai-lab/KURE-v1` |
| revision | `d14c8a9423946e268a0c9952fecf3a7aabd73bd9` |
| embedding version | `kure-v1-1024-l2-d14c8a942394` |
| dimension | 1024 |
| sequence length | 8192 tokens |
| license | MIT |
| base | BAAI/bge-m3 |
| execution device | Windows CPU |

공식 모델 카드는 KURE-v1을 한국어 검색에 특화된 공개 모델로 소개하며
`SentenceTransformer("nlpai-lab/KURE-v1")`와 `model.encode(sentences)`를
사용한다. KURE-v1에는 별도의 query/document prefix가 안내되지 않았으므로
임의 prefix를 붙이지 않는다. 같은 저장 모델을 문서와 query 모두에 사용한다.
`trust_remote_code`는 필요하지 않으며 구현에서 `False`로 고정한다.

모델 카드 예시는 별도 정규화를 명시하지 않는다. 이 도구는 cosine 검색용
저장값과 query에 모두 `normalize_embeddings=True`를 일관되게 적용한다.
L2 정규화는 cosine 순위를 바꾸지 않고 저장 정책을 명확하게 만든다. 정책
변경 시 `embeddingVersion`도 반드시 변경해야 한다.

참고:

- [KURE-v1 공식 모델 카드](https://huggingface.co/nlpai-lab/KURE-v1)
- [KURE 공식 저장소](https://github.com/nlpai-lab/KURE)

2026-07-29 조회 당시 Hub repository 크기는 약 2.29GB이고 0.6B F32
모델이다. 모델 자체 다운로드 약 2.3GB, CPU용 PyTorch와 Python 의존성 및
캐시를 합친 설치 공간은 플랫폼별 wheel 차이를 고려해 약 5~8GB를
예상한다. CPU 추론 메모리는 모델 가중치 약 2.3GB 외 런타임과 activation을
고려해 대략 3~5GB를 확보하는 것이 안전하다. 이는 아직 로컬에서 측정한
실측값이 아니다.

## Windows Python 환경

Python 3.11을 고정 권장한다. 모델 학습 메타데이터의 환경은 Python
3.10.12, Sentence Transformers 3.3.1이며 Windows 지원과 장기 유지성을
고려해 runtime은 Python 3.11과 `sentence-transformers==3.3.1`을 사용한다.

아래 명령은 향후 사용자 승인 후 `apps/backend`에서 실행한다. Windows
`py` launcher가 있는 환경:

```powershell
py -3.11 -m venv .venv
```

`py` launcher가 없는 환경에서는 설치된 Python 3.11 실행 파일을 사용한다.
개인 사용자 절대 경로를 문서나 script에 고정하지 않는다.

```powershell
<Python 3.11 실행 파일 경로> -m venv .venv
```

가상환경 생성 후 공통 명령:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r python\requirements.txt
$env:PYTHONPATH = "python"
```

`requirements.txt`는 runtime, `requirements-dev.txt`는 pytest를 포함한 개발
환경이다. Windows CPU wheel source와 `torch==2.5.1+cpu`를 requirements에
고정했다. 설치 후 다음을 확인한다.

```powershell
python -c "import torch; print(torch.__version__); print(torch.cuda.is_available())"
```

기대 결과는 `torch.cuda.is_available() == False`다.

Hugging Face의 기본 Windows cache는 일반적으로
`%USERPROFILE%\.cache\huggingface\hub`이다. 다른 위치가 필요하면
`KURE_MODEL_CACHE_DIR`을 지정한다. repository 내부 경로를 사용할 때는
ignore가 보장된 `apps/backend/.model-cache`만 허용하며 다른 내부 경로는
설정 오류로 거부한다. `.venv`, cache, export 파일은 `.gitignore` 대상이다.

Python 의존성과 Node package는 분리한다. `sentence-transformers`, `torch`,
`psycopg`, `pgvector`, `python-dotenv`, `numpy`, `pytest`만 사용한다.

## 환경변수

```dotenv
DATABASE_URL=
KURE_MODEL_CACHE_DIR=
KURE_BATCH_SIZE=8
```

`DATABASE_URL`은 기존 값을 재사용한다. Python 설정은 URL을 구조적으로
parse하고 libpq가 지원하는 query parameter만 보존한다. Prisma 전용
`schema` 같은 parameter는 제거한다. URL을 로그에 출력하지 않는다.

model ID, revision, dimension, normalization과 embedding version은 임의
변경을 막기 위해 코드 상수다. Python 설정은 CLI 실행 시에만 검증되므로
Express 시작에는 영향을 주지 않는다.

## DB schema와 migration

`ProgramCaseDocumentChunkEmbedding`은 chunk와 1:1이고 chunk 삭제 시
cascade 삭제된다. 주요 metadata와 상태:

```text
embedding VECTOR(1024)
provider / model / modelRevision / embeddingVersion / dimension
embeddedContentHash
PENDING / PROCESSING / COMPLETED / FAILED
attemptCount / lastAttemptedAt / embeddedAt
failureCode / failureMessage
```

migration은 `CREATE EXTENSION IF NOT EXISTS vector`와 `VECTOR(1024)`,
`dimension = 1024` check를 포함하고 전체를 명시적인 `BEGIN`/`COMMIT`으로
감싼다. PostgreSQL 17의 extension 설치 script는 transaction 안에서
실행되며, pgvector 0.8.2의 설치 script도 transaction 밖에서만 가능한
명령을 요구하지 않는다. 이번 구현 단계에서는 migration을 운영 DB에
적용하지 않았다.

migration 실패 시 transaction 전체가 rollback되어 enum/table/index/FK가
부분적으로 남지 않아야 한다. 실패 후에는 `pg_extension`, `pg_type`,
`to_regclass('"ProgramCaseDocumentChunkEmbedding"')`를 읽기 전용으로
확인하고 원인을 수정한 뒤 동일 migration을 다시 적용한다. 수동으로
extension/type/table을 삭제해 복구하지 않는다. transaction 밖에서 이미
수동 생성된 동명 객체가 발견되면 먼저 운영 담당자가 소유권과 migration
history를 확인해야 한다.

Prisma는 pgvector를 native scalar로 다루지 않으므로 schema에는
`Unsupported("vector(1024)")`를 사용한다. Python은 psycopg parameter
binding과 pgvector adapter 형식을 사용하며 값이나 vector literal을 SQL에
직접 연결하지 않는다.

## 상태와 stale 판정

다음이 모두 참일 때만 `UNCHANGED`다.

- vector가 존재하고 status가 `COMPLETED`
- content hash 일치
- provider, model, revision, embedding version 일치
- dimension이 1024

하나라도 다르면 stale이다. `STALE` 상태는 저장하지 않는다. `UNCHANGED`는
모델 호출과 DB update를 모두 생략해 `updatedAt`과 `attemptCount`를
보존한다.

후보 조회 transaction을 먼저 종료하고 실제 encode 대상이 있을 때만 모델을
한 번 load한다. 모델 load/download 중 DB transaction을 유지하지 않는다.
모델 호출 직전 batch를 `PROCESSING`으로 기록하고 transaction을 끝낸다.
추론 중 DB transaction도 유지하지 않는다. `PROCESSING`이 30분 이상
지났으면 중단된 작업으로 보고 재처리하며 최근 행은 건너뛴다. 분산 lock과
queue는 구현하지 않는다.

성공 vector는 batch 전체를 하나의 transaction으로 저장한다. 한 행이라도
실패하면 batch 전체를 rollback한 뒤 별도 transaction에서 batch 전체를
`FAILED`로 기록한다. 연결이 끊긴 경우 추가 저장을 시도하지 않고 원래의
안전한 DB 오류를 반환한다.

실패 메시지는 500자로 제한하며 DB URL, 전체 content, 로컬 사용자 경로를
제거한다. vector와 전체 원문은 로그에 출력하지 않는다. 기본 CLI는 traceback을
출력하지 않으며 명시적인 `--debug`에서만 stderr로 출력한다.

## Batch와 실행

기본 batch는 CPU 안정성을 우선해 8이며 범위는 1~32다. 실제 Windows
메모리 사용량을 대표 7건에서 확인한 뒤 필요하면 낮춘다.

PowerShell:

```powershell
cd apps\backend
$env:PYTHONPATH = "python"

python -m program_case_semantic_search.cli embed --all --dry-run --json
python -m program_case_semantic_search.cli embed --chunk-id <uuid> --batch-size 4
python -m program_case_semantic_search.cli embed --all
python -m program_case_semantic_search.cli embed --failed
python -m program_case_semantic_search.cli embed --stale
```

`--dry-run`은 DB 읽기와 대상 판별만 수행한다. 모델을 import/load하지 않고
DB도 쓰지 않는다. 출력 집계:

- `totalCandidates`: 조회된 전체 후보
- `wouldCreate`: 성공 vector가 없어 신규 생성될 행
- `wouldUpdate`: 기존 embedding이 stale이라 교체될 행
- `embeddingsUnchanged`: 현재 metadata와 hash가 모두 일치
- `skippedRecentProcessing`: 최근 30분 이내 PROCESSING
- `skippedEmpty`: 빈 content

JSON과 일반 출력은 같은 집계 의미를 사용한다. 유효한 단일 UUID가 DB에
없으면 `CHUNK_NOT_FOUND`와 non-zero exit code를 반환한다.

검색 한 줄 명령:

```powershell
python -m program_case_semantic_search.cli search --query "초등학생이 참여할 수 있는 독서 프로그램" --limit 5
```

여러 줄:

```powershell
python -m program_case_semantic_search.cli search `
  --query "어르신 스마트폰 교육" `
  --limit 10 `
  --chunk-type CORE
```

검색 query는 trim 후 비어 있으면 거부하며 최대 1,000자로 제한한다. limit은
기본 5, 최대 20이다. 검색 결과의 원문 preview는 개인정보 노출 방지를 위해
출력하지 않으며 ID, chunk type, similarity, content length만 출력한다.
모델 provider는 tokenizer로 truncation 전 token 수를 검사하고 model
`max_seq_length`를 넘으면 조용히 자르지 않고 오류를 반환한다. embedding
summary에는 실행 중 관측된 `maxInputTokens`가 포함된다.

## 검색 문서 개인정보 최소화

검색 문서에는 프로그램 탐색에 필요한 기관명, 프로그램명, 대상 연령대, 일정,
모집 인원, 비용, 준비물, 공공시설 장소와 공식 출처 URL만 유지한다. 강사 및
담당자 실명과 연락처는 구조화 필드 조립 단계에서 제외한다.

자유서술과 첨부 추출문은 공통 sanitizer를 통과한다. 전화번호, 이메일,
개인정보 라벨이 붙은 생년월일·계좌·개인 주소 행을 제거하며, 참여자 명단,
출석부, 개인정보 동의서, 서명부, 강사 이력서 등 안전한 부분 분리가 어려운
고위험 첨부는 전체 검색 대상에서 제외한다. 단순한 프로그램 신청 방법 안내는
제외 사유가 아니다.

문서 content hash는 정제된 최종 문서에서 계산한다. Chunk 서비스는 정제된
문서 version과 content가 현재 builder 결과와 일치하는지 검증하며, Chunk
builder는 입력을 다시 정제하고 금지 패턴이 남으면 저장 전에 실패한다. Chunk
hash와 embedding은 이 검사를 통과한 Chunk content만 기준으로 한다.

운영 DB의 기존 검색 문서와 Chunk는 이 정책 적용 전에 만들어졌으므로 별도의
승인된 재처리가 필요하다. 재처리는 dry-run과 대상 DB allowlist를 기본으로
문서와 Chunk를 프로그램 단위로 교체하고, embedding이 존재하면 연결 vector도
무효화한 뒤 개인정보 패턴 aggregate가 0인지 확인해야 한다. 현재 감사 시점에는
실제 KURE embedding이 생성되지 않았다.

## Cosine exact 검색

검색 대상은 `COMPLETED`이며 현재 provider/model/revision/version/dimension과
content hash가 일치하는 행뿐이다.

```sql
similarity = 1 - (embedding <=> query_vector)
```

정렬은 cosine distance 오름차순, 동점 시 chunk ID 오름차순이다. 현재
888건에서는 exact scan이 충분하므로 HNSW와 IVFFlat을 만들지 않는다.
threshold와 프로그램 단위 dedupe도 실제 결과 평가 후 후속 작업에서 정한다.

## 테스트와 운영 스크립트

ML 패키지 없이 실행 가능한 테스트:

```powershell
$env:PYTHONPATH = "python"
python -m unittest discover -s python\tests -v
python -m compileall -q python
```

향후 migration이 적용된 별도 DB에서만:

```powershell
python -m scripts.validate_test_database
python -m scripts.test_program_case_vector_integration
```

DB integration은 `DATABASE_URL`을 직접 사용하지 않고
`TEST_DATABASE_URL`만 사용한다. 연결 전에 다음을 검증한다.

- `TEST_DATABASE_URL`이 존재
- database name에 `test` 또는 `integration` 포함
- `DATABASE_URL`과 전체 URL이 다름
- 운영 URL이 존재하면 database name도 다름
- 두 URL을 모두 안전하게 parse할 수 있음

하나라도 실패하면 네트워크 연결 전에 종료한다. 실제 `.env`에는 test URL을
추가하지 않고 현재 PowerShell session에서만 지정한다.

```powershell
$env:TEST_DATABASE_URL = "<별도 폐기 가능한 test DB URL>"
python -m scripts.validate_test_database
```

Prisma migration을 test DB에 적용해야 할 때는 위 검증이 성공한 동일 shell에서
원래 `DATABASE_URL`을 보관한 뒤 `TEST_DATABASE_URL`을 일시 매핑하고, 작업
종료 즉시 복원한다. URL 값은 출력하거나 파일에 저장하지 않는다.

운영에서 실행하기 전에 승인이 필요한 스크립트:

```powershell
python -m scripts.select_representative_chunks
python -m scripts.evaluate_program_case_search
python -m scripts.verify_program_case_embeddings --write-baseline .local\embedding-baseline.json
python -m scripts.verify_program_case_embeddings --compare-baseline .local\embedding-baseline.json
```

대표 selector는 UUID를 하드코딩하지 않고 CORE, SESSIONS, 짧은 첨부, 분할
PDF 첨부, JPEG OCR, HWP, OCR 병합 PDF를 relation metadata로 고른다.
7개 유형 중 하나라도 누락되거나 같은 chunk가 중복 선택되면 non-zero로
종료한다. 평가
스크립트는 열 개 한국어 query의 결과와 동일 프로그램 중복 수를 출력한다.
최종 검증은 명시적 read-only transaction에서 상태 무결성과 기존 다섯
테이블의 canonical JSON 기반 count/SHA-256 snapshot을 생성·비교한다.
baseline에는 count와 hash만 저장하고 원문, URL, DB URL, vector를 저장하지
않는다.

## 향후 승인 후 실행 순서

1. Python 3.11 가상환경 생성 및 CPU 패키지 설치
2. 설치 후 디스크·메모리 확인
3. migration SQL 재검토와 운영 DB snapshot
4. 사용자 승인 후 migration 적용
5. vector extension/table 확인
6. dry-run
7. 사용자 승인 후 KURE-v1 다운로드
8. 대표 7개 임베딩과 즉시 재실행
9. 대표 검색
10. 사용자 승인 후 전체 888개 임베딩
11. 즉시 재실행하여 `UNCHANGED 888`, provider 생성/load/encode 0회 확인
12. 한국어 검색 평가와 read-only 최종 검증

설계상 최초 예상은 `CREATED 888`, 즉시 재실행은 `UNCHANGED 888`과
`modelEncodeCalls 0`이다. 이는 아직 실제 실행 결과가 아니다.

## 보안 및 배포

- DB URL, 전체 query/content/vector, attachment URL을 로그에 남기지 않는다.
- production UUID를 코드에 고정하지 않는다.
- SQL 값은 parameter binding으로 전달한다.
- 모델 revision과 normalization 정책을 metadata에 포함한다.
- 모델 및 ML 환경은 Windows 로컬 PC에만 둔다.

EC2에는 현재 메모리와 디스크 여유가 부족하고 Express 요청마다 대형 CPU
모델을 운영하는 것은 이 이슈의 목표가 아니므로 PyTorch, Sentence
Transformers와 모델을 설치하지 않는다. 후속 배포가 필요하면 별도 추론
호스트, 컨테이너 또는 관리형 embedding service를 독립적으로 검토한다.

## 검증 상태

구현 단계에서 검증할 항목:

- Prisma validate/generate
- TypeScript build와 #89 회귀 테스트
- Python compile과 fake provider 단위 테스트
- `git diff --check`

미실행 항목:

- Python ML 패키지 설치
- 모델 다운로드 및 실제 CPU 메모리 측정
- 운영 DB migration/extension 생성
- 운영 청크 임베딩과 검색
- EC2 변경

## 2026-08-03 운영 검증 결과

운영 DB `moira`에서 pgvector `0.8.2`와 KURE-v1 고정 revision을 사용해
유효 청크 888건의 임베딩 및 의미 검색을 검증했다. 모든 청크는 document
version `2`, builder version `program-case-chunk-v2`, 비어 있지 않은 content를
가졌으며 개인정보 금지 패턴, stale document 연결, 중복 ID·chunkKey가 없었다.

### 실행 환경과 전체 집계

| 항목 | 결과 |
|---|---:|
| Python | 3.11.15 |
| 실행 장치 | CPU |
| cache | `apps/backend/.model-cache` (약 2.29GB, Git ignored) |
| batch size | 8 |
| 유효 청크 | 888 |
| CORE / SESSIONS / ATTACHMENT | 349 / 5 / 534 |
| 최초 정상 완료 | 9 |
| 전체 실행 신규 생성 | 879 |
| 전체 실행 unchanged | 9 |
| 실패 | 0 |
| encode batch/call | 110 / 110 |
| 관찰 실행 시간 | 약 1시간 48분 32초 |
| 관찰 working set | 약 1.54~1.68GiB |

상위 shell의 30분 제한 이후에도 실제 Python 자식 프로세스가 계속 실행되고
있음을 확인하여 중복 실행하지 않고 자연 종료까지 모니터링했다. 위 최초 전체
집계는 실행 시작 당시 정상 9건과 최종 DB 신규 879건, batch size 8에 따른
결정적 집계다. 상위 shell 종료 때문에 최초 CLI의 최종 stdout 자체는 회수하지
못했다.

파일럿 8건은 CORE 3, SESSIONS 2, ATTACHMENT 3으로 동적 선택되었고 한 번의
batch encode로 모두 생성됐다. 이를 위해 미임베딩·document v2·builder v2·
비어 있지 않은 청크만 제한 선택하는 `--pilot-size`를 추가했다. 함께 발견된
`--batch-size` 문자열 파싱 오류도 수정했다.

최종 integrity 결과는 다음과 같다.

- embedding/COMPLETED: 888/888
- PENDING/PROCESSING/FAILED: 0/0/0
- NULL vector, dimension mismatch: 0
- provider/model/revision/version mismatch: 0
- content hash mismatch, orphan, duplicate: 0
- vector L2 norm 범위: 0.99999987~1.00000018
- ProgramCase, Session, Attachment, Document, Chunk의 count/SHA-256 baseline 불변

동일 전체 명령의 즉시 재실행 결과는 `TOTAL 888`, `UNCHANGED 888`,
`CREATED 0`, `UPDATED 0`, `FAILED 0`, `BATCHES 0`, `MODEL_ENCODE_CALLS 0`,
`ELAPSED_SECONDS 0.266`이었다. 재실행 전후 embedding의 updatedAt,
attemptCount, vector hash, embeddedContentHash 집계 fingerprint도 동일했다.

### 한국어 검색 평가

아래 결과는 threshold 없이 exact cosine Top 5를 조회한 것이다. 프로그램명은
운영 DB의 기존 CP949 mojibake를 DB 변경 없이 보고 단계에서만 가역 복원했다.
본문, target, 첨부 원문과 vector는 출력하거나 문서에 저장하지 않았다.

#### 유아와 부모가 함께하는 그림책 활동

| 순위 | 프로그램 | similarity | type | ProgramCase ID |
|---:|---|---:|---|---|
| 1 | [유아/금정북파크] 클레이로 만나는 그림책 이야기 | 0.650287 | SESSIONS | `c2c17479-6d13-4d83-8fd8-29812884ee50` |
| 2 | [미리내] 생각 쑥쑥 그림책 | 0.629984 | ATTACHMENT | `43727bca-99ab-46f3-8d19-8ab0ffe4d83a` |
| 3 | [방학특강/북파크] 어서와~ 그림책이랑 연극이랑 같이 놀자 | 0.615471 | ATTACHMENT | `1d61aa19-329d-442e-93ed-0c378027c43a` |
| 4 | [아이꿈자람] 그림책 놀이터 | 0.609402 | ATTACHMENT | `ecd157f7-4ee7-4599-8dae-86560610aec7` |
| 5 | [사립 로뎀나무] 그림책 예술놀이 | 0.606451 | ATTACHMENT | `4ef4279d-a332-4eba-b02c-acc39b15ae9f` |

그림책 활동은 잘 포착하지만 부모 동반 조건은 제목만으로 확인되지 않아 5건
모두 부분 적합으로 보수적으로 판정했다.

#### 초등학생 독서 프로그램

| 순위 | 프로그램 | similarity | type | ProgramCase ID |
|---:|---|---:|---|---|
| 1 | [미리내] 자녀 독서지도 | 0.638605 | ATTACHMENT | `cd224f35-ed08-4990-ad3b-8d4784f16a92` |
| 2 | [금샘마을] 그림책 독서논술 | 0.629367 | CORE | `0104706d-6567-41ee-968a-fa36201c0974` |
| 3 | [아이꿈자람] 내 마음 토닥토닥 책읽기&글쓰기 | 0.626997 | CORE | `045feb8f-ce21-4213-a77a-96287c140322` |
| 4 | [금샘마을] 그림책 독서논술 | 0.626230 | ATTACHMENT | `0104706d-6567-41ee-968a-fa36201c0974` |
| 5 | [금정북파크] I Love English story | 0.626076 | ATTACHMENT | `d3c18b3a-5860-4667-ad2f-f3fc96ef63b5` |

3건 적합, 2건 부분 적합이며 같은 프로그램의 CORE/ATTACHMENT 중복 1건이 있다.

#### 노년층 디지털 교육

| 순위 | 프로그램 | similarity | type | ProgramCase ID |
|---:|---|---:|---|---|
| 1 | [성인/게이트웨이(사립)] 디지털로 그리는 나의 하루, 스마트 라이프 교실 | 0.553443 | CORE | `41a9dfbf-f4f3-40c9-a58f-792b26c23162` |
| 2 | [어린이/부곡1동] 나도 일러스트 작가! 디지털드로잉 | 0.538638 | CORE | `72454ab4-1084-4e9f-b79f-488800256bee` |
| 3 | [성인/구서sk뷰 1단지] 누구나 쉽게 따라하는 스마트폰 | 0.536136 | CORE | `abbed79d-2044-40f7-b0b0-346464804a36` |
| 4 | [금정북파크] 신나는 스마트폰 교실 | 0.534024 | CORE | `59b5f7c0-0d9b-488a-a0a7-53477a8a13fc` |
| 5 | [성인/게이트웨이(사립)] 디지털로 그리는 나의 하루, 스마트 라이프 교실 | 0.525848 | ATTACHMENT | `41a9dfbf-f4f3-40c9-a58f-792b26c23162` |

노년층이 명시되지 않아 4건 부분 적합, 어린이 디지털드로잉 1건 부적합으로
판정했다. 동일 프로그램 중복 1건이 있다.

#### 부모와 아이 문화 활동

| 순위 | 프로그램 | similarity | type | ProgramCase ID |
|---:|---|---:|---|---|
| 1 | [어린이/아이꿈자람] 들락날락 영어랑 놀자 1일 크리스마스 문화체험(초등반) | 0.542072 | ATTACHMENT | `dac90a63-290d-4ba6-bf75-c934a5a40f7a` |
| 2 | [어린이/아이꿈자람] 들락날락 영어랑 놀자 1일 크리스마스 문화체험(유아반) | 0.537939 | ATTACHMENT | `7619dc94-dc9f-47a6-b3a6-21ae15d8fea3` |
| 3 | [우지] 보테니컬 아트 | 0.517032 | ATTACHMENT | `23a1b6fb-0ff3-4e43-ae38-6c1ee2736e0e` |
| 4 | [미리내] 자녀 독서지도 | 0.512439 | ATTACHMENT | `cd224f35-ed08-4990-ad3b-8d4784f16a92` |
| 5 | [어린이/아이꿈자람] 들락날락 영어랑 놀자 1일 크리스마스 문화체험(초등반) | 0.512397 | CORE | `dac90a63-290d-4ba6-bf75-c934a5a40f7a` |

부모 동반이 명시되지 않아 4건 부분 적합, 보테니컬 아트 1건 부적합으로
판정했다. 동일 프로그램 중복 1건이 있다.

#### 주민 공예 프로그램

| 순위 | 프로그램 | similarity | type | ProgramCase ID |
|---:|---|---:|---|---|
| 1 | [아이꿈자람/어린이] 3D펜으로 생활소품 만들기 | 0.567726 | CORE | `05814221-1991-4a81-b568-ca87687df2ec` |
| 2 | [아이꿈자람] 풍선아트 체험 16:40~17:00 | 0.551712 | ATTACHMENT | `99068bd9-8518-4b80-87df-99cbc12573cd` |
| 3 | [아이꿈자람] 풍선아트 체험 15:00~15:20 | 0.551215 | ATTACHMENT | `7148f37d-e963-4ed9-9345-0f5762bbd54c` |
| 4 | [아이꿈자람] 풍선아트 체험 14:00~14:20 | 0.550120 | ATTACHMENT | `4c253691-b671-474d-94ea-47927790c323` |
| 5 | [아이꿈자람] 풍선아트 체험 14:40~15:00 | 0.549725 | ATTACHMENT | `a4cbbaa3-2849-454a-b192-c70096d22ae3` |

공예·만들기 활동은 일치하지만 주민 일반보다 어린이 대상이므로 5건 모두
부분 적합으로 판정했다.

#### 건강 프로그램

| 순위 | 프로그램 | similarity | type | ProgramCase ID |
|---:|---|---:|---|---|
| 1 | 박민수 원장의 「생체 나이 10년 젊게」 강연 | 0.524286 | CORE | `03bafacf-b661-4496-bc41-b97ac8381df4` |
| 2 | 박민수 원장의 「생체 나이 10년 젊게」 강연 | 0.516099 | ATTACHMENT | `03bafacf-b661-4496-bc41-b97ac8381df4` |
| 3 | [어린이/아이꿈] 원어민 선생님과 Joyful English | 0.510967 | ATTACHMENT | `c22a7dbd-a864-499c-b163-4ec1d0e907a1` |
| 4 | [초등/구서2동어린이] Cool Summer! Cool English! | 0.497522 | SESSIONS | `2a38d135-591f-4b39-bcbd-f348c11e60b8` |
| 5 | [초등/부곡1동] 똑똑한 지구인 프로젝트 | 0.494328 | SESSIONS | `95756897-676f-4e06-b029-679135624716` |

상위 2건은 적합하지만 같은 프로그램 중복이고, 나머지 3건은 부적합이다.

### 분포와 후속 판단

질의별 1위/5위/Top 5 평균은 각각 다음과 같다.

| 질의 | 1위 | 5위 | 평균 |
|---|---:|---:|---:|
| 유아·부모 그림책 | 0.650287 | 0.606451 | 0.622319 |
| 초등 독서 | 0.638605 | 0.626076 | 0.629455 |
| 노년층 디지털 | 0.553443 | 0.525848 | 0.537618 |
| 부모·아이 문화 | 0.542072 | 0.512397 | 0.524376 |
| 주민 공예 | 0.567726 | 0.549725 | 0.554100 |
| 건강 | 0.524286 | 0.494328 | 0.508640 |

전체 Top 30의 score 범위는 0.494328~0.650287이다. 건강 질의의 부적합
3위 점수 0.510967과 다른 질의의 부분 적합 점수 범위가 겹치며, 노년층
질의에서도 부적합 결과가 일부 부분 적합 결과보다 높다. 따라서 현재 결과만으로
고정 threshold를 두는 것은 부적절하고 더 많은 relevance label이 필요하다.

Top 30의 청크 유형은 CORE 9, SESSIONS 3, ATTACHMENT 18로 ATTACHMENT가
60%다. 여섯 질의 중 세 질의에서 같은 ProgramCase의 CORE/ATTACHMENT가
동시에 노출되어 총 3건의 중복이 있었다. 다음 우선순위는 검색 후 프로그램
단위 dedupe 또는 프로그램별 최고 청크 점수 집계이며, 그 다음에 labeled
evaluation을 통한 threshold와 reranking을 검토한다.

### 검증 명령 결과

- TypeScript build: 통과
- Python unit test: 53개 통과
- 전용 `moira_pgvector_integration_test` synthetic pgvector integration: 통과
- 운영 integrity 및 원본 SHA-256 비교: 통과
- `git diff --check`: 통과

## 2026-08-04 ProgramCase dedupe와 metadata filter 재평가

기본 검색이 Chunk 단위 Top K에 바로 limit을 적용하여 같은 ProgramCase의
CORE와 ATTACHMENT가 함께 노출되는 문제를 보완했다. Repository는 vector
후보 검색과 metadata filter에 집중하고, SearchService가 ProgramCase 검색
정책을 담당한다.

권장 검색 흐름은 다음과 같다.

```text
사용자 질의
  -> 선택적 metadata filter
  -> vector Chunk 후보 oversampling
  -> ProgramCase 단위 dedupe
  -> Top K 프로그램 사례
  -> 후속 RAG context
```

### 대표 청크와 oversampling 정책

- 후보 수: `max(requested limit × 5, 20)`
- 같은 ProgramCase에서는 similarity가 가장 높은 Chunk 선택
- similarity 완전 동점에서만 CORE, SESSIONS, ATTACHMENT 순으로 선택
- similarity와 type도 같으면 Chunk ID 오름차순
- dedupe 이후 requested limit 적용
- 고유 ProgramCase가 부족하면 존재하는 결과만 반환

더 낮은 CORE가 더 높은 ATTACHMENT를 대체하지 않는다. 현재 888건 규모에서는
exact cosine 검색을 유지하며 reranker는 구현하지 않았다.

### metadata filter와 CLI

실제 구조화 metadata 중 검색에 유효한 것은 `ProgramCase.targetAudience`와
Chunk type이다. 별도 organization/library 필드는 없고 조직명은 title 접두부에
섞여 있으므로 organization filter를 상상해 추가하지 않았다. `sourceType`은
349건 모두 `GEUMJEONG_SMALL_LIBRARY`라 변별력이 없다.

target은 자유문자열로 분산되어 있다. 대표 분포는 `일반인 성인` 31건,
`어린이 유아 6-7세` 21건, `어린이 어린이(유아, 초등)` 15건,
`일반인 지역주민` 13건, `초등학생 1~3학년` 11건이다. 자동 동의어 매핑 없이
사용자가 지정한 문자열을 대소문자 무시 literal 부분일치로 검색하며 SQL 값은
모두 parameter binding한다.

```powershell
npm.cmd run program-case-semantic-search -- `
  --query="노년층 디지털 교육" `
  --limit=5 `
  --target="일반인" `
  --chunk-type=CORE
```

필터는 선택 사항이고 빈 target은 거부한다. 기본 threshold는 계속 없으며 기존
`--threshold`만 명시적 옵션으로 유지한다. CLI JSON과 text 출력에는 다음
집계를 추가했다.

```text
RAW_CHUNK_CANDIDATES
UNIQUE_PROGRAMS
DUPLICATES_REMOVED
RETURNED_RESULTS
```

결과에는 rank, program title, similarity, representative Chunk type,
ProgramCase ID, Chunk ID만 포함한다. content, preview, target, source label,
document ID와 vector는 출력하지 않는다.

### dedupe 운영 재평가

| 질의 | raw 후보 | 후보 고유 프로그램 | 후보 중복 제거 | 최종 중복 | CORE/SESSIONS/ATTACHMENT | 1위/5위 |
|---|---:|---:|---:|---:|---:|---:|
| 유아·부모 그림책 | 25 | 18 | 7 | 0 | 0/1/4 | 0.650287/0.606451 |
| 초등 독서 | 25 | 14 | 11 | 0 | 2/0/3 | 0.638605/0.625073 |
| 노년층 디지털 | 25 | 13 | 12 | 0 | 4/0/1 | 0.553443/0.515968 |
| 부모·아이 문화 | 25 | 18 | 7 | 0 | 0/0/5 | 0.542072/0.508386 |
| 주민 공예 | 25 | 20 | 5 | 0 | 1/0/4 | 0.567726/0.549725 |
| 건강 | 25 | 21 | 4 | 0 | 1/2/2 | 0.524286/0.485258 |

기존 Top 5에서 같은 프로그램이 중복된 질의는 초등 독서, 노년층 디지털,
부모·아이 문화, 건강의 4개였다. dedupe 후 여섯 질의 모두 최종 중복은 0이다.
Top 30 type 비중은 기존 CORE 9, SESSIONS 3, ATTACHMENT 18에서 CORE 8,
SESSIONS 3, ATTACHMENT 19로 바뀌었다. dedupe는 프로그램 중복을 해결하지만
ATTACHMENT 과다 노출 자체를 해결하지는 않는다.

dedupe 후 대표 결과는 다음과 같다. 이전 표와 같은 결과는 생략하지 않고 실제
운영 검색 점수를 사용했다.

| 질의 | 순위 | 프로그램 | similarity | type |
|---|---:|---|---:|---|
| 유아·부모 그림책 | 1 | 클레이로 만나는 그림책 이야기 | 0.650287 | SESSIONS |
|  | 2 | 생각 쑥쑥 그림책 | 0.629984 | ATTACHMENT |
|  | 3 | 어서와~ 그림책이랑 연극이랑 같이 놀자 | 0.615471 | ATTACHMENT |
|  | 4 | 그림책 놀이터 | 0.609402 | ATTACHMENT |
|  | 5 | 그림책 예술놀이 | 0.606451 | ATTACHMENT |
| 초등 독서 | 1 | 자녀 독서지도 | 0.638605 | ATTACHMENT |
|  | 2 | 그림책 독서논술 | 0.629367 | CORE |
|  | 3 | 내 마음 토닥토닥 책읽기&글쓰기 | 0.626997 | CORE |
|  | 4 | I Love English story | 0.626076 | ATTACHMENT |
|  | 5 | 어린이 논술 | 0.625073 | ATTACHMENT |
| 노년층 디지털 | 1 | 스마트 라이프 교실 | 0.553443 | CORE |
|  | 2 | 어린이 디지털드로잉 | 0.538638 | CORE |
|  | 3 | 누구나 쉽게 따라하는 스마트폰 | 0.536136 | CORE |
|  | 4 | 신나는 스마트폰 교실 | 0.534024 | CORE |
|  | 5 | 삼국지로 배우는 한자 | 0.515968 | ATTACHMENT |
| 부모·아이 문화 | 1 | 크리스마스 문화체험(초등반) | 0.542072 | ATTACHMENT |
|  | 2 | 크리스마스 문화체험(유아반) | 0.537939 | ATTACHMENT |
|  | 3 | 보테니컬 아트 | 0.517032 | ATTACHMENT |
|  | 4 | 자녀 독서지도 | 0.512439 | ATTACHMENT |
|  | 5 | 생각톡톡! 미술아 놀자 | 0.508386 | ATTACHMENT |
| 주민 공예 | 1 | 3D펜으로 생활소품 만들기 | 0.567726 | CORE |
|  | 2 | 풍선아트 체험 16:40 | 0.551712 | ATTACHMENT |
|  | 3 | 풍선아트 체험 15:00 | 0.551215 | ATTACHMENT |
|  | 4 | 풍선아트 체험 14:00 | 0.550120 | ATTACHMENT |
|  | 5 | 풍선아트 체험 14:40 | 0.549725 | ATTACHMENT |
| 건강 | 1 | 생체 나이 10년 젊게 강연 | 0.524286 | CORE |
|  | 2 | Joyful English | 0.510967 | ATTACHMENT |
|  | 3 | Cool Summer! Cool English! | 0.497522 | SESSIONS |
|  | 4 | 똑똑한 지구인 프로젝트 | 0.494328 | SESSIONS |
|  | 5 | 아침을 깨우는 싱잉볼 명상 | 0.485258 | ATTACHMENT |

### target filter 비교와 한계

| 질의 | 수동 target | 결과 | 판단 |
|---|---|---|---|
| 유아·부모 그림책 | `유아` | 유아 대상만 유지, 5건 반환 | 적용 가능 |
| 초등 독서 | `초등` | 연령 불일치는 감소하나 키즈스피치 노출 | 주제 filter가 아니므로 선택적 사용 |
| 노년층 디지털 | `일반인` | 어린이 디지털 결과 제거, 비디지털 성인 결과 노출 | 노년 전용 metadata 부재 |
| 부모·아이 문화 | `어린이` | 성인 보테니컬 아트 제거 | 적용 가능하나 부모 동반은 판별 불가 |
| 주민 공예 | 미적용 | `지역주민` 적용 시 공예 관련성이 악화 | category metadata 부재 |
| 건강 | `일반인` | 어린이 영어 결과 제거, 건강 외 성인 결과 잔존 | 대상 불일치만 감소 |

metadata filter는 예상한 target 후보만 제한했고 SQL injection 가능한 문자열
연결은 없다. 그러나 target은 활동 category가 아니므로 주제 관련성까지 높이지
않는다. 특히 노년/부모 동반/공예를 직접 표현하는 정규화 metadata가 없다.

보수적 적합도 판단에서 dedupe는 중복을 0으로 만들고 고유 프로그램 다양성을
높였지만, 중복 자리에 다음 저점수 부적합 후보가 들어오는 질의도 있었다.
target filter는 적용 가능한 질의에서 어린이/성인 대상 불일치를 줄였으나 전체
부적합을 항상 줄이지는 않았다. 따라서 현재 6개 질의만으로 전역 threshold를
고정하지 않는다. 적합·부적합 score overlap도 계속 존재한다.

다음 단계에서 reranker를 검토할 조건은 프로그램 dedupe와 명시적 target filter
후에도 주제 불일치 후보가 Top K에 반복 노출되는 경우다. 현재 건강·노년층
디지털·부모 동반·공예 질의가 이에 해당한다. reranker 전에 프로그램 단위
relevance label을 더 수집하고, ATTACHMENT type 가중치 또는 프로그램별 score
aggregation을 별도 이슈로 비교해야 한다.

### 재검증

- TypeScript build: 통과
- Python unit test: 58개 통과
- synthetic integration: 동일 ProgramCase 중복 후보, 최고 similarity 선택,
  tie CORE 선택, target+chunk type 조합, 0건 filter, stale 제외, cleanup 통과
- 운영 DB: read-only 검색만 수행
- Document 349, Chunk 888, Embedding 888/COMPLETED 888 유지
- embedding/document/chunk fingerprint 전후 동일
