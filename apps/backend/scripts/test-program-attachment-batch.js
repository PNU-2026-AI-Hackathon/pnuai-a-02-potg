const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  laneOf,
  isRetryable,
  statusOfFailure,
  isSingleSessionEvent,
  runBatch,
  summarize,
} = require('../src/cli/runProgramAttachmentBatch');
const { splitBatch } = require('../src/cli/reportProgramAttachmentBatch');
const { buildProgramAttachmentInventory } = require('../src/cli/buildProgramAttachmentInventory');

const crawlPath = process.env.PROGRAM_BOARD_CRAWL;
if (!crawlPath) throw new Error('PROGRAM_BOARD_CRAWL is required');
const records = JSON.parse(fs.readFileSync(path.resolve(crawlPath), 'utf8')).records;

// --- 경로 판정 -------------------------------------------------------------

const hwpAttachment = { name: 'a.hwp', url: 'https://x/a.hwp', route: 'HWP_TEXT', source: 'attachment' };
const imageAttachment = { name: 'a.jpg', url: 'https://x/a.jpg', route: 'IMAGE_OCR', source: 'attachment' };
const inlineImage = { name: '본문 이미지 1', url: 'https://x/i.jpg', route: 'IMAGE_OCR', source: 'inline_image' };

assert.equal(laneOf({ contentProfile: 'text_with_supplement', attachments: [hwpAttachment] }), 'DOC_EXTRACT');
assert.equal(laneOf({ contentProfile: 'image_only', attachments: [hwpAttachment] }), 'DOC_EXTRACT',
  '본문이 없어도 문서 첨부가 있으면 추출 경로를 탄다');
assert.equal(laneOf({ contentProfile: 'text_only', attachments: [] }), 'TEXT_ONLY');
assert.equal(laneOf({ contentProfile: 'text_with_supplement', attachments: [imageAttachment] }), 'TEXT_WITH_IMAGE');
assert.equal(laneOf({ contentProfile: 'text_with_supplement', attachments: [inlineImage] }), 'TEXT_WITH_IMAGE');
assert.equal(laneOf({ contentProfile: 'attachment_only', attachments: [imageAttachment] }), 'NO_TEXT_IMAGE_ONLY');
assert.equal(laneOf({ contentProfile: 'image_only', attachments: [inlineImage] }), 'NO_TEXT_IMAGE_ONLY');

// --- 실패 코드 해석 ---------------------------------------------------------

assert.equal(statusOfFailure('OCR_REQUIRED'), 'OCR_REQUIRED',
  '스캔 PDF는 파이프라인 결함이 아니라 OCR 정책 대기 상태다');
assert.equal(statusOfFailure('UNSUPPORTED_FILE_TYPE'), 'EXTRACTION_FAILED');
assert.equal(isRetryable('DOWNLOAD_TIMEOUT'), true);
assert.equal(isRetryable('UNSUPPORTED_FILE_TYPE'), false, '형식 미지원은 재실행해도 같은 결과다');
assert.equal(isRetryable('OCR_REQUIRED'), false);

// --- 단일 행사 판정 ---------------------------------------------------------

const oneDay = { programStartDate: '2024-08-11', programEndDate: '2024-08-11' };
const multiWeek = { programStartDate: '2023-09-14', programEndDate: '2023-11-09' };
assert.equal(isSingleSessionEvent(oneDay, '작가와의 만남'), true, '하루로 끝나는 행사는 회차가 없는 것이 정상이다');
assert.equal(isSingleSessionEvent(multiWeek, '영화 속 역사 이야기'), false, '여러 주에 걸친 프로그램은 단일 행사가 아니다');
assert.equal(isSingleSessionEvent(oneDay, '총 8회차로 운영합니다'), false,
  '하루로 보여도 본문이 N회차를 언급하면 단일 행사로 보지 않는다');
assert.equal(isSingleSessionEvent({ programStartDate: null, programEndDate: null }, ''), false,
  '교육기간 근거가 없으면 단일 행사로 확정하지 않는다');

// --- 첨부를 열지 않는 경로의 실제 배치 -------------------------------------
// 네트워크 없이 확인할 수 있도록 문서 추출 경로는 제외한다.

const inventory = buildProgramAttachmentInventory(records, 'all');
assert.equal(inventory.count, 351);
assert.equal(inventory.profile, 'all');

const offlineLanes = ['TEXT_ONLY', 'TEXT_WITH_IMAGE', 'NO_TEXT_IMAGE_ONLY'];
const common = {
  records,
  inventoryItems: inventory.items,
  lanes: offlineLanes,
  documentRoutes: null,
  limit: null,
  sourceIds: null,
  embeddedImageRoot: path.join(require('node:os').tmpdir(), 'program-attachment-batch-test'),
  previous: new Map(),
  retryFailedOnly: false,
};

