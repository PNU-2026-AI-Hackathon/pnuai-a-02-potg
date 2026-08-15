const assert = require('node:assert/strict');
const {
  groupLines,
  splitColumns,
  curriculumFromColumn,
  curriculumFromOcrBoxes,
} = require('../src/services/programAttachmentEnrichment/ocrLayout');

/** 글자 상자 하나. 실제 OCR 응답과 같은 모양으로 만든다. */
function box(text, left, top, width = text.length * 10, height = 20) {
  return { text, left, top, right: left + width, bottom: top + height, confidence: 0.95 };
}

// --- 같은 줄 묶기 ------------------------------------------------------------

const lines = groupLines([
  box('오누이', 100, 100),
  box('그림자동화', 200, 104), // 살짝 어긋나도 같은 줄
  box('다음줄', 100, 140),
]);
assert.equal(lines.length, 2, '세로로 겹치는 조각은 한 줄로 묶어야 한다');
assert.equal(lines[0].text, '오누이 그림자동화');
assert.equal(lines[1].text, '다음줄');

// --- 단 나누기 ---------------------------------------------------------------

// 왼쪽 단(x 0~200)과 오른쪽 단(x 600~800)이 넓게 떨어져 있다.
const twoColumnBoxes = [];
for (let index = 0; index < 4; index += 1) {
  twoColumnBoxes.push(box(`${index + 1} 왼쪽활동${index + 1}`, 0, index * 40));
  twoColumnBoxes.push(box(`${index + 5} 오른쪽활동${index + 1}`, 600, index * 40));
}
const columns = splitColumns(groupLines(twoColumnBoxes));
assert.equal(columns.length, 2, '가운데가 비어 있으면 두 단으로 나눠야 한다');

// --- 한 단에서 회차 읽기 -----------------------------------------------------

const columnRows = curriculumFromColumn(groupLines([
  box('1 오리엔테이션', 0, 0),
  box('라포 형성하기', 0, 30), // 번호 없는 줄은 앞 회차에 이어진다
  box('2 책 읽고 나누기', 0, 60),
]));
assert.deepEqual(columnRows.map((row) => row.session), [1, 2]);
assert.equal(columnRows[0].activity, '오리엔테이션\n라포 형성하기');

assert.deepEqual(
  curriculumFromColumn(groupLines([box('1회차 첫 수업', 0, 0), box('2차시 둘째 수업', 0, 40)]))
    .map((row) => row.session),
  [1, 2],
  '회차·차시 단위가 붙어 있어도 읽어야 한다',
);

// --- 2단 표 전체 복원 --------------------------------------------------------

const restored = curriculumFromOcrBoxes(twoColumnBoxes);
assert.equal(restored.length, 8, '좌우 두 단을 합쳐 8회차가 나와야 한다');
assert.deepEqual(restored.map((row) => row.session), [1, 2, 3, 4, 5, 6, 7, 8]);
assert.match(restored[0].activity, /왼쪽활동1/);
assert.match(restored[4].activity, /오른쪽활동1/, '5회차는 오른쪽 단의 첫 줄이어야 한다');

// --- 근거가 약하면 배치하지 않는다 -------------------------------------------

assert.deepEqual(curriculumFromOcrBoxes([]), []);
assert.deepEqual(
  curriculumFromOcrBoxes([box('1 하나', 0, 0), box('1 또하나', 600, 0)]),
  [],
  '회차 번호가 겹치면 순서를 확정할 수 없으므로 배치하지 않는다',
);
assert.deepEqual(
  curriculumFromOcrBoxes([box('3 셋', 0, 0), box('5 다섯', 0, 40), box('9 아홉', 0, 80)]),
  [],
  '회차가 1부터 이어지지 않으면 표로 보지 않는다',
);

console.log('Program OCR layout tests passed.');
