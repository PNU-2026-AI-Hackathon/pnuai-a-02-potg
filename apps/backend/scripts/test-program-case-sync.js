const assert = require('assert/strict');
const { requireInternalApiKey } = require('../dist/middleware/internalApiKey');
const { validateProgramCaseSyncRequest } = require('../dist/validators/programCaseSync');

function sampleProgram() {
  return {
    sourceType: 'TEST_SOURCE',
    sourcePostId: '1',
    sourceUrl: 'https://example.com/programs/1',
    title: '테스트 프로그램',
    targetAudience: '전체',
    instructor: '강사',
    capacity: 10,
    currentApplicants: 2,
    applicationStatus: '접수중',
    educationStartDate: '2026-08-01',
    educationEndDate: '2026-08-02',
    location: null,
    feeText: null,
    preparationText: null,
    contactText: null,
    notices: '',
    sessions: [{ sessionNumber: 1, dateText: '2026-08-01', activity: '활동' }],
    attachments: [{
      fileName: '안내.pdf',
      fileUrl: 'https://example.com/files/1.pdf',
      fileType: 'pdf',
      extractionStatus: 'PENDING',
    }],
    hasUnparsedAttachments: false,
    rawText: '',
    crawledAt: '2026-07-20T00:00:00.000Z',
    requestSucceeded: true,
    parseWarnings: [],
  };
}

function expectInvalid(programs, expectedPath) {
  const result = validateProgramCaseSyncRequest({ programs });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.path === expectedPath), `missing issue at ${expectedPath}`);
}

function mockResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function testValidation() {
  const directArray = validateProgramCaseSyncRequest([sampleProgram()]);
  assert.equal(directArray.ok, true);
  assert.equal(directArray.programs.length, 1);
  assert.equal(directArray.programs[0].attachments[0].extractionStatus, 'PENDING');

  expectInvalid({}, 'programs');
  expectInvalid([], 'programs');

  const missingTitle = sampleProgram();
  delete missingTitle.title;
  expectInvalid([missingTitle], 'programs[0].title');

  const badDate = sampleProgram();
  badDate.educationStartDate = '2026-02-30';
  expectInvalid([badDate], 'programs[0].educationStartDate');

  const badNumber = sampleProgram();
  badNumber.capacity = '10';
  expectInvalid([badNumber], 'programs[0].capacity');

  const duplicatePrograms = [sampleProgram(), sampleProgram()];
  expectInvalid(duplicatePrograms, 'programs[1]');

  const duplicateSessions = sampleProgram();
  duplicateSessions.sessions.push({ ...duplicateSessions.sessions[0] });
  expectInvalid([duplicateSessions], 'programs[0].sessions[1].sessionNumber');

  const duplicateAttachments = sampleProgram();
  duplicateAttachments.attachments.push({ ...duplicateAttachments.attachments[0] });
  expectInvalid([duplicateAttachments], 'programs[0].attachments[1].fileUrl');
}

function testAuthentication() {
  const originalKey = process.env.INTERNAL_API_KEY;
  try {
    delete process.env.INTERNAL_API_KEY;
    let response = mockResponse();
    requireInternalApiKey({ header: () => undefined }, response, () => assert.fail('next called'));
    assert.equal(response.statusCode, 503);

    process.env.INTERNAL_API_KEY = 'test-internal-key';
    response = mockResponse();
    requireInternalApiKey({ header: () => undefined }, response, () => assert.fail('next called'));
    assert.equal(response.statusCode, 401);

    response = mockResponse();
    requireInternalApiKey({ header: () => 'wrong-key' }, response, () => assert.fail('next called'));
    assert.equal(response.statusCode, 401);

    let nextCalled = false;
    response = mockResponse();
    requireInternalApiKey({ header: () => 'test-internal-key' }, response, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(response.statusCode, 200);
  } finally {
    if (originalKey === undefined) delete process.env.INTERNAL_API_KEY;
    else process.env.INTERNAL_API_KEY = originalKey;
  }
}

testValidation();
testAuthentication();
console.log('Program case sync validation and authentication tests passed.');
