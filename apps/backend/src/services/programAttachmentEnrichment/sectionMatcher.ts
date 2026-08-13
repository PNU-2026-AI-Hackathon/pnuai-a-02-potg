export type AttachmentSectionMatch = {
  status: 'SECTION_MATCHED' | 'WHOLE_DOCUMENT' | 'AMBIGUOUS' | 'NOT_FOUND';
  selectedText: string;
  selectedPages: number[];
  score: number;
  reason: string;
};

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
  const headingScore = Math.max(0, ...headingCandidates(text).map((candidate) => {
    const comparable = comparableTitle(candidate);
    if (comparable.includes(target) || target.includes(comparable)) return 1;
    return editSimilarity(target, comparable);
  }));
  const tagBonus = tagsOf(title).some((tag) => tag.length >= 2 && compactText.includes(tag)) ? 0.25 : 0;
  return Math.min(0.95, headingScore + tagBonus);
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
  const knownLabels = /^(프로그램명|강좌명|강사명|담당강사|교육대상|대상|교육기간|교육일시|교육시간|교육장소|운영기간|운영횟수|수강인원|참여인원|교재|교재비|재료비|준비물|학습자 준비물|강의실 준비|프로그램 소개|교육내용|강의목표|목표)$/;

  for (const row of rows) {
    const rawCells = row.split('|').map((cell) => cell.trim());
    for (let index = 0; index + 1 < rawCells.length; index += 1) {
      if (knownLabels.test(rawCells[index]) && rawCells[index + 1]
        && !knownLabels.test(rawCells[index + 1]) && !/^(?:회차|차시|일자|비고|세부 교육내용|교수방법)$/.test(rawCells[index + 1])) {
        labeled.push({ label: rawCells[index], value: rawCells[index + 1] });
      }
    }
    const cells = rawCells.filter(Boolean);
    if (/^\d{1,2}$/.test(cells[0] ?? '') && cells.length >= 2) {
      const dateIndex = /^(?:\d{1,2}(?:[./-]\d{1,2})|\d{1,2}월\s*\d{1,2}일)/.test(cells[1] ?? '') ? 1 : -1;
      curriculum.push({
        session: Number(cells[0]),
        date: dateIndex === 1 ? cells[1] : null,
        content: cells.slice(dateIndex === 1 ? 2 : 1, Math.max(dateIndex === 1 ? 3 : 2, cells.length - 1)).join(' / '),
        note: cells.length >= (dateIndex === 1 ? 4 : 3) ? cells[cells.length - 1] : null,
      });
    } else if (cells.length === 1 && curriculum.length > 0 && !knownLabels.test(cells[0]) && !/^(?:회차|차시|참고)/.test(cells[0])) {
      const last = curriculum[curriculum.length - 1];
      last.note = [last.note, cells[0]].filter(Boolean).join(' ');
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
        content: match[3].replace(/\s+/g, ' ').trim(),
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
      if (value && value.length <= 160) labeled.push({ label, value });
    }
    for (const label of ['교재비', '재료비']) {
      const amount = compact.match(new RegExp(`${label}\\s*[:：]?\\s*([\\d,]+\\s*원?)`))?.[1]?.replace(/\s+/g, '');
      if (amount) labeled.push({ label, value: amount });
    }
  }
  return { labeled, curriculum };
}
