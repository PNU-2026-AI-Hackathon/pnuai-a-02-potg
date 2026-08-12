const fs = require('node:fs/promises');
const path = require('node:path');

const crawlerModule = process.env.GEUMJEONG_CRAWLER_MODULE
  ? path.resolve(process.env.GEUMJEONG_CRAWLER_MODULE)
  : path.resolve(__dirname, '../dist/cli/geumjeongSmallLibraryCrawler.js');
const { parseDetailPage } = require(crawlerModule);

const stable = (value) => JSON.stringify(value, (_key, nested) => {
  if (!nested || Array.isArray(nested) || typeof nested !== 'object') return nested;
  return Object.fromEntries(Object.entries(nested).sort(([left], [right]) => left.localeCompare(right, 'ko')));
});

function liveUrl(idx) {
  const url = new URL('https://www.geumjeong.go.kr/booking/index.geumj');
  url.searchParams.set('menuCd', 'DOM_000000901008000000');
  url.searchParams.set('mode', 'view');
  url.searchParams.set('idx', String(idx));
  return url.href;
}

async function fetchHtml(url, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (compatible; MOIRA source verification/1.0)',
          accept: 'text/html,application/xhtml+xml',
          'accept-language': 'ko-KR,ko;q=0.9',
        },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function verify(item) {
  const url = liveUrl(item.raw.idx);
  try {
    const html = await fetchHtml(url);
    const live = parseDetailPage(html, url, item.raw.idx);
    const comparableLiveBasicInfo = Object.fromEntries(
      Object.keys(item.raw.basicInfo).map((key) => [key, live.basicInfo[key]]),
    );
    const matches = {
      title: live.title === item.raw.title,
      basicInfo: stable(comparableLiveBasicInfo) === stable(item.raw.basicInfo),
      detailText: live.detailText === item.raw.detailText,
      attachments: stable(live.attachments) === stable(item.raw.attachments),
      hasAttachments: live.hasAttachments === item.raw.hasAttachments,
    };
    return {
      sourceId: item.raw.idx,
      liveUrl: url,
      status: Object.values(matches).every(Boolean) ? 'MATCHED' : 'MISMATCH',
      matches,
      live: {
        title: live.title,
        basicInfo: live.basicInfo,
        detailText: live.detailText,
        onlineApplicationStatus: live.onlineApplicationStatus,
        programContent: live.programContent,
        noticeText: live.noticeText,
        attachments: live.attachments,
        hasAttachments: live.hasAttachments,
      },
      error: null,
    };
  } catch (error) {
    return {
      sourceId: item.raw.idx,
      liveUrl: url,
      status: 'FETCH_FAILED',
      matches: null,
      live: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const [reviewArg, outputArg] = process.argv.slice(2);
  if (!reviewArg || !outputArg) throw new Error('Usage: <representative-review-json> <output-json>');
  const review = JSON.parse(await fs.readFile(path.resolve(reviewArg), 'utf8'));
  const results = [];
  for (let index = 0; index < review.items.length; index += 4) {
    results.push(...await Promise.all(review.items.slice(index, index + 4).map(verify)));
  }
  const summary = {
    total: results.length,
    matched: results.filter((result) => result.status === 'MATCHED').length,
    mismatched: results.filter((result) => result.status === 'MISMATCH').length,
    fetchFailed: results.filter((result) => result.status === 'FETCH_FAILED').length,
  };
  const output = { verifiedAt: new Date().toISOString(), summary, results };
  await fs.writeFile(path.resolve(outputArg), `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.mismatched || summary.fetchFailed) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
