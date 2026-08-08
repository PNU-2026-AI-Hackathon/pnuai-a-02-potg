import { load, type CheerioAPI } from 'cheerio';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

type BasicInfo = Record<string, string>;

type Attachment = {
  name: string;
  url: string;
};

type CrawlResult = {
  idx: number;
  url: string;
  title: string;
  basicInfo: BasicInfo;
  bodyText: string;
  detailText: string;
  attachments: Attachment[];
  hasAttachments: boolean;
  fetchedAt: string;
};

type CliOptions =
  | { help: true }
  | {
      idx: number;
      url?: string;
      all?: boolean;
      outputDir?: string;
    };

type ListItem = {
  idx: number;
  url: string;
  title: string;
};

type CrawlFailure = {
  idx?: number;
  url?: string;
  page?: number;
  error: string;
};

type BatchCrawlResult = {
  source: {
    menuCd: string;
    listUrl: string;
  };
  summary: {
    totalPrograms: number;
    successCount: number;
    failureCount: number;
    duplicateIdxCount: number;
    hasAttachmentsTrueCount: number;
    hasAttachmentsFalseCount: number;
    attachmentExtensions: Record<string, number>;
  };
  records: CrawlResult[];
  failures: CrawlFailure[];
  duplicates: number[];
  crawledAt: string;
  outputFile: string;
};

const DEFAULT_IDX = 4354;
const MENU_CD = 'DOM_000000901008000000';
const BASE_URL = 'https://www.geumjeong.go.kr/index.geumj';
const DEFAULT_LIST_URL = buildListUrl(1);
const DEFAULT_OUTPUT_DIR = path.resolve(process.cwd(), '.local', 'geumjeong-small-library-crawl');
const ATTACHMENT_EXTENSIONS = new Set(['pdf', 'hwp', 'hwpx', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', 'txt', 'csv', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp']);

function normalizeText(value: string | undefined | null) {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveUrl(url: string, href: string) {
  return new URL(href, url).href;
}

function filenameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split('/').filter(Boolean).pop();
    return decodeURIComponent(name ?? parsed.hostname);
  } catch {
    return url;
  }
}

function looksLikeAttachment(href: string, baseUrl: string) {
  if (!href || href.startsWith('#')) return false;
  if (/download|file|attach|atch|down/i.test(href)) return true;
  if (/\bfileNo=\d+/i.test(href)) return true;
  try {
    const parsed = new URL(href, baseUrl);
    const pathname = parsed.pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
    if (!match) return false;
    const extension = match[1].toLowerCase();
    if (extension === 'geumj' || extension === 'asp' || extension === 'php' || extension === 'html' || extension === 'htm') return false;
    return ATTACHMENT_EXTENSIONS.has(extension);
  } catch {
    return false;
  }
}

function buildListUrl(startPage = 1) {
  const url = new URL(BASE_URL);
  url.searchParams.set('menuCd', MENU_CD);
  url.searchParams.set('searchStr', '');
  url.searchParams.set('searchType', '');
  url.searchParams.set('applyType', '');
  url.searchParams.set('applyStatus', '');
  url.searchParams.set('searchOperation', '');
  url.searchParams.set('startPage', String(startPage));
  return url.href;
}

function parsePageCount(text: string) {
  const match = text.match(/페이지\s*:\s*\d+\/(\d+)/);
  if (match) return Number(match[1]);
  return 1;
}

function parseListPage(html: string): { items: ListItem[]; totalPages: number } {
  const $ = load(html);
  const pageText = normalizeText($('body').text());
  const totalPages = parsePageCount(pageText);
  const items = $('a[href*="mode=view"][href*="idx="]')
    .toArray()
    .map((element) => {
      const anchor = $(element);
      const href = normalizeText(anchor.attr('href'));
      const text = normalizeText(anchor.text());
      const idxMatch = href.match(/[?&]idx=(\d+)/);
      if (!idxMatch) return null;
      const idx = Number(idxMatch[1]);
      if (!Number.isInteger(idx)) return null;
      return {
        idx,
        url: resolveUrl(BASE_URL, href),
        title: text,
      } satisfies ListItem;
    })
    .filter((item): item is ListItem => Boolean(item));
  return { items, totalPages };
}

function attachmentExtension(url: string) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    const match = pathname.match(/\.([a-z0-9]{2,5})$/i);
    return match ? match[1].toLowerCase() : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function fetchListPage(startPage: number) {
  const listUrl = buildListUrl(startPage);
  const html = await fetchHtml(listUrl);
  return { listUrl, ...parseListPage(html) };
}

