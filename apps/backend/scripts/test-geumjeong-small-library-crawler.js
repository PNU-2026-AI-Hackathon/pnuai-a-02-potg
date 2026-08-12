const assert = require('node:assert/strict');
const path = require('node:path');
const {
  normalizeMultilineText,
  parseDetailPage,
} = require(process.env.GEUMJEONG_CRAWLER_MODULE
  ? path.resolve(process.env.GEUMJEONG_CRAWLER_MODULE)
  : '../dist/cli/geumjeongSmallLibraryCrawler');

assert.equal(
  normalizeMultilineText(' 첫 줄  \r\n\r\n 둘째\t줄 \n '),
  '첫 줄\n둘째 줄',
);

const html = `
  <html><body>
    <table>
      <caption>[아이꿈자람] 테스트가 아닌 프로그램</caption>
      <tbody>
        <tr><th>대상</th><td>어린이 유아 6-7세</td></tr>
        <tr><th>모집인원</th><td>10</td></tr>
        <tr><th>교육기간</th><td>2026-08-01 ~ 2026-08-31</td></tr>
        <tr>
          <td colspan="2">
            <p>운영장소 : 작은도서관 강의실<br>온라인 전환 가능</p>
            <div>수 강 료 : 무료</div>
            <ul><li>재료비 5,000원</li><li>준비물 지참</li></ul>
          </td>
        </tr>
      </tbody>
    </table>
  </body></html>
`;

const result = parseDetailPage(html, 'https://example.com/program?idx=123', 123);
assert.deepEqual(result.basicInfo, {
  대상: '어린이 유아 6-7세',
  모집인원: '10',
  교육기간: '2026-08-01 ~ 2026-08-31',
});
assert.equal(result.title, '[아이꿈자람] 테스트가 아닌 프로그램');
assert.equal(result.detailText, [
  '운영장소 : 작은도서관 강의실',
  '온라인 전환 가능',
  '수 강 료 : 무료',
  '재료비 5,000원',
  '준비물 지참',
].join('\n'));
assert.equal(result.detailText.includes('\n'), true);
assert.equal(result.hasAttachments, false);

console.log('Geumjeong small library crawler tests passed.');
