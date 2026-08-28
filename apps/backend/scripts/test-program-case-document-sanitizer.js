const assert = require('node:assert/strict');
const {
  containsForbiddenProgramCaseSearchPattern,
  sanitizeProgramCaseSearchText,
} = require('../dist/services/programCaseDocument/programCaseDocumentSanitizer');

const sanitize = (value, context = 'RAW_TEXT') =>
  sanitizeProgramCaseSearchText(value, context);

const fakePhone = ['010', '0000', '0000'].join('-');
const fakeEmail = ['sample', 'example.invalid'].join('@');
const result = sanitize([
  '해오름도서관 여름 독서 프로그램',
  '일정: 2026-08-01',
  '모집 인원: 20명',
  '비용: 10,000원',
  `신청자 성명: 테스트이름 ${fakePhone}`,
  `문의: ${fakeEmail}`,
  '생년월일: 2010-01-01',
  '계좌번호: 000-000-000000',
  '상세주소: 테스트시 테스트구 테스트로 1',
].join('\n'));

assert.match(result.text, /해오름도서관/);
assert.match(result.text, /여름 독서 프로그램/);
assert.match(result.text, /2026-08-01/);
assert.match(result.text, /20명/);
assert.match(result.text, /10,000원/);
assert.doesNotMatch(result.text, /테스트이름/);
assert.equal(containsForbiddenProgramCaseSearchPattern(result.text), false);
assert.deepEqual(sanitize(result.text), {
  text: result.text,
  removedCategories: [],
  changed: false,
});

for (const label of ['참여자 명단', '출석부', '개인정보 수집·이용 동의서', '강사 이력서']) {
  const highRisk = sanitize(`${label}\n테스트 행`, 'ATTACHMENT_TEXT');
  assert.equal(highRisk.text, '');
  assert.deepEqual(highRisk.removedCategories, ['HIGH_RISK_DOCUMENT']);
}
assert.match(sanitize('신청 방법: 공식 홈페이지 이용', 'ATTACHMENT_TEXT').text, /신청 방법/);
assert.equal(sanitize('').text, '');
assert.equal(sanitize('한글 Unicode 보존').text, '한글 Unicode 보존');
assert.equal(JSON.stringify(result).includes(fakePhone), false);
assert.equal(JSON.stringify(result).includes(fakeEmail), false);
console.log(JSON.stringify({ passed: true, cases: 16 }));
