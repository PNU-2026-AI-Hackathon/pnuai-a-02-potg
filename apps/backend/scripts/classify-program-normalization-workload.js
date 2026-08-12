const fs = require('node:fs');
const path = require('node:path');

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/classify-program-normalization-workload.js <crawl.json>');

const payload = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
const knownLabels = new Set([
  '프로그램명', '강좌명', '수업명', '선정도서', '주제도서', '도서명', '주제', '교육내용', '수업내용',
  '활동내용', '내용', '준비물', '학습자준비물', '운영일시', '교육일시', '강의일시', '수업일시',
  '일시', '소요시간', '수업시간', '강의시간', '운영장소', '교육장소', '강의장소', '수업장소',
  '장소', '운영방법', '교육방법', '진행방법', '신청일시', '접수일시', '신청기간', '접수기간',
  '신청방법', '접수방법', '추첨일시', '추첨일자', '추첨발표', '당첨발표', '결과발표', '문의',
  '문의사항', '문의전화', '연락처',
]);

const groups = { ruleStructured: [], textPreserved: [], attachmentOnly: [], empty: [] };
for (const record of payload.records) {
  const recognized = record.detailText.split(/\r?\n/).filter((line) => {
    const match = line.replace(/^[\s*※★○●■□▢❏◇◆▶▷]+/, '').match(/^(.{1,20}?)\s*[:：]/);
    return match && knownLabels.has(match[1].replace(/[\s·ㆍ()（）]/g, ''));
  }).length;
  const item = { idx: record.idx, title: record.title, recognizedFields: recognized };
  if (recognized >= 2) groups.ruleStructured.push(item);
  else if (record.detailText.trim()) groups.textPreserved.push(item);
  else if (record.hasAttachments) groups.attachmentOnly.push(item);
  else groups.empty.push(item);
}

console.log(JSON.stringify({
  total: payload.records.length,
  summary: Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, values.length])),
  interpretation: {
    ruleStructured: '규칙 기반 자동 구조화 후보',
    textPreserved: '원문 보존 가능, 표준화 품질 검수 후보',
    attachmentOnly: '첨부파일 또는 이미지 확인 필요',
    empty: '본문·첨부 없음; 원사이트 확인 또는 정제 제외 후보',
  },
  groups,
}, null, 2));
