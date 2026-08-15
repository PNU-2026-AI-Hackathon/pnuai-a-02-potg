const assert = require('node:assert/strict');
const {
  groupLines,
  splitColumns,
  curriculumFromColumn,
  curriculumFromOcrBoxes,
  readSessionCell,
  activityPlanFromOcrBoxes,
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

// --- 머리글 격자로 표 복원 ---------------------------------------------------

/**
 * 실제 강의계획서 이미지의 배치를 흉내 낸다.
 * 회차 칸은 좁고 내용 칸은 넓으며, 머리글 `세부 교육내용`은 두 조각으로 끊겨 온다.
 */
function planBoxes() {
  const boxes = [
    box('차시', 140, 0, 40),
    box('세부', 449, 0, 40),
    box('교육내용', 489, 0, 80),
    box('교수방법', 838, 0, 80),
  ];
  const titles = ['오일파스텔 기초 연습', '눈 내린 오두막집 그리기', '케이크 테이블 그리기', '플라워리스 그리기'];
  for (const [index, title] of titles.entries()) {
    const top = 60 + index * 60;
    boxes.push(box(`${index + 1}회차`, 140, top + 15, 50));
    boxes.push(box('-', 257, top, 10));
    boxes.push(box(title, 283, top, 300));
  }
  return boxes;
}

const plan = curriculumFromOcrBoxes(planBoxes());
assert.equal(plan.length, 4, '머리글이 있으면 회차를 복원해야 한다');
assert.deepEqual(plan.map((row) => row.session), [1, 2, 3, 4], '`1회차` 표기도 회차 번호로 읽어야 한다');
assert.match(plan[0].activity, /^- 오일파스텔 기초 연습/,
  '내용 칸 왼쪽 끝을 회차 번호 기준으로 잡아 첫 낱말이 잘리지 않아야 한다');
assert.match(plan[2].activity, /케이크/);

// --- 근거가 약하면 배치하지 않는다 -------------------------------------------

assert.deepEqual(curriculumFromOcrBoxes([]), []);
assert.deepEqual(
  curriculumFromOcrBoxes(twoColumnBoxes), [],
  '머리글 없이 줄만 보고 읽으면 옆 단과 섞이므로 복원하지 않는다',
);

const skipped = planBoxes().filter((item) => !/^2회차$/.test(item.text));
assert.deepEqual(curriculumFromOcrBoxes(skipped), [],
  '회차가 1부터 이어지지 않고 날짜도 없으면 표로 보지 않는다');

// --- 회차 칸 표기 ------------------------------------------------------------

assert.deepEqual(readSessionCell('1회차'), { session: 1, date: null });
assert.deepEqual(readSessionCell('1차시(4.8.)'), { session: 1, date: '4.8.' },
  '괄호에 든 날짜까지 읽어야 한다');
assert.deepEqual(readSessionCell('5/7'), { session: null, date: '5/7' },
  '날짜만 적어 회차를 가르는 계획서가 있다');
assert.deepEqual(readSessionCell('l'), { session: 1, date: null },
  'OCR이 숫자 1을 알파벳 l로 읽는 일이 잦다');
assert.equal(readSessionCell('가나다'), null);

// --- 날짜만 있는 회차 표 -----------------------------------------------------

function datedBoxes() {
  const boxes = [box('회차', 140, 0, 40), box('교육일자', 300, 0, 80), box('동화명', 600, 0, 60)];
  const titles = ['신기한 씨앗가게', '우리는 친구', '북극곰이 녹아요'];
  for (const [index, title] of titles.entries()) {
    const top = 60 + index * 60;
    // 회차 칸에 표 밖의 숫자가 섞여 번호가 어긋난 상황
    boxes.push(box(`${index * 2 + 1}`, 140, top, 20));
    boxes.push(box(`9/${6 + index * 7}`, 300, top, 60));
    boxes.push(box(title, 600, top, 200));
  }
  return boxes;
}

const dated = curriculumFromOcrBoxes(datedBoxes());
assert.deepEqual(dated.map((row) => row.session), [1, 2, 3],
  '번호가 어긋나도 날짜가 있으면 위에서부터 차례로 매긴다');
assert.deepEqual(dated.map((row) => row.date), ['9/6', '9/13', '9/20']);
assert.match(dated[0].activity, /신기한 씨앗가게/);

// --- 회차 표 없이 활동 계획만 적은 계획서 ------------------------------------

const planOnly = [
  box('<활동 계획>', 100, 0, 120),
  box('1.도입', 100, 40, 60),
  box('-글라스아트란 무엇인지 알아본다.', 100, 80, 300),
  box('<예시작 사진>', 100, 140, 120),
  box('여기는 담아선 안 되는 꼬리말', 100, 180, 300),
];
const plan2 = activityPlanFromOcrBoxes(planOnly);
assert.match(plan2, /1\.도입/);
assert.match(plan2, /글라스아트란/);
assert.equal(/꼬리말/.test(plan2), false, '예시작 사진 뒤는 활동 계획이 아니다');
assert.equal(activityPlanFromOcrBoxes([box('그냥 안내문', 0, 0)]), null);

console.log('Program OCR layout tests passed.');
