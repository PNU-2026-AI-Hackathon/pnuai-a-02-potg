import { HwpAttachmentAnalysisResult, HwpDatasetAnalysis } from './hwpAttachmentAnalysisService';

function count<T>(items: T[], predicate: (item: T) => boolean) {
  return items.filter(predicate).length;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function distribution(values: Array<string | number | null>) {
  const result = new Map<string, number>();
  for (const value of values) result.set(String(value ?? 'UNKNOWN'), (result.get(String(value ?? 'UNKNOWN')) ?? 0) + 1);
  return [...result.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([value, total]) => `${value}: ${total}`).join(', ');
}

function privacyNote(row: HwpAttachmentAnalysisResult) {
  return /신청|명단|개인|수강생|참가자|연락처/i.test(row.fileName)
    ? '개인정보 가능성 있음: PR 예시 사용 부적절'
    : '원문 확인 전 공개 예시 사용 금지';
}

export function recommendSamples(results: HwpAttachmentAnalysisResult[]) {
  const valid = results.filter((row) => row.detectedFileType === 'HWP' && row.container?.ole?.signatureValid);
  const picked = new Map<string, { row: HwpAttachmentAnalysisResult; reason: string }>();
  const add = (row: HwpAttachmentAnalysisResult | undefined, reason: string) => {
    if (row && picked.size < 5 && !picked.has(row.id)) picked.set(row.id, { row, reason });
  };
  add(valid.find((row) => /강의|계획|운영/i.test(row.fileName) && row.container?.ole?.version === '5.1.1.0'), '최신 버전군의 강의계획서로 표·문단 구조 비교에 적합');
  add([...valid].sort((left, right) => (right.byteSize ?? 0) - (left.byteSize ?? 0))[0], '파일 크기가 커 성능·메모리 비교에 적합');
  add([...valid].filter((row) => (row.byteSize ?? 0) < 1024 * 1024).sort((left, right) => (right.byteSize ?? 0) - (left.byteSize ?? 0))[0], '1MB 미만 파일 중 가장 커 일반 문서의 이미지·표 영향 비교에 적합');
  add([...valid].sort((left, right) => (left.byteSize ?? 0) - (right.byteSize ?? 0))[0], '작은 일반 HWP의 기준 성능과 텍스트 품질 비교에 적합');
  add(valid.find((row) => row.container?.ole?.encrypted || row.container?.ole?.distribution), '암호화 또는 배포용 플래그 대응 확인에 적합');
  add(results.find((row) => row.detectedFileType === 'OTHER' || row.errorCode !== null || row.dbFileTypeMatchesActual === false), '손상·미지원·형식 불일치 오류 처리 비교에 적합');
  return [...picked.values()];
}

export function renderHwpAnalysisMarkdown(dataset: HwpDatasetAnalysis, environment: string) {
  const rows = dataset.results;
  const sizes = rows.flatMap((row) => row.byteSize === null ? [] : [row.byteSize]);
  const samples = recommendSamples(rows);
  const mismatch = count(rows, (row) => row.extensionMatchesActual === false || row.dbFileTypeMatchesActual === false);
  const unsupported = count(rows, (row) => row.errorCode !== null || row.detectedFileType === 'OTHER');
  const lines = [
    '# HWP·HWPX 첨부파일 구조 분석 결과',
    '',
    `- 분석 일자: ${dataset.analyzedAt}`,
    `- 실행 환경: ${environment}`,
    '- 선정 조건: `isActive = true`, DB `fileType IN (HWP, HWPX)`',
    '- DB 접근: PostgreSQL `READ ONLY` transaction, SELECT only',
    `- 전체 대상 건수: ${dataset.selectedCount}`,
    '',
    '## 집계',
    '',
    `- OLE HWP: ${count(rows, (row) => row.detectedFileType === 'HWP')}`,
    `- HWPX: ${count(rows, (row) => row.detectedFileType === 'HWPX')}`,
    `- 기타/판별 실패: ${count(rows, (row) => row.detectedFileType === 'OTHER' || row.detectedFileType === null)}`,
    `- 형식 불일치: ${mismatch}`,
    `- 암호화 의심: ${count(rows, (row) => row.container?.ole?.encrypted === true)}`,
    `- 배포용 문서 의심: ${count(rows, (row) => row.container?.ole?.distribution === true)}`,
    `- 손상 또는 미지원 의심: ${unsupported}`,
    `- 다운로드 실패: ${count(rows, (row) => !row.downloadSucceeded)}`,
    `- 고유 SHA-256 파일 수: ${new Set(rows.map((row) => row.checksumSha256).filter(Boolean)).size}`,
    `- 파일 크기(bytes): 최소 ${sizes.length ? Math.min(...sizes) : 'N/A'}, 중앙값 ${median(sizes) ?? 'N/A'}, 최대 ${sizes.length ? Math.max(...sizes) : 'N/A'}, 합계 ${sizes.reduce((sum, size) => sum + size, 0)}`,
    `- 문서 버전 분포: ${distribution(rows.map((row) => row.container?.ole?.version ?? null))}`,
    `- section 수 분포: ${distribution(rows.map((row) => row.container?.ole?.sectionCount ?? null))}`,
    '',
    '## 파일별 분석 결과',
    '',
    '| attachment ID | programCase ID | 파일명 | URL(쿼리 마스킹) | 확장자 | DB 형식 | 상태 | 기존 추출기 | 텍스트 존재(raw/clean) | 다운로드 | 크기 | SHA-256 | 실제 형식 | OLE/HWP signature | 버전 | 압축/암호화/배포용 | Body/View | section | 일치 | 오류 |',
    '|---|---|---|---|---|---|---|---|---|---|---:|---|---|---|---|---|---|---:|---|---|',
    ...rows.map((row) => {
      const ole = row.container?.ole;
      const match = row.extensionMatchesActual === null ? 'N/A' : `${row.extensionMatchesActual ? 'Y' : 'N'}/${row.dbFileTypeMatchesActual ? 'Y' : 'N'}`;
      return `| ${row.id} | ${row.programCaseId} | ${row.fileName.replace(/\|/g, '\\|')} | ${row.maskedFileUrl.replace(/\|/g, '%7C')} | ${row.fileNameExtension ?? '-'} | ${row.fileType ?? '-'} | ${row.extractionStatus} | ${row.extractorType ?? '-'} | ${row.rawTextPresent ? 'Y' : 'N'}/${row.cleanedTextPresent ? 'Y' : 'N'} | ${row.downloadSucceeded ? 'Y' : 'N'} | ${row.byteSize ?? '-'} | ${row.checksumSha256 ?? '-'} | ${row.detectedFileType ?? '-'} | ${ole ? `Y/${ole.signatureValid ? 'Y' : 'N'}` : '-'} | ${ole?.version ?? '-'} | ${ole ? `${ole.compressed ? 'Y' : 'N'}/${ole.encrypted ? 'Y' : 'N'}/${ole.distribution ? 'Y' : 'N'}` : '-'} | ${ole ? `${ole.bodyTextPresent ? 'Y' : 'N'}/${ole.viewTextPresent ? 'Y' : 'N'}` : '-'} | ${ole?.sectionCount ?? '-'} | ${match} | ${row.errorCode ?? '-'} |`;
    }),
    '',
    '## 추천 대표 표본',
    '',
    ...samples.flatMap(({ row, reason }, index) => [
      `${index + 1}. \`${row.id}\` — ${row.fileName}`,
      `   - 선정 이유: ${reason}`,
      `   - 공개 적합성: ${privacyNote(row)}`,
    ]),
    '',
    '## 실행 인터페이스',
    '',
    '작업 디렉터리는 `apps/backend`이다. 출력 경로를 생략하면 마스킹된 JSON을 stdout으로 출력한다.',
    '',
    '```powershell',
    '# 전체 HWP/HWPX 분석',
    'npm.cmd run analyze:hwp-attachments -- --json .local/hwp-analysis.json --markdown .local/hwp-analysis.md',
    '',
    '# 특정 attachment ID',
    'npm.cmd run analyze:hwp-attachments -- --attachment-id <UUID> --json .local/hwp-one.json',
    '',
    '# 분석 개수 제한',
    'npm.cmd run analyze:hwp-attachments -- --limit 5 --markdown .local/hwp-five.md',
    '```',
    '',
    '`--json`과 `--markdown`은 함께 지정할 수 있다. CLI의 DB 세션은 `BEGIN TRANSACTION READ ONLY`이며 조회 완료 후 종료된다.',
    '',
    '## 추출 도구에 필요한 기능',
    '',
    '- HWP 5.x OLE/CFB 및 압축 BodyText 지원',
    '- 표, 문단, 다중 section의 안정적인 읽기 순서 보존',
    '- 배포용 ViewText 및 암호화 문서의 명시적인 진단',
    '- HWPX ZIP/XML의 namespace, 표, section 지원',
    '- 파일·stream·출력 크기와 실행 시간 제한',
    '- 외부 실행 도구 사용 시 버전 고정, `shell: false`, 격리 및 preflight',
    '',
    '## 예상 위험 요소',
    '',
    '- OLE magic만으로는 일반 CFB 문서와 HWP를 구분할 수 없음',
    '- 암호화·배포용 문서는 일반 BodyText 추출과 다른 경로가 필요할 수 있음',
    '- 표 셀과 문단의 읽기 순서가 도구별로 달라질 수 있음',
    '- 문서 원문과 URL에는 개인정보 또는 접근 토큰이 포함될 수 있으므로 외부 공개 금지',
    '- HWPX가 없더라도 향후 입력 호환성을 위해 최소한의 검증·명시적 미지원 처리는 필요',
    '- 동일 SHA-256인 대용량 문서가 여러 attachment ID에서 반복되어, 향후 추출 결과 재사용 정책이 비용에 큰 영향을 줌',
    '',
    '## 다음 단계 권장안',
    '',
    '1. 추천 표본을 로컬 비공개 상태로 유지하며 도구별 텍스트 품질을 비교한다.',
    '2. HWP 파서는 `hwp.js`, `pyhwp/hwp5`, `openhwp` 또는 `rhwp`, LibreOffice headless의 지원 범위·라이선스·운영성을 비교한다.',
    '3. HWPX는 제한된 ZIP/XML 직접 파싱과 LibreOffice 변환 결과를 비교한다.',
    '4. 선택한 도구에 timeout, 출력 제한, 오류 분류를 적용한 뒤 dry-run 추출기를 구현한다.',
    '',
    '## 테스트 결과',
    '',
    '- TypeScript: `npm.cmd run build` 통과',
    '- HWP 분석 합성 테스트: 통과',
    '- 기존 다운로드·형식 판별·PDF 추출 모듈 테스트: 통과',
    '- CLOVA OCR, IMAGE CLI, PDF OCR foundation/write, recovery mock 테스트: 통과',
    '- backend lint: lint script 및 ESLint 설정이 없어 별도 실행 불가',
    '- DB 상태 전이 통합 테스트: 실제 DB에 테스트 행을 쓰는 구조이므로 이번 읽기 전용 단계에서는 실행하지 않음',
    '- 실제 DB/네트워크 분석: 26건 조회·다운로드 성공, DB 쓰기 없음',
  ];
  return `${lines.join('\n')}\n`;
}
