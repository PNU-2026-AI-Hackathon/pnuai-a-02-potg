const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const {
  selectFiles,
  classifyOcrResult,
  decodeDataUrl,
  isDataUrl,
  OCR_EXTRA_ALLOWED_HOSTS,
  OCR_RESULTS_ALWAYS_REVIEWED,
} = require('../src/cli/runProgramOcrBatch');
const { getAttachmentOcrConfig } = require('../src/config/attachmentOcr');

// --- 정책 설정값 --------------------------------------------------------------

const defaults = getAttachmentOcrConfig({});
assert.equal(defaults.ocrMaxCalls, 300, '호출 상한 기본값은 확정된 정책과 같아야 한다');
assert.equal(defaults.ocrMinConfidence, 0.8, '최소 신뢰도 기본값은 확정된 정책과 같아야 한다');
assert.equal(OCR_RESULTS_ALWAYS_REVIEWED, true, 'OCR 결과는 신뢰도와 무관하게 전량 검수한다');

const overridden = getAttachmentOcrConfig({ ATTACHMENT_OCR_MAX_CALLS: '50', ATTACHMENT_OCR_MIN_CONFIDENCE: '0.9' });
assert.equal(overridden.ocrMaxCalls, 50);
assert.equal(overridden.ocrMinConfidence, 0.9);
assert.throws(() => getAttachmentOcrConfig({ ATTACHMENT_OCR_MIN_CONFIDENCE: '1.5' }),
  '신뢰도는 0~1을 벗어나면 거부해야 한다');
assert.throws(() => getAttachmentOcrConfig({ ATTACHMENT_OCR_MAX_CALLS: '0' }),
  '호출 상한 0은 거부해야 한다');

// --- 결과 분류 ----------------------------------------------------------------

const ok = { isEmpty: false, fieldCount: 12 };
assert.equal(classifyOcrResult({ ...ok, averageConfidence: 0.95 }, 0.8), 'OCR_COMPLETED');
assert.equal(classifyOcrResult({ ...ok, averageConfidence: 0.8 }, 0.8), 'OCR_COMPLETED', '기준값과 같으면 통과다');
assert.equal(classifyOcrResult({ ...ok, averageConfidence: 0.79 }, 0.8), 'OCR_LOW_CONFIDENCE');
assert.equal(classifyOcrResult({ ...ok, averageConfidence: undefined }, 0.8), 'OCR_LOW_CONFIDENCE',
  '신뢰도를 알 수 없으면 믿지 않고 검수로 보낸다');

// 글자가 없는 이미지는 장식용으로 본다. 신뢰도가 높아도 이 판정이 우선이다.
assert.equal(classifyOcrResult({ isEmpty: true, fieldCount: 0, averageConfidence: 0.99 }, 0.8), 'OCR_NO_TEXT');
assert.equal(classifyOcrResult({ isEmpty: false, fieldCount: 0, averageConfidence: 0.99 }, 0.8), 'OCR_NO_TEXT');

// --- 본문 내장 이미지(data URL) ------------------------------------------------

assert.equal(isDataUrl('data:image/png;base64,iVBORw0KGgo='), true);
assert.equal(isDataUrl('https://www.geumjeong.go.kr/a.png'), false);

const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-data-url-'));
try {
  // 1x1 PNG
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const decoded = decodeDataUrl(`data:image/png;base64,${png}`, workDir);
  assert.ok(fs.existsSync(decoded.tempFilePath), '본문 내장 이미지를 파일로 만들어야 한다');
  assert.equal(decoded.byteSize, Buffer.from(png, 'base64').length);
  assert.equal(decoded.responseContentType, 'image/png');
  assert.match(decoded.checksumSha256, /^[0-9a-f]{64}$/, '체크섬으로 중복을 접을 수 있어야 한다');
  assert.throws(() => decodeDataUrl('https://x/a.png', workDir), 'data URL이 아니면 거부한다');
} finally {
  fs.rmSync(workDir, { recursive: true, force: true });
}

// --- 호스트 허용 범위 ----------------------------------------------------------

assert.deepEqual(OCR_EXTRA_ALLOWED_HOSTS, ['blog.kakaocdn.net'],
  '이 배치에서 추가로 여는 호스트는 정확히 하나여야 한다');
assert.ok(OCR_EXTRA_ALLOWED_HOSTS.every((host) => !host.includes('*')),
  '와일드카드 호스트를 허용하면 안 된다');

// --- 대상 선택 ----------------------------------------------------------------

const queue = {
  records: [
    { sourceId: 1, hasBodyText: false, targets: [] },
    { sourceId: 2, hasBodyText: true, targets: [] },
    { sourceId: 3, hasBodyText: false, targets: [] },
  ],
  uniqueFiles: [
    { url: 'https://x/a.png', name: 'a.png', sourceIds: [1] },
    { url: 'https://x/b.png', name: 'b.png', sourceIds: [2] },
    { url: 'https://x/c.png', name: 'c.png', sourceIds: [1, 3] },
  ],
};

assert.equal(selectFiles(queue, 'all').length, 3);
assert.deepEqual(selectFiles(queue, 'no-body').map((file) => file.name), ['a.png', 'c.png'],
  '본문이 없는 레코드가 참조하는 파일만 골라야 한다');
assert.deepEqual(selectFiles(queue, 'with-body').map((file) => file.name), ['b.png']);

console.log('Program OCR batch tests passed.');