runBatch(common).then((items) => {
  const docRecords = inventory.items.filter((item) => laneOf(item) === 'DOC_EXTRACT');
  assert.equal(items.length + docRecords.length, 351, '모든 레코드가 정확히 하나의 경로에 배정되어야 한다');
  assert.equal(new Set(items.map((item) => item.sourceId)).size, items.length);

  for (const item of items) {
    assert.ok(item.basicInfo, '첨부를 열지 않아도 기본정보는 생성되어야 한다');
    assert.ok(item.board, '본문 정제 결과는 항상 있어야 한다');
    assert.deepEqual(item.curriculum, [], '첨부를 열지 않았으면 회차를 만들어내면 안 된다');
    assert.equal('selectedText' in item, false, '첨부 원문을 게시 데이터에 넣으면 안 된다');
    assert.equal(item.failure, null);
  }

  const textOnly = items.filter((item) => item.lane === 'TEXT_ONLY');
  assert.equal(textOnly.length, 18);
  for (const item of textOnly) {
    assert.equal(item.reviewStatus, 'AUTO_REVIEW_CANDIDATE');
    assert.equal(item.attachmentReviewStatus, null, '첨부가 없으면 첨부 확인 축은 적용되지 않는다');
    assert.deepEqual(item.ocrTargets, []);
  }

  const ocrLanes = items.filter((item) => item.lane !== 'TEXT_ONLY');
  for (const item of ocrLanes) {
    assert.equal(item.reviewStatus, 'OCR_REQUIRED');
    assert.equal(item.attachmentReviewStatus, 'ATTACHMENT_UNCHECKED',
      '첨부를 확인하지 않은 레코드를 정제 완료로 분류하면 안 된다');
    assert.ok(item.ocrTargets.length > 0, 'OCR 대기 레코드는 대상 파일을 남겨야 한다');
  }

  // 본문이 있는 레코드는 먼저 게시할 수 있지만 첨부 확인은 끝나지 않은 상태여야 한다.
  const bodyPublishable = items.filter((item) => item.bodyPublishable);
  assert.equal(bodyPublishable.length, 18 + 126, '텍스트 전용 18건과 본문+이미지 126건이 본문 게시 가능해야 한다');
  const withImage = items.filter((item) => item.lane === 'TEXT_WITH_IMAGE');
  assert.equal(withImage.length, 126);
  for (const item of withImage) {
    assert.equal(item.bodyPublishable, true, '본문이 있으면 먼저 게시할 수 있어야 한다');
    assert.equal(item.reviewStatus, 'OCR_REQUIRED', '게시 가능해도 OCR 보완 전까지 완료가 아니다');
    assert.equal(item.attachmentReviewStatus, 'ATTACHMENT_UNCHECKED');
  }
  for (const item of items.filter((candidate) => candidate.lane === 'NO_TEXT_IMAGE_ONLY')) {
    assert.equal(item.bodyPublishable, false, '본문이 없으면 OCR 전까지 게시할 내용이 없다');
  }

  // --- 통계와 분류 산출물 ---------------------------------------------------

  const summary = summarize(items);
  assert.equal(summary.byStatus.AUTO_REVIEW_CANDIDATE, 18);
  assert.equal(summary.byStatus.OCR_REQUIRED, items.length - 18);
  assert.equal(summary.curriculumSessions, 0);
  assert.ok(summary.ocrQueueUniqueFiles < summary.ocrQueueRecords,
    '같은 포스터를 공유하는 레코드가 있으므로 고유 파일 수가 레코드 수보다 적어야 한다');

  const split = splitBatch(items);
  assert.equal(split.autoReview.length, 18);
  assert.equal(split.manualReview.length, 0);
  assert.equal(split.failures.length, 0);
  assert.equal(split.singleSessionEvents.length, 0, '첨부를 열지 않는 경로에서는 단일 행사 판정을 하지 않는다');
  assert.ok(split.ocrQueue.records.every((record) => 'bodyPublishable' in record));
  assert.equal(split.ocrQueue.records.length, items.length - 18);
  assert.ok(split.ocrQueue.uniqueFiles.length > 0);
  assert.ok(split.ocrQueue.uniqueFiles[0].sourceIds.length >= split.ocrQueue.uniqueFiles.at(-1).sourceIds.length,
    '고유 파일은 참조 레코드가 많은 순으로 정렬되어야 한다');
  for (const file of split.ocrQueue.uniqueFiles) {
    assert.equal('imageData' in file, false, 'OCR 큐에 이미지 자체를 저장하면 안 된다');
  }

  // --- OCR 결과가 있으면 이미지 경로도 게시판 데이터가 된다 -------------------

  const imageRecord = items.find((item) => item.lane === 'TEXT_WITH_IMAGE' && item.ocrTargets.length);
  const targetUrl = imageRecord.ocrTargets[0].url;
  // 좌우 두 단으로 나뉜 회차표를 흉내 낸다.
  const boxes = [];
  for (let index = 0; index < 4; index += 1) {
    boxes.push({ text: `${index + 1} 왼쪽 활동 ${index + 1}`, left: 0, right: 200, top: index * 40, bottom: index * 40 + 20, confidence: 0.95 });
    boxes.push({ text: `${index + 5} 오른쪽 활동 ${index + 1}`, left: 600, right: 800, top: index * 40, bottom: index * 40 + 20, confidence: 0.95 });
  }
  const ocrResult = (cleanedText) => new Map([[targetUrl, {
    url: targetUrl, status: 'OCR_COMPLETED', cleanedText, averageConfidence: 0.94, boxes,
  }]]);

  // 회차표가 있는 포스터: 사람이 회차를 채워야 하므로 수동 검수로 간다.
  const withTable = ocrResult('대상 유아 6-7세\n모집인원 12명\n차시 내용\n1 왼쪽 활동 1');
  return runBatch({ ...common, sourceIds: [imageRecord.sourceId], ocrByUrl: withTable }).then((enriched) => {
    const item = enriched[0];
    assert.equal(item.extractionRoute, 'IMAGE_OCR');
    assert.equal(item.attachmentReviewStatus, 'ATTACHMENT_ENRICHED',
      '첨부를 읽었으므로 더 이상 미확인 상태가 아니다');
    assert.equal(item.ocrConfidence, 0.94);
    assert.equal(item.ocrTargets.length, 0, '읽어낸 뒤에는 OCR 대기 목록에 남기지 않는다');
    assert.equal(item.curriculumExpected, true);
    assert.equal(item.reviewStatus, 'MANUAL_REVIEW_REQUIRED',
      '회차표가 있는데 싣지 못했으면 사람이 채워야 한다');

    // 회차는 좌표 추정이라 근거가 약해 게시 데이터에 싣지 않는다.
    // 실제 포스터에서 셀 경계가 겹치면 내용이 잘리거나 옆 단과 섞이는 것을 확인했다.
    assert.equal(item.curriculum.length, 0, 'OCR에서 복원한 회차는 게시하지 않는다');
    assert.ok(item.extractionWarnings.some((warning) => warning.code === 'OCR_CURRICULUM_NOT_PUBLISHED'),
      '회차를 싣지 않았다는 사실을 검수자가 알 수 있게 남겨야 한다');

    // 기본정보는 OCR 추출문에서 가져오되 뒤따라온 다음 항목은 잘라낸다.
    const location = item.basicInfo.find((info) => info.label === '교육장소' || info.label === '상세 운영장소');
    if (location) assert.equal(/재료비|학습자/.test(location.value), false, '값에 다음 항목 이름이 섞이면 안 된다');

    // 회차표가 없는 안내문: 채울 회차가 없으므로 대조만 하면 된다.
    // 기본정보와 충돌하는 값을 넣으면 그 사유로 수동 검수가 되므로 중립적인 문구만 쓴다.
    const noTable = ocrResult('신청방법 선착순 접수\n문의 금정구 평생교육과');
    return runBatch({ ...common, sourceIds: [imageRecord.sourceId], ocrByUrl: noTable }).then((plain) => {
      assert.equal(plain[0].curriculumExpected, false);
      assert.equal(plain[0].reviewStatus, 'AUTO_REVIEW_CANDIDATE',
        '회차가 원래 없는 안내문까지 수동 검수로 보내면 실제로 손봐야 할 건이 묻힌다');
      assert.equal(plain[0].extractionWarnings.some((warning) => warning.code === 'OCR_CURRICULUM_NOT_PUBLISHED'), false,
        '채울 회차가 없으면 회차 경고를 남기지 않는다');
    });
  }).then(() => {

  // --- 재개 동일성 -----------------------------------------------------------

  return runBatch({ ...common, limit: 5 }).then((partial) => {
    const previous = new Map(partial.map((item) => [item.sourceId, item]));
    return runBatch({ ...common, previous }).then((rerun) => {
      for (const item of partial) {
        const again = rerun.find((candidate) => candidate.sourceId === item.sourceId);
        assert.deepEqual(again, item, '같은 입력은 재실행해도 같은 결과를 내야 한다');
      }
      console.log('Program attachment batch tests passed.');
    });
  });
  });
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
