export type AttachmentSectionMatch = {
  status: 'SECTION_MATCHED' | 'WHOLE_DOCUMENT' | 'AMBIGUOUS' | 'NOT_FOUND';
  selectedText: string;
  selectedPages: number[];
  score: number;
  reason: string;
};

const SAFE_SPACING_REPLACEMENTS: Array<[RegExp, string]> = [
  [/일본어글자쓰기읽기부터간단한대화까지할수있게함/g, '일본어 글자 쓰기·읽기부터 간단한 대화까지 할 수 있게 함'],
  [/중국어를가장좋아합니다/g, '중국어를 가장 좋아합니다'],
  [/주요형용동사단어접하기/g, '주요 형용동사 단어 접하기'],
  [/형용동사연습문제를통해복습하기/g, '형용동사 연습문제를 통해 복습하기'],
  [/오늘은매우춥네요/g, '오늘은 매우 춥네요'],
  [/사과가한개있습니다/g, '사과가 한 개 있습니다'],
  [/아침밥을먹다/g, '아침밥을 먹다'],
  [/동사구분규칙/g, '동사 구분 규칙'],
  [/주요동사의단어접하기/g, '주요 동사 단어 접하기'],
  [/그룹나누는연습/g, '그룹 나누는 연습'],
  [/존재동사의표현학습/g, '존재동사의 표현 학습'],
  [/주요형용사단어접하기/g, '주요 형용사 단어 접하기'],
  [/과거부정표현/g, '과거·부정 표현'],
  [/형용사의활용표현차이이해/g, '형용사의 활용 표현 차이 이해'],
  [/형용동사의활용표현차이이해/g, '형용동사의 활용 표현 차이 이해'],
  [/사물의개수를세는단위/g, '사물의 개수를 세는 단위'],
  [/사물의따라숫자발음달라짐/g, '사물에 따라 숫자 발음이 달라짐'],
  [/동사활용하기위한그룹을3개로나누는방법외우기/g, '동사 활용을 위한 그룹을 3개로 나누는 방법 외우기'],
  [/이내용이중요해서반복학습/g, '이 내용이 중요해서 반복 학습'],
  [/종합장과필기도구/g, '종합장과 필기도구'],
  [/교재필기구/g, '교재·필기구'],
  [/필기도구싸인펜/g, '필기도구·사인펜'],
  [/등등기억해오기/g, '등등 기억해오기'],
  [/역사와의의찾아보기/g, '역사와 의의 찾아보기'],
  [/활동경험해보기/g, '활동 경험해보기'],
];

export function normalizeExtractedKoreanSpacing(value: string) {
  return SAFE_SPACING_REPLACEMENTS.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), value)
    .replace(/^(\d+과)(?=\S)/, '$1 ')
    .replace(/(합니다|네요|있습니다|읽습니다|먹다)(?=\d\/\d)/g, '$1 ')
    .replace(/동사구분/g, '동사 구분')
    .replace(/(?<!\d)\s*,\s*|\s*,\s*(?!\d)/g, ', ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function normalizeActivityText(value: string) {
  return normalizeExtractedKoreanSpacing(value)
    .replace(/\s*[ㆍ·․]\s*/g, '\n• ')
    .replace(/^\n/, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function withoutTags(value: string) {
  return value.replace(/^(?:\s*\[[^\]]+\])+\s*/, '').trim();
}

function tagsOf(value: string) {
  return [...value.matchAll(/\[([^\]]+)\]/g)].map((match) => comparableTitle(match[1]));
}

