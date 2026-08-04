const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createPdf } = require('./attachment-test-helpers');
const { sha256, stableJson, deterministicRecordId, assertRecord } = require('../dist/services/programCaseAttachmentRepresentation/common');
const { buildPdfRepresentation } = require('../dist/services/programCaseAttachmentRepresentation/pdfRepresentation');
const { parseHwpMarkdown } = require('../dist/services/programCaseAttachmentRepresentation/hwpRepresentation');
const { sanitizeClovaResponse, buildOcrRepresentation } = require('../dist/services/programCaseAttachmentRepresentation/ocrRepresentation');
const { buildSectionCandidates, buildProgramCaseCandidates } = require('../dist/services/programCaseAttachmentRepresentation/candidateBuilders');
const { parseRepresentationArguments } = require('../dist/cli/programCaseAttachmentRepresentation');

function source(root, bytes, detectedType = 'PNG') {
  const sourceSha256 = sha256(bytes); const absolutePath = path.join(root, `${sourceSha256}.bin`); fs.writeFileSync(absolutePath, bytes);
  return { sourceSha256, binarySnapshotRef: `sha256/${sourceSha256}/original.bin`, absolutePath, detectedType,
    mimeType: detectedType === 'PDF' ? 'application/pdf' : 'image/png', linkedAttachmentIds: ['attachment-1'], linkedProgramCaseIds: ['program-1'] };
}

function response(lineBreak = true) {
  const field = (inferText, inferConfidence, x, y, end) => ({ inferText, inferConfidence, lineBreak: end,
    boundingPoly: { vertices: [{ x, y }, { x: x + 40, y }, { x: x + 40, y: y + 12 }, { x, y: y + 12 }] } });
  return { images: [{ inferResult: 'SUCCESS', fields: [field('프로그램', 0.9, 10, 10, lineBreak ? false : undefined),
    field('안내', 0.8, 60, 10, lineBreak ? true : undefined), field('대상 어린이', 0.7, 10, 80, lineBreak ? true : undefined)] }] };
}

