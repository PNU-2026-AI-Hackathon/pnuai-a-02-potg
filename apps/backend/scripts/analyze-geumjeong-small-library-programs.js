const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const crawlRoot = path.join(backendRoot, '.local', 'geumjeong-small-library-crawl');
const outputRoot = path.join(backendRoot, '.local', 'program-data-normalization');

function latestCrawlFile() {
  const files = fs.readdirSync(crawlRoot)
    .filter((name) => /^geumjeong-small-library-programs-.*\.json$/.test(name))
    .sort();
  if (files.length === 0) throw new Error(`No crawl JSON found in ${crawlRoot}`);
  return path.join(crawlRoot, files.at(-1));
}

function parseArgs(argv) {
  const result = { input: null, output: outputRoot };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--input') result.input = path.resolve(argv[++index]);
    else if (argv[index] === '--output') result.output = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  result.input ??= latestCrawlFile();
  return result;
}

const countBy = (values, selector) => values.reduce((counts, value) => {
  const key = String(selector(value));
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}, {});

const sortedCounts = (counts) => Object.fromEntries(
  Object.entries(counts).sort(([leftKey, leftCount], [rightKey, rightCount]) =>
    rightCount - leftCount || leftKey.localeCompare(rightKey, 'ko')),
);

const coverage = (records, predicate) => {
  const count = records.filter(predicate).length;
  return { count, total: records.length, percent: Number((count / records.length * 100).toFixed(1)) };
};

const percentile = (sorted, ratio) => sorted.length === 0
  ? null
  : sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))];

function numericSummary(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return {
    count: sorted.length,
    min: sorted.at(0) ?? null,
    median: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    max: sorted.at(-1) ?? null,
  };
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseDateRange(value) {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})$/);
  if (!match || !validDate(match[1]) || !validDate(match[2])) return null;
  return { start: match[1], end: match[2] };
}

function extractLeadingTags(title) {
  const tags = [];
  let remainder = String(title ?? '').trim();
  while (remainder.startsWith('[')) {
    const match = remainder.match(/^\[([^\]]+)\]\s*/);
    if (!match) break;
    tags.push(match[1].trim());
    remainder = remainder.slice(match[0].length);
  }
  return { tags, remainder };
}

function schedulePattern(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '. .') return 'MISSING_OR_INVALID';
  const hasTime = /(?:[01]?\d|2[0-3]):[0-5]\d/.test(text);
  const hasWeekday = /(?:월|화|수|목|금|토|일)(?:요일)?/.test(text);
  const hasRange = /(?:~|-|–|∼)/.test(text);
  const hasMultiple = /[,/·]|(?:\s및\s)|(?:\s그리고\s)/.test(text);
  if (hasTime && hasWeekday && hasMultiple) return 'MULTIPLE_WEEKDAYS_OR_SLOTS';
  if (hasTime && hasWeekday && hasRange) return 'WEEKDAY_TIME_RANGE';
  if (hasTime && hasWeekday) return 'WEEKDAY_WITH_TIME';
  if (hasTime && hasRange) return 'TIME_RANGE';
  if (hasTime) return 'TIME_ONLY_OR_FREE_TEXT';
  return 'FREE_TEXT_WITHOUT_CLOCK_TIME';
}

function detailSignals(text) {
  const value = String(text ?? '');
  const compact = value.replace(/\s+/g, '');
  return {
    hasAnyText: value.trim().length > 0,
    hasNewline: /[\r\n]/.test(value),
    mentionsLocation: /장소|도서관|강의실|센터|비대면|온라인/.test(value),
    hasExplicitLocationLabel: /(?:장소|교육장소|수업장소)[:：]/.test(compact),
    mentionsFee: /수강료|재료비|교재비|참가비|무료|\d[\d,]*원/.test(compact),
    mentionsTuition: /수강료/.test(compact),
    mentionsMaterialFee: /재료비/.test(compact),
    mentionsBookFee: /교재비/.test(compact),
    hasPhone: /(?:0\d{1,2})[-.)\s]\d{3,4}[-\s]\d{4}/.test(value),
    mentionsContact: /문의|연락처|전화/.test(value),
  };
}