export function comparableTitle(value: string) {
  return withoutTags(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function titleMatches(text: string, title: string) {
  const comparable = comparableTitle(title);
  if (comparable.length < 4) return false;
  return comparableTitle(text).includes(comparable);
}

function editSimilarity(left: string, right: string) {
  if (!left || !right) return 0;
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let diagonal = rows[0];
    rows[0] = rightIndex;
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const previous = rows[leftIndex];
      rows[leftIndex] = Math.min(
        rows[leftIndex] + 1,
        rows[leftIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = previous;
    }
  }
  return 1 - rows[left.length] / Math.max(left.length, right.length);
}

function headingCandidates(text: string) {
  const heading = text.replace(/\s+/g, ' ').trim().slice(0, 700);
  const candidates: string[] = [];
  const firstLine = text.split(/\r?\n/)[0]?.trim();
  if (firstLine && firstLine.length <= 100) candidates.push(firstLine);
  const plan = heading.match(/^(.{0,60}?(?:독서지도|그림책\s*지도)\s*계획안)/);
  if (plan) candidates.push(plan[1]);
  const named = heading.match(/(?:프로그램\s*명|강\s*좌\s*명)\s+(.+?)(?=프로그램\s*소개|개\s*요|목\s*표|대\s*상|교육|강사|교재|수\s*강|$)/);
  if (named) candidates.push(named[1]);
  return candidates;
}

function matchScore(text: string, title: string) {
  const target = comparableTitle(title);
  const compactText = comparableTitle(text);
  const titleTokens = withoutTags(title).normalize('NFKC').toLowerCase()
    .split(/[^\p{L}\p{N}]+/gu)
    .map(comparableTitle)
    .filter((token) => token.length >= 2 && !/^(?:동|작은도서관)$/.test(token));
  const tokenCoverage = titleTokens.length
    ? titleTokens.filter((token) => compactText.includes(token)).length / titleTokens.length
    : 0;
  const headingScore = Math.max(0, ...headingCandidates(text).map((candidate) => {
    const comparable = comparableTitle(candidate);
    if (comparable.includes(target) || target.includes(comparable)) return 1;
    return editSimilarity(target, comparable);
  }));
  const tagBonus = tagsOf(title).some((tag) => tag.length >= 2 && compactText.includes(tag)) ? 0.25 : 0;
  const tokenScore = titleTokens.length >= 2 && tokenCoverage === 1 ? 0.9 : tokenCoverage >= 0.75 ? 0.72 : 0;
  return Math.min(0.95, Math.max(headingScore + tagBonus, tokenScore));
}

function startsProgramSection(text: string) {
  const heading = text.replace(/\s+/g, ' ').trim().slice(0, 260);
  return /(?:프로그램\s*명|강\s*좌\s*명|독서지도\s*계획안|그림책\s*지도\s*계획안)/.test(heading);
}

export function matchDocumentSection(input: {
  pages: Array<{ pageNumber: number; text: string }>;
  targetTitle: string;
  knownProgramTitles: string[];
  singleProgramDocument?: boolean;
}): AttachmentSectionMatch {
  const scoredPages = input.pages.map((page) => ({ page, score: matchScore(page.text.slice(0, 600), input.targetTitle) }));
  const bestScore = Math.max(0, ...scoredPages.map((entry) => entry.score));
  const matchingPages = scoredPages.filter((entry) => entry.score === bestScore && entry.score >= 0.55).map((entry) => entry.page);
  if (input.singleProgramDocument && matchingPages.length > 0) {
    return {
      status: 'WHOLE_DOCUMENT',
      selectedText: input.pages.map((page) => page.text).join('\n\n'),
      selectedPages: input.pages.map((page) => page.pageNumber),
      score: 1,
      reason: '단일 프로그램 문서에서 제목 일치',
    };
  }
  if (matchingPages.length === 0) {
    return { status: 'NOT_FOUND', selectedText: '', selectedPages: [], score: 0, reason: '제목이 포함된 페이지를 찾지 못함' };
  }
  if (matchingPages.length > 1) {
    return { status: 'AMBIGUOUS', selectedText: '', selectedPages: matchingPages.map((page) => page.pageNumber), score: 0.4, reason: '제목이 여러 페이지에서 발견됨' };
  }

  const startIndex = input.pages.findIndex((page) => page.pageNumber === matchingPages[0].pageNumber);
  const otherTitles = input.knownProgramTitles.filter((title) => comparableTitle(title) !== comparableTitle(input.targetTitle));
  let endIndex = input.pages.length;
  for (let index = startIndex + 1; index < input.pages.length; index += 1) {
    if (startsProgramSection(input.pages[index].text) || otherTitles.some((title) => titleMatches(input.pages[index].text, title))) {
      endIndex = index;
      break;
    }
  }
  const selected = input.pages.slice(startIndex, endIndex);
  return {
    status: 'SECTION_MATCHED',
    selectedText: selected.map((page) => page.text).join('\n\n'),
    selectedPages: selected.map((page) => page.pageNumber),
    score: bestScore,
    reason: '제목·도서관 단서가 가장 잘 맞는 페이지부터 다음 프로그램 머리말 직전까지 선택',
  };
}

export function structureAttachmentText(text: string) {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const labeled: Array<{ label: string; value: string }> = [];
  const curriculum: Array<{ session: number; date: string | null; content: string; note: string | null }> = [];
  const notices = rows.filter((line) => /(?:수강자|강의계획서|세부\s*프로그램).*(?:상황|사정).*(?:변경|달라질)/.test(line));
  const knownLabels = /^(프로그램명|강좌명|강사명|담당강사|교육대상|대상|교육기간|교육일시|교육시간|교육장소|운영기간|운영횟수|수강인원|참여인원|교재|교재비|재료비|준비물|학습자준비물|강의실준비|온라인가능여부|프로그램소개|교육내용|강의목표|목표)$/;
  const displayLabel = (label: string) => ({ 학습자준비물: '학습자 준비물', 강의실준비: '강의실 준비', 온라인가능여부: '온라인 가능 여부', 프로그램소개: '프로그램 소개' }[label] ?? label);

  for (const row of rows) {
    const rawCells = row.split('|').map((cell) => cell.trim());
    for (let index = 0; index + 1 < rawCells.length; index += 1) {
      const label = rawCells[index].replace(/\s+/g, '');
      const nextLabel = rawCells[index + 1].replace(/\s+/g, '');
      if (knownLabels.test(label) && rawCells[index + 1]
        && !knownLabels.test(nextLabel) && !/^(?:회차|차시|일자|비고|세부교육내용|교수방법)$/.test(nextLabel)) {
        labeled.push({ label: displayLabel(label), value: normalizeExtractedKoreanSpacing(rawCells[index + 1]) });
      }
    }
    const cells = rawCells.filter(Boolean);
    if (/^\d{1,2}$/.test(cells[0] ?? '') && cells.length >= 2) {
      const dateIndex = /^(?:\d{1,2}(?:[./-]\d{1,2})|\d{1,2}월\s*\d{1,2}일)/.test(cells[1] ?? '') ? 1 : -1;
      curriculum.push({
        session: Number(cells[0]),
        date: dateIndex === 1 ? cells[1] : null,
        content: normalizeActivityText(cells.slice(dateIndex === 1 ? 2 : 1, Math.max(dateIndex === 1 ? 3 : 2, cells.length - 1)).join(' / ')),
        note: cells.length >= (dateIndex === 1 ? 4 : 3) ? normalizeExtractedKoreanSpacing(cells[cells.length - 1]) : null,
      });
    } else if (cells.length === 1 && curriculum.length > 0 && !knownLabels.test(cells[0]) && !/^(?:\[\/?TABLE\]|회차|차시|참고)/i.test(cells[0])) {
      const last = curriculum[curriculum.length - 1];
      if (!/^\(?참고\)?$/i.test(cells[0])) last.note = normalizeExtractedKoreanSpacing([last.note, cells[0]].filter(Boolean).join(' '));
    }
  }
  // PDF.js 결과는 표 구분자 없이 행 사이에서 줄바꿈되는 경우가 많다. 날짜로 시작하는
  // 회차 행의 시작점만 확실하게 사용하고, 다음 회차 전까지를 한 활동으로 보존한다.
  if (curriculum.length === 0) {
    const blocks = text.replace(/\r/g, '').split(/\n(?=\d{1,2}\s+\d{1,2}[./-]\d{1,2}\b)/);
    for (const block of blocks) {
      const match = block.trim().match(/^(\d{1,2})\s+(\d{1,2}[./-]\d{1,2})\s+([\s\S]+)/);
      if (!match) continue;
      curriculum.push({
        session: Number(match[1]),
        date: match[2],
        content: normalizeActivityText(match[3].replace(/\s+/g, ' ').trim()),
        note: null,
      });
    }
  }
  if (labeled.length === 0) {
    const compact = text.replace(/\s+/g, ' ').trim();
    const labels = ['프로그램명', '강좌명', '교육대상', '대상', '강사 성명', '강사명', '교육기간', '교육일시', '교육장소', '강의목표', '요일/시간', '교재', '준비물', '회기'];
    const boundary = labels.map((label) => label.replace(/./g, (char) => `${char}\\s*`)).join('|');
    for (const label of labels) {
      const spaced = label.replace(/./g, (char) => `${char}\\s*`);
      const match = compact.match(new RegExp(`(?:^|\\s)${spaced}\\s+(.+?)(?=\\s(?:${boundary})\\s|$)`));
      const value = match?.[1]?.trim();
      if (value && value.length <= 160) labeled.push({ label, value: normalizeExtractedKoreanSpacing(value) });
    }
    for (const label of ['교재비', '재료비']) {
      const amount = compact.match(new RegExp(`${label}\\s*[:：]?\\s*([\\d,]+\\s*원?)`))?.[1]?.replace(/\s+/g, '');
      if (amount) labeled.push({ label, value: amount });
    }
  }
  if (/회차\s*\|\s*일자\s*\|\s*교육내용\s*\|\s*비고/.test(text)) {
    for (const row of curriculum) {
      if (!row.note) continue;
      row.content = normalizeActivityText(`${row.content}\n${row.note}`);
      row.note = null;
    }
  }
  const extractionWarnings: Array<{ code: string; message: string }> = [];
  if (curriculum.length > 0 && /(?:hwp|강의s*계획|지도s*계획)/i.test(text)) {
    extractionWarnings.push({
      code: 'HWP_EMBEDDED_CONTENT_REVIEW',
      message: 'HWP 표의 도형·이미지·꾸밈글에 들어간 회차 제목이나 이미지는 텍스트 추출에서 누락될 수 있어 원본 대조가 필요합니다.',
    });
  }
  if (/참고\s*도서/.test(text) && curriculum.length > 0 && curriculum.every((row) => !row.note)) {
    extractionWarnings.push({
      code: 'REFERENCE_BOOK_NOT_EXTRACTED',
      message: '원문에 참고도서 열이 있지만 값이 추출되지 않았습니다. 도서명과 표지 이미지는 원본 HWP 확인이 필요합니다.',
    });
  }
  return { labeled, curriculum, notices, extractionWarnings };
}
