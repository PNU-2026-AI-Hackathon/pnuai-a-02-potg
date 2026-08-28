const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const moduleRoot = process.env.PROGRAM_BOARD_MODULE_ROOT
  ? path.resolve(process.env.PROGRAM_BOARD_MODULE_ROOT)
  : path.resolve(__dirname, '../dist');
const normalizerFile = path.join(moduleRoot, 'services/programDataNormalization/normalizer');
const { normalizeProgram } = require(normalizerFile);

const crawlPath = process.env.PROGRAM_BOARD_CRAWL;
if (!crawlPath) throw new Error('PROGRAM_BOARD_CRAWL is required');
const records = JSON.parse(fs.readFileSync(crawlPath, 'utf8')).records;
const byId = new Map(records.map((record) => [record.idx, record]));
const normalize = (idx) => normalizeProgram(byId.get(idx));
const comparable = (value) => String(value ?? '')
  .replace(/^[^\p{L}\p{N}]+/u, '')
  .replace(/[^\p{L}\p{N}]+$/u, '')
  .replace(/\s+/g, '');

// 제외는 idx 하드코딩이 아니라 조건 규칙으로 판정해야 한다.
const excluded = records.map(normalizeProgram).filter((item) => item.isExcluded);
assert.equal(excluded.length, 1, '제외 대상은 테스트 레코드 1건이어야 한다');
assert.equal(excluded[0].exclusionReason, 'TEST_TITLE');

// 기본정보 표에서 오는 필드는 전건 채워져야 한다.
for (const record of records) {
  const normalized = normalizeProgram(record);
  if (normalized.isExcluded) continue;
  assert.ok(normalized.targetGroup, `대상 구분 누락: ${record.idx}`);
  assert.ok(normalized.capacity !== null, `모집인원 누락: ${record.idx}`);
  assert.ok(normalized.programStartDate, `교육기간 누락: ${record.idx}`);
}

// 안내문은 항목명을 지어내지 않고 원문 줄 그대로 옮긴다.
const hook = normalize(4337);
const privacy = hook.board.notices.find((group) => group.id === 'privacy');
assert.ok(privacy, '촬영 안내가 이용 안내로 분류되어야 한다');
assert.ok(privacy.lines.some((line) => line.includes('촬영 및 활용')), '원문 줄이 그대로 보존되어야 한다');
assert.ok(!hook.board.intro.some((line) => line.includes('촬영 및 활용')), '본문 소개에 남아 있으면 안 된다');

// 문장이 끝나지 않은 줄은 옮기지 않는다(문장이 쪼개지므로).
const bookClub = normalize(3355);
assert.ok(
  bookClub.board.intro.some((line) => line.includes('독서회 참석을 신청하시는분들께는')),
  '종결되지 않은 줄은 원래 자리에 남아야 한다',
);

// 제목 태그가 없으면 본문 장소에서 도서관을 찾는다.
const wreath = normalize(2990);
assert.equal(wreath.libraryName, '금정북파크 작은도서관');
assert.equal(wreath.evidence.libraryNameSource, 'body_location');

// 텍스트형 17건은 정제 데이터 단계에서 제목과 라벨 항목이 소개에 반복되면 안 된다.
const textOnlyIds = [2634, 2990, 3052, 3105, 3130, 3175, 3276, 3355, 3390, 3408, 4103, 4104, 4105, 4194, 4351, 4353, 4354];
for (const idx of textOnlyIds) {
  const item = normalize(idx);
  const intro = item.board.intro.map(comparable);
  assert.ok(!intro.includes(comparable(item.title)), `소개에 제목이 반복됨: ${idx}`);
  const sectionValues = item.board.sections.flatMap((section) => section.items.map((entry) => comparable(entry.value)));
  assert.equal(
    intro.filter((line) => sectionValues.includes(line)).length,
    0,
    `소개와 구조화 항목 값이 반복됨: ${idx}`,
  );
}

for (const idx of [3052, 3105, 3130]) {
  const item = normalize(idx);
  assert.equal(item.board.sections.filter((section) => section.id === 'content').length, 1, `소개 구획 중복: ${idx}`);
  assert.equal(item.board.intro.filter((line) => /벙개\s*독서회$/.test(line.trim())).length, 0, `독서회 제목 중복: ${idx}`);
}

// 표가 있는 레코드는 표 내용이 소개에 중복되지 않아야 한다.
const science = normalize(4350);
assert.ok(science.board.intro.length === 0, '표 내용이 프로그램 소개에 중복되면 안 된다');
const cellImages = byId.get(4350).programContent.tables
  .flatMap((table) => table.rows.flatMap((row) => row.cells.flatMap((cell) => cell.images)));
assert.ok(cellImages.length > 0, '표 셀 이미지가 수집되어야 칸이 비지 않는다');

// 반복 회차는 같은 seriesKey로 묶인다.
const seriesA = normalize(2952);
const seriesB = normalize(2953);
assert.equal(seriesA.seriesKey, seriesB.seriesKey, '같은 프로그램의 다른 회차는 같은 키여야 한다');
assert.notEqual(seriesA.occurrenceLabel, seriesB.occurrenceLabel, '회차 표기는 서로 달라야 한다');

console.log('Program board data tests passed.');