function analyze(payload, inputPath) {
  if (!payload || !Array.isArray(payload.records)) throw new Error('Expected an object with a records array');
  const records = payload.records;
  const basicKeys = [...new Set(records.flatMap((record) => Object.keys(record.basicInfo ?? {})))].sort((a, b) => a.localeCompare(b, 'ko'));
  const basicInfo = Object.fromEntries(basicKeys.map((key) => {
    const values = records.map((record) => String(record.basicInfo?.[key] ?? '').trim()).filter(Boolean);
    return [key, {
      coverage: coverage(records, (record) => String(record.basicInfo?.[key] ?? '').trim().length > 0),
      uniqueCount: new Set(values).size,
      topValues: Object.fromEntries(Object.entries(sortedCounts(countBy(values, (value) => value))).slice(0, 12)),
    }];
  }));

  const capacities = records.map((record) => String(record.basicInfo?.['모집인원'] ?? '').trim());
  const capacityInvalid = records.filter((record) => !/^\d+$/.test(String(record.basicInfo?.['모집인원'] ?? '').trim()));
  const dateFields = ['교육기간', '신청기간'];
  const dateRanges = Object.fromEntries(dateFields.map((field) => {
    const invalid = records.filter((record) => !parseDateRange(record.basicInfo?.[field]));
    const reversed = records.filter((record) => {
      const range = parseDateRange(record.basicInfo?.[field]);
      return range && range.start > range.end;
    });
    return [field, {
      valid: coverage(records, (record) => Boolean(parseDateRange(record.basicInfo?.[field]))),
      invalidRecordIds: invalid.map((record) => record.idx),
      reversedRecordIds: reversed.map((record) => record.idx),
    }];
  }));
  const applicationEndsAfterProgramStarts = records.filter((record) => {
    const program = parseDateRange(record.basicInfo?.['교육기간']);
    const application = parseDateRange(record.basicInfo?.['신청기간']);
    return program && application && application.end > program.start;
  });

  const detailLengths = records.map((record) => String(record.detailText ?? '').trim().length).filter((length) => length > 0);
  const signals = records.map((record) => ({ record, ...detailSignals(record.detailText) }));
  const phonePattern = /(?:0\d{1,2})[-.)\s]\d{3,4}[-\s]\d{4}/g;
  const phoneNumbers = records.flatMap((record) => String(record.detailText ?? '').match(phonePattern) ?? [])
    .map((value) => value.replace(')', '-').replace(/\s+/g, '-'));
  const tags = records.flatMap((record) => extractLeadingTags(record.title).tags);
  const targetValues = records.map((record) => String(record.basicInfo?.['대상'] ?? '').trim());
  const targetGroups = targetValues.map((value) => value.split(/\s+/)[0] || '(missing)');
  const instructors = records.map((record) => String(record.basicInfo?.['강사'] ?? '').trim());
  const schedules = records.map((record) => String(record.basicInfo?.['교육시간'] ?? '').trim());
  const duplicateIds = Object.entries(countBy(records, (record) => record.idx)).filter(([, count]) => count > 1).map(([id]) => Number(id));
  const duplicateTitles = Object.entries(countBy(records, (record) => record.title)).filter(([, count]) => count > 1).map(([title, count]) => ({ title, count }));
  const testLike = records.filter((record) => /(?:^|\s|\])테스트(?:$|\s)/.test(record.title) || record.basicInfo?.['교육시간'] === '. .');
  const missingCore = records.filter((record) => !record.idx || !record.url || !String(record.title ?? '').trim() || !record.basicInfo);

  const report = {
    analysisVersion: 'geumjeong-program-analysis-v1',
    input: {
      fileName: path.basename(inputPath),
      byteSize: fs.statSync(inputPath).size,
      source: payload.source ?? null,
      crawledAt: payload.crawledAt ?? null,
      recordCount: records.length,
      crawlerSummary: payload.summary ?? null,
      failureCount: Array.isArray(payload.failures) ? payload.failures.length : null,
      duplicateMetadataCount: Array.isArray(payload.duplicates) ? payload.duplicates.length : null,
    },
    structure: {
      topLevelKeys: Object.keys(payload).sort(),
      recordKeys: [...new Set(records.flatMap(Object.keys))].sort(),
      basicInfoKeys: basicKeys,
      attachmentKeys: [...new Set(records.flatMap((record) => (record.attachments ?? []).flatMap(Object.keys)))].sort(),
    },
    integrity: {
      duplicateIds,
      duplicateTitles,
      missingCoreRecordIds: missingCore.map((record) => record.idx ?? null),
      testLikeRecords: testLike.map((record) => ({ idx: record.idx, title: record.title, schedule: record.basicInfo?.['교육시간'] ?? null })),
    },
    basicInfo,
    patterns: {
      capacity: {
        numeric: coverage(records, (record) => /^\d+$/.test(String(record.basicInfo?.['모집인원'] ?? '').trim())),
        numericSummary: numericSummary(capacities.filter((value) => /^\d+$/.test(value)).map(Number)),
        invalidExamples: capacityInvalid.slice(0, 20).map((record) => ({ idx: record.idx, value: record.basicInfo?.['모집인원'] ?? null })),
      },
      dateRanges,
      crossDateChecks: {
        applicationEndsAfterProgramStarts: {
          count: applicationEndsAfterProgramStarts.length,
          recordIds: applicationEndsAfterProgramStarts.map((record) => record.idx),
          interpretation: 'Valid late-registration cases; do not assume applications always close before the program starts.',
        },
      },
      target: {
        groupDistribution: sortedCounts(countBy(targetGroups, (value) => value)),
        uniqueRawValueCount: new Set(targetValues).size,
        rawValuesWithoutDetail: targetValues.filter((value) => !/\s/.test(value)).length,
      },
      instructor: {
        commaSeparated: coverage(records, (record) => /,/.test(String(record.basicInfo?.['강사'] ?? ''))),
        parenthesized: coverage(records, (record) => /[（(][^)）]+[)）]/.test(String(record.basicInfo?.['강사'] ?? ''))),
        uniqueCount: new Set(instructors).size,
      },
      schedule: {
        distribution: sortedCounts(countBy(schedules, schedulePattern)),
        uniqueCount: new Set(schedules).size,
        missingOrInvalidRecords: records.filter((record) => schedulePattern(record.basicInfo?.['교육시간']) === 'MISSING_OR_INVALID')
          .map((record) => ({ idx: record.idx, title: record.title, value: record.basicInfo?.['교육시간'] ?? null })),
      },
      titleTags: {
        recordsWithLeadingTag: coverage(records, (record) => extractLeadingTags(record.title).tags.length > 0),
        totalTagCount: tags.length,
        uniqueTagCount: new Set(tags).size,
        distribution: sortedCounts(countBy(tags, (value) => value)),
        recordsWithoutLeadingTag: records.filter((record) => extractLeadingTags(record.title).tags.length === 0)
          .map((record) => ({ idx: record.idx, title: record.title })),
      },
    },
    textAndAttachments: {
      detailText: {
        present: coverage(records, (record) => String(record.detailText ?? '').trim().length > 0),
        length: numericSummary(detailLengths),
        recordsWithNewline: coverage(records, (record) => /[\r\n]/.test(String(record.detailText ?? ''))),
      },
      attachments: {
        hasAttachmentsFlag: coverage(records, (record) => record.hasAttachments === true),
        nonEmptyArray: coverage(records, (record) => Array.isArray(record.attachments) && record.attachments.length > 0),
        flagArrayMismatchIds: records.filter((record) => record.hasAttachments !== ((record.attachments?.length ?? 0) > 0)).map((record) => record.idx),
        extensionDistribution: sortedCounts(countBy(records.flatMap((record) => record.attachments ?? []), (attachment) => {
          try { return path.extname(new URL(attachment.url).pathname).toLowerCase() || '(none)'; } catch { return '(invalid-url)'; }
        })),
      },
      extractabilitySignals: {
        locationMention: coverage(signals, (item) => item.mentionsLocation),
        explicitLocationLabel: coverage(signals, (item) => item.hasExplicitLocationLabel),
        feeMention: coverage(signals, (item) => item.mentionsFee),
        tuitionMention: coverage(signals, (item) => item.mentionsTuition),
        materialFeeMention: coverage(signals, (item) => item.mentionsMaterialFee),
        bookFeeMention: coverage(signals, (item) => item.mentionsBookFee),
        phonePattern: coverage(signals, (item) => item.hasPhone),
        uniquePhoneNumberCount: new Set(phoneNumbers).size,
        phoneNumberDistribution: sortedCounts(countBy(phoneNumbers, (value) => value)),
        contactMention: coverage(signals, (item) => item.mentionsContact),
        warning: 'These are keyword/pattern upper bounds, not extraction accuracy measurements.',
      },
    },
  };

  const canonical = JSON.stringify(report);
  report.contentHash = crypto.createHash('sha256').update(canonical).digest('hex');
  return report;
}

