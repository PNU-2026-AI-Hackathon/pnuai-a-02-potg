const assert = require('assert/strict');
const { AttachmentProcessingError } = require('../dist/services/attachment/attachmentErrors');
const { classifyImageAnalysisFailure } = require('../dist/services/attachment/imageOcrFailureDiagnostic');

const classify = (code, message = 'safe', retryable = false, stage = 'HTTP_REQUEST') =>
  classifyImageAnalysisFailure(new AttachmentProcessingError(code, message, retryable), stage);

assert.deepEqual(
  [classify('DOWNLOAD_TIMEOUT').code, classify('DOWNLOAD_TIMEOUT').category],
  ['REQUEST_TIMEOUT', 'TEMPORARY_NETWORK'],
);
assert.equal(classify('DOWNLOAD_FAILED', 'Attachment server returned HTTP 404.').code, 'HTTP_NOT_FOUND');
assert.equal(classify('DOWNLOAD_FAILED', 'Attachment server returned HTTP 403.').code, 'HTTP_FORBIDDEN');
assert.equal(classify('DOWNLOAD_FAILED', 'Attachment server returned HTTP 500.').code, 'HTTP_SERVER_ERROR');
assert.equal(classify('DOWNLOAD_FAILED').code, 'NETWORK_CONNECTION_FAILED');
assert.equal(classify('HOST_NOT_ALLOWED').code, 'SOURCE_NOT_ALLOWED');
assert.equal(classify('HTML_RESPONSE', 'safe', false, 'FILE_SIGNATURE').code, 'HTML_RESPONSE_RECEIVED');
assert.equal(classify('FILE_TYPE_MISMATCH', 'safe', false, 'FILE_SIGNATURE').code, 'SIGNATURE_METADATA_MISMATCH');
assert.equal(classify('IMAGE_DECODE_FAILED', 'safe', false, 'IMAGE_METADATA').category, 'PERMANENT_INPUT');
assert.equal(classify('UNKNOWN_ERROR').category, 'UNKNOWN');
assert.equal(JSON.stringify(classify('DOWNLOAD_FAILED')).includes('safe'), false);
console.log('Image OCR failure diagnostic classification tests passed with safe mock errors only.');