async function crawlOne(idx: number, url?: string) {
  const detailUrl = url ?? buildDetailUrl(idx);
  const html = await fetchHtml(detailUrl);
  return parseDetailPage(html, detailUrl, idx);
}

async function crawlAllPrograms(outputDir = DEFAULT_OUTPUT_DIR): Promise<BatchCrawlResult> {
  const firstPage = await fetchListPage(1);
  const totalPages = Math.max(1, firstPage.totalPages);
  const pages = [firstPage];
  const pageFailures: CrawlFailure[] = [];
  for (let page = 2; page <= totalPages; page += 1) {
    try {
      pages.push(await fetchListPage(page));
    } catch (error) {
      pageFailures.push({ page, error: error instanceof Error ? error.message : String(error) });
    }
  }

  const byIdx = new Map<number, ListItem>();
  const duplicates: number[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      if (byIdx.has(item.idx)) {
        duplicates.push(item.idx);
        continue;
      }
      byIdx.set(item.idx, item);
    }
  }

  const orderedItems = [...byIdx.values()].sort((left, right) => left.idx - right.idx);
  const records: CrawlResult[] = [];
  const failures: CrawlFailure[] = [...pageFailures];
  const chunkSize = 4;
  for (let index = 0; index < orderedItems.length; index += chunkSize) {
    const chunk = orderedItems.slice(index, index + chunkSize);
    const settled = await Promise.allSettled(chunk.map(async (item) => crawlOne(item.idx, item.url)));
    settled.forEach((result, settledIndex) => {
      const item = chunk[settledIndex];
      if (result.status === 'fulfilled') {
        records.push(result.value);
      } else {
        failures.push({ idx: item.idx, url: item.url, error: result.reason instanceof Error ? result.reason.message : String(result.reason) });
      }
    });
  }

  const attachmentExtensions = records.reduce<Record<string, number>>((accumulator, record) => {
    for (const attachment of record.attachments) {
      const extension = attachmentExtension(attachment.url);
      accumulator[extension] = (accumulator[extension] ?? 0) + 1;
    }
    return accumulator;
  }, {});

  const summary = {
    totalPrograms: byIdx.size,
    successCount: records.length,
    failureCount: failures.length,
    duplicateIdxCount: duplicates.length,
    hasAttachmentsTrueCount: records.filter((record) => record.hasAttachments).length,
    hasAttachmentsFalseCount: records.filter((record) => !record.hasAttachments).length,
    attachmentExtensions,
  };

  await mkdir(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, `geumjeong-small-library-programs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const payload = {
    source: {
      menuCd: MENU_CD,
      listUrl: firstPage.listUrl,
    },
    summary,
    records,
    failures,
    duplicates,
    crawledAt: new Date().toISOString(),
  };
  await writeFile(outputFile, JSON.stringify(payload, null, 2), 'utf8');
  return { ...payload, outputFile };
}

function parseArgs(args: string[]): CliOptions {
  const options: { idx: number; url?: string } = { idx: DEFAULT_IDX };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--idx') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('--idx requires a value.');
      const idx = Number(value);
      if (!Number.isInteger(idx) || idx < 1) throw new Error('--idx must be a positive integer.');
      options.idx = idx;
      continue;
    }
    if (argument === '--url') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('--url requires a value.');
      options.url = value;
      continue;
    }
    if (argument === '--all') {
      (options as { all?: boolean }).all = true;
      continue;
    }
    if (argument === '--output-dir') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('--output-dir requires a value.');
      (options as { outputDir?: string }).outputDir = value;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      return { help: true };
    }
    throw new Error(`Unknown option: ${argument}`);
  }
  return options;
}

function buildDetailUrl(idx: number) {
  const url = new URL(BASE_URL);
  url.searchParams.set('menuCd', MENU_CD);
  url.searchParams.set('mode', 'view');
  url.searchParams.set('idx', String(idx));
  url.searchParams.set('searchStr', '');
  url.searchParams.set('searchType', '');
  url.searchParams.set('applyType', '');
  url.searchParams.set('applyStatus', '');
  url.searchParams.set('searchOperation', '');
  return url.href;
}

function extractIdxFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const idx = Number(parsed.searchParams.get('idx'));
    return Number.isInteger(idx) && idx > 0 ? idx : undefined;
  } catch {
    return undefined;
  }
}

async function fetchHtml(url: string, retries = 2) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'ko-KR,ko;q=0.9,en;q=0.8',
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(lastError instanceof Error ? lastError.message : `Failed to fetch ${url}`);
}

function parseKeyValueRows($: CheerioAPI, rows: any[]) {
  const basicInfo: BasicInfo = {};
  for (const row of rows) {
    const cells = $(row).children('th,td').toArray();
    if (cells.length < 2) continue;
    for (let index = 0; index + 1 < cells.length; index += 2) {
      const key = normalizeText($(cells[index]).text());
      const value = normalizeText($(cells[index + 1]).text());
      if (key && value) basicInfo[key] = value;
    }
  }
  return basicInfo;
}

function parseDetailPage(html: string, url: string, idx: number): CrawlResult {
  const $ = load(html);
  $('script, style, noscript').remove();
  const detailTable = $('table')
    .filter((_, element) => {
      const caption = normalizeText($(element).children('caption').text());
      return caption.length > 0 && !caption.includes('수강 신청자 목록');
    })
    .first();

  if (detailTable.length === 0) {
    throw new Error('DETAIL_TABLE_NOT_FOUND');
  }

  const title = normalizeText(detailTable.children('caption').text()) || `idx-${idx}`;
  const bodyTable = detailTable.find('table').first();
  const bodyText = bodyTable.length > 0 ? normalizeText(bodyTable.parent().text()) : normalizeText(detailTable.text());

  // 기본 정보는 `th`(항목명) + `td`(값) 행, 본문은 `th` 없이 td[colspan]만 있는 행에 담긴다.
  const directRows = detailTable.children('tbody').children('tr').toArray();
  const basicInfoRows = directRows.filter((row) => $(row).children('th').length > 0);
  const basicInfo = parseKeyValueRows($, basicInfoRows);

  const detailText = normalizeText(
    directRows
      .filter((row) => $(row).children('th').length === 0)
      .map((row) => $(row).text())
      .join('\n'),
  );

  const attachments = $('a[href]')
    .toArray()
    .map((element) => ({
      text: normalizeText($(element).text()),
      href: normalizeText($(element).attr('href')),
    }))
    .filter(({ text, href }) => {
      if (!href || href.startsWith('#')) return false;
      if (/^https?:\/\//i.test(href) && /geumjeong\.go\.kr\/index\.geumj\?/.test(href) && /mode=view/.test(href)) return false;
      if (['목록', '신청하기', '금정 공공예약 서비스', '본문 바로가기', '메인메뉴 바로가기', '금정구청', '문화관광', '보건소', '도서관', '교육', '주민자치회 교양강좌', '구민정보화교육', '평생학습 프로그램', '희망교육지구', '금정도서관문화강좌', '금샘도서관문화강좌', '문화회관강좌', '작은도서관 프로그램', '생활문화센터 프로그램', '금정아이숲 프로그램', '체육관/운동장', '금정산성광장', '대강당예식장접수', '현수막 온라인 신청', '주민자율공간 신청', '금정아이숲'].includes(text)) return false;
      return looksLikeAttachment(href, url);
    })
    .map(({ text, href }) => {
      const resolved = resolveUrl(url, href);
      return {
        name: text || filenameFromUrl(resolved),
        url: resolved,
      };
    })
    .filter((attachment, index, array) => array.findIndex((candidate) => candidate.url === attachment.url && candidate.name === attachment.name) === index);

  return {
    idx,
    url,
    title,
    basicInfo,
    bodyText,
    detailText,
    attachments,
    hasAttachments: attachments.length > 0,
    fetchedAt: new Date().toISOString(),
  };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if ('help' in options) {
    console.log('Usage: node dist/cli/geumjeongSmallLibraryCrawler.js [--idx 4354] [--url <detail-url>] [--all] [--output-dir <dir>]');
    return;
  }

  if ('all' in options && options.all) {
    const result = await crawlAllPrograms(options.outputDir ?? DEFAULT_OUTPUT_DIR);
    // records 전체(약 900KB)를 stdout에 쏟지 않고 요약과 저장 경로만 남긴다.
    console.log(JSON.stringify({
      source: result.source,
      summary: result.summary,
      failures: result.failures,
      duplicates: result.duplicates,
      outputFile: result.outputFile,
      crawledAt: result.crawledAt,
    }, null, 2));
    return result;
  }

  const detailIdx = options.url ? extractIdxFromUrl(options.url) ?? options.idx : options.idx;
  const result = await crawlOne(detailIdx, options.url);
  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({
      code: 'GEUMJEONG_SMALL_LIBRARY_CRAWLER_FAILED',
      error: error instanceof Error ? error.message : 'Geumjeong small library crawler failed.',
    }));
    process.exitCode = 1;
  });
}