function markdown(report) {
  const c = (value) => `${value.count}/${value.total} (${value.percent}%)`;
  const lines = [
    '# 금정구 작은도서관 프로그램 크롤링 데이터 분석',
    '',
    `- 분석 버전: \`${report.analysisVersion}\``,
    `- 입력: \`${report.input.fileName}\``,
    `- 레코드: ${report.input.recordCount}건`,
    `- 결과 해시: \`${report.contentHash}\``,
    '',
    '## 무결성',
    '',
    `- 중복 ID: ${report.integrity.duplicateIds.length}건`,
    `- 중복 제목: ${report.integrity.duplicateTitles.length}건`,
    `- 필수 구조 누락: ${report.integrity.missingCoreRecordIds.length}건`,
    `- 테스트 의심 레코드: ${report.integrity.testLikeRecords.length}건`,
    '',
    '## 주요 필드 커버리지',
    '',
    '| 필드 | 커버리지 | 고유값 |',
    '|---|---:|---:|',
    ...Object.entries(report.basicInfo).map(([key, value]) => `| ${key} | ${c(value.coverage)} | ${value.uniqueCount} |`),
    '',
    '## 구조 및 패턴',
    '',
    `- 모집인원 숫자 변환 가능: ${c(report.patterns.capacity.numeric)}`,
    `- 모집인원 범위/중앙값: ${report.patterns.capacity.numericSummary.min}~${report.patterns.capacity.numericSummary.max} / ${report.patterns.capacity.numericSummary.median}`,
    `- 교육기간 유효: ${c(report.patterns.dateRanges['교육기간'].valid)}`,
    `- 신청기간 유효: ${c(report.patterns.dateRanges['신청기간'].valid)}`,
    `- 신청 종료일이 교육 시작일보다 늦은 사례: ${report.patterns.crossDateChecks.applicationEndsAfterProgramStarts.count}건`,
    `- 대상 원문 고유값: ${report.patterns.target.uniqueRawValueCount}종`,
    `- 대상 첫 토큰 분포: ${Object.entries(report.patterns.target.groupDistribution).map(([key, value]) => `${key} ${value}`).join(' · ')}`,
    `- 제목 앞 태그 존재: ${c(report.patterns.titleTags.recordsWithLeadingTag)} / 고유 태그 ${report.patterns.titleTags.uniqueTagCount}종`,
    '',
    '## 본문 및 첨부',
    '',
    `- detailText 존재: ${c(report.textAndAttachments.detailText.present)}`,
    `- detailText 개행 존재: ${c(report.textAndAttachments.detailText.recordsWithNewline)}`,
    `- 첨부파일 존재: ${c(report.textAndAttachments.attachments.nonEmptyArray)}`,
    `- 첨부 플래그/배열 불일치: ${report.textAndAttachments.attachments.flagArrayMismatchIds.length}건`,
    '',
    '## 본문 추출 가능성 신호',
    '',
    '> 아래 수치는 키워드·정규식이 발견된 상한선이며 실제 추출 정확도가 아닙니다.',
    '',
    `- 장소 관련 표현: ${c(report.textAndAttachments.extractabilitySignals.locationMention)}`,
    `- 명시적 장소 라벨: ${c(report.textAndAttachments.extractabilitySignals.explicitLocationLabel)}`,
    `- 비용 관련 표현: ${c(report.textAndAttachments.extractabilitySignals.feeMention)}`,
    `- 재료비: ${c(report.textAndAttachments.extractabilitySignals.materialFeeMention)}`,
    `- 수강료: ${c(report.textAndAttachments.extractabilitySignals.tuitionMention)}`,
    `- 전화번호: ${c(report.textAndAttachments.extractabilitySignals.phonePattern)}`,
    `- 문의 관련 표현: ${c(report.textAndAttachments.extractabilitySignals.contactMention)}`,
    '',
    '## 예외',
    '',
    '```json',
    JSON.stringify({
      testLikeRecords: report.integrity.testLikeRecords,
      invalidSchedules: report.patterns.schedule.missingOrInvalidRecords,
      invalidCapacity: report.patterns.capacity.invalidExamples,
      invalidEducationDates: report.patterns.dateRanges['교육기간'].invalidRecordIds,
      invalidApplicationDates: report.patterns.dateRanges['신청기간'].invalidRecordIds,
    }, null, 2),
    '```',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(fs.readFileSync(args.input, 'utf8'));
  const report = analyze(payload, args.input);
  fs.mkdirSync(args.output, { recursive: true });
  const jsonPath = path.join(args.output, 'analysis-report.json');
  const markdownPath = path.join(args.output, 'analysis-report.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(markdownPath, markdown(report));
  console.log(JSON.stringify({ jsonPath, markdownPath, contentHash: report.contentHash, recordCount: report.input.recordCount }, null, 2));
}

main();
