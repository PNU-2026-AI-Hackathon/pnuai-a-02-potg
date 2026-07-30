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