(async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'attachment-representation-test-'));
  try {
    const imageSource = source(root, Buffer.from('fixture-image'));
    const id1 = deterministicRecordId({ sourceSha256: imageSource.sourceSha256, kind: 'X', structuralPosition: '1', content: { b: 2, a: 1 } });
    const id2 = deterministicRecordId({ sourceSha256: imageSource.sourceSha256, kind: 'X', structuralPosition: '1', content: { a: 1, b: 2 } });
    assert.equal(id1, id2, 'record ID must use stable serialization');
    assert.equal(stableJson({ b: 2, a: 1 }), '{"a":1,"b":2}');

    const safe = sanitizeClovaResponse(response(true), imageSource.sourceSha256);
    assert.deepEqual(safe.fields[0].boundingPoly[0], { x: 10, y: 10 });
    assert.equal(safe.fields[0].inferConfidence, 0.9);
    assert.deepEqual(safe.fields.map((field) => field.fieldOrder), [0, 1, 2]);
    const ocr = buildOcrRepresentation(imageSource, safe);
    assert.equal(ocr.fields.length, 3); assert.equal(ocr.lines.length, 2); assert.equal(ocr.blocks.length, 2);
    assert.ok(Math.abs(ocr.lines[0].confidence - 0.85) < 1e-12); assert.equal(ocr.lines[0].origin, 'DERIVED');
    assert.equal(ocr.fields[0].origin, 'PARSER_NATIVE'); assertRecord(ocr.fields[0]); assertRecord(ocr.lines[0]);
    const repeat = buildOcrRepresentation(imageSource, safe);
    assert.equal(stableJson(ocr), stableJson(repeat), 'same OCR response must produce byte-identical structures');
    const coordinate = buildOcrRepresentation(imageSource, sanitizeClovaResponse(response(false), imageSource.sourceSha256));
    assert.equal(coordinate.lines.length, 2); assert.equal(coordinate.lines[0].derivationRule, 'Y_COORDINATE_CLUSTER');
    assert.ok(ocr.blocks.every((block) => block.role && block.roleClassifierVersion && block.readingOrder));
    const footer = { ...ocr.blocks[0], recordId: 'footer-block', role: 'CONTACT_OR_FOOTER', text: '주변 안내', structuralOrder: 99 };
    const singleSections = buildSectionCandidates(imageSource, [...ocr.lines, ...ocr.blocks, footer]);
    assert.equal(singleSections.length, 1, 'single linked image with many visual blocks must remain one section');
    assert.ok(singleSections[0].excludedPeripheralBlockRefs.includes('footer-block'), 'footer must not become an independent section');

    const line = (base, recordId, text, order, height) => ({ ...base, recordId, text, structuralOrder: order,
      boundingPoly: [{ x: 0, y: order * 40 }, { x: 200, y: order * 40 }, { x: 200, y: order * 40 + height }, { x: 0, y: order * 40 + height }] });
    const sharedSource = { ...imageSource, linkedProgramCaseIds: ['program-1', 'program-2'] };
    const semanticLines = [line(ocr.lines[0], 'title-a', '프로그램 하나', 0, 30), line(ocr.lines[0], 'meta-a', '일시 10:00', 1, 10),
      line(ocr.lines[0], 'body-a', '활동 설명', 2, 10), line(ocr.lines[0], 'title-b', '프로그램 둘', 3, 30),
      line(ocr.lines[0], 'meta-b', '대상 어린이', 4, 10), line(ocr.lines[0], 'body-b', '활동 설명', 5, 10)];
    const sharedSections = buildSectionCandidates(sharedSource, semanticLines);
    assert.equal(sharedSections.length, 2, 'repeated title and metadata evidence must create multiple program sections');
    const gapOnly = semanticLines.map((item) => ({ ...item, text: '일반 본문', boundingPoly: item.boundingPoly.map((point) => ({ ...point, y: point.y * 5 })) }));
    assert.equal(buildSectionCandidates(sharedSource, gapOnly).length, 1, 'vertical gap alone must not split a section');

    const hwpSource = { ...imageSource, detectedType: 'HWP', mimeType: 'application/x-hwp' };
    const markdown = '# 프로그램 안내\n\n본문입니다.\n\n<table><tr><th rowspan="2">구분</th><td colspan="2">내용</td></tr><tr><td>A</td><td>B</td></tr></table>';
    const hwp = parseHwpMarkdown(hwpSource, markdown);
    assert.ok(hwp.units.some((unit) => unit.kind === 'HWP_PARAGRAPH'));
    assert.equal(hwp.units.filter((unit) => unit.kind === 'HWP_TABLE').length, 1);
    assert.equal(hwp.units.filter((unit) => unit.kind === 'HWP_TABLE_ROW').length, 2);
    assert.equal(hwp.units.filter((unit) => unit.kind === 'HWP_TABLE_CELL').length, 4);
    const merged = hwp.units.find((unit) => unit.kind === 'HWP_TABLE_CELL');
    assert.equal(merged.rowspan, 2); assert.equal(merged.origin, 'PARSER_NATIVE');
    assert.ok(hwp.units.some((unit) => unit.kind === 'HWP_HEADING_CANDIDATE' && unit.origin === 'DERIVED'));
    assert.deepEqual(hwp.units.map((unit) => unit.structuralOrder), hwp.units.map((_, index) => index));

    const weakUnits = hwp.units.filter((unit) => unit.kind === 'HWP_PARAGRAPH' || unit.kind === 'HWP_TABLE');
    const sections = buildSectionCandidates(hwpSource, weakUnits);
    assert.equal(sections.length, 1, 'weak boundaries must retain the whole attachment');
    assert.ok(sections[0].orderedUnitRefs.length > 0, 'empty sections are forbidden');
    const programCases = new Map([['program-1', { programCaseId: 'program-1', title: '프로그램 안내', targetAudience: '어린이',
      educationStartDateText: '2026-01-01', educationEndDateText: '2026-01-02', location: '도서관' }],
      ['program-outside', { programCaseId: 'program-outside', title: '프로그램 안내', targetAudience: '', educationStartDateText: '', educationEndDateText: '', location: '' }]]);
    const candidates = buildProgramCaseCandidates({ source: hwpSource, sections, units: hwp.units, programCases });
    assert.ok(candidates.every((candidate) => candidate.programCaseId !== 'program-outside'), 'candidate universe must be linked IDs only');
    assert.ok(candidates.every((candidate) => !['SAFE_MATCHED_SECTION', 'EXCLUDED_FROM_SEARCH'].includes(candidate.status)));
    const noMatch = buildProgramCaseCandidates({ source: hwpSource, sections,
      units: hwp.units.map((unit) => ({ ...unit, text: '무관한 내용' })), programCases });
    assert.equal(noMatch[0].status, 'NO_RELIABLE_MATCH');

    const pdfPath = path.join(root, 'fixture.pdf'); createPdf(pdfPath, ['충분한 텍스트 '.repeat(20), 'tiny']);
    const pdfBytes = fs.readFileSync(pdfPath); const pdfSource = source(root, pdfBytes, 'PDF');
    const pdf = await buildPdfRepresentation(pdfSource);
    assert.equal(pdf.pages.length, 2); assert.deepEqual(pdf.pages.map((page) => page.pageNumber), [1, 2]);
    assert.equal(pdf.pages[1].pageType, 'OCR_CANDIDATE'); assert.ok(pdf.pages.every((page) => /^[a-f0-9]{64}$/.test(page.pageHash)));
    assert.ok(pdf.items.every((item) => item.kind === 'PDFJS_TEXT_ITEM' && item.origin === 'PARSER_NATIVE'));

    assert.throws(() => parseRepresentationArguments(['--build-ocr', '--allow-external-api']), /source-hash/);
    assert.throws(() => parseRepresentationArguments(['--build-ocr', '--allow-external-api', '--source-hash', imageSource.sourceSha256, '--max-calls', '11']), /0 to 10/);
    const gated = parseRepresentationArguments(['--build-ocr', '--allow-external-api', '--source-hash', imageSource.sourceSha256, '--max-calls', '1']);
    assert.equal(gated.maximumCalls, 1); assert.equal(gated.sourceHashes.length, 1);
    const customSources = path.join(root, 'program-case-search-v2', 'sources'); fs.mkdirSync(customSources, { recursive: true });
    const defaults = parseRepresentationArguments(['--sources', customSources]);
    assert.equal(defaults.outputDirectory, path.join(path.dirname(customSources), 'representation'));
    console.log('Program case attachment representation tests passed.');
  } finally { await fsp.rm(root, { recursive: true, force: true }); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
