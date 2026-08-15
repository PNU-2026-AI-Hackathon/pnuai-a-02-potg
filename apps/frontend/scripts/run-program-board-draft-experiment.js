const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const contextDirectory = path.join(root, 'backend', '.local', 'program-board-search', 'contexts');
const outputDirectory = path.join(root, 'backend', '.local', 'program-board-search', 'drafts');
const experimentQueries = new Set([
  '초등 저학년이 환경과 기후를 배우면서 만들기도 하는 수업',
  '아이와 함께 그림책을 읽고 클레이 활동을 하는 프로그램',
  '초등 저학년 대상으로 하는 영어 수업',
]);
if (process.env.PROGRAM_DRAFT_QUERY) experimentQueries.add(process.env.PROGRAM_DRAFT_QUERY.trim());

async function main() {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const files = fs.readdirSync(contextDirectory).filter((name) => name.endsWith('.md')).sort();
  const results = [];
  for (const file of files) {
    const markdown = fs.readFileSync(path.join(contextDirectory, file), 'utf8');
    const query = markdown.match(/## 사용자 요청\s*\n([^\n]+)/)?.[1]?.trim();
    if (!query) throw new Error(`${file}: 사용자 요청을 읽을 수 없습니다.`);
    if (process.env.PROGRAM_DRAFT_QUERY ? query !== process.env.PROGRAM_DRAFT_QUERY.trim() : !experimentQueries.has(query)) continue;
    const model = process.env.PROGRAM_DRAFT_MODEL || 'gemini-3.6-flash';
    const response = await fetch('http://localhost:3000/api/studio/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: query, conditions: {}, agenda: null, referencesMarkdown: markdown, model }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.draft) throw new Error(`${file}: ${payload.error || response.statusText}`);
    const output = { schemaVersion: 'program-board-draft-experiment/v1', query, contextFile: file, model: payload.model || model, draft: payload.draft };
    const outputPath = path.join(outputDirectory, file.replace(/\.md$/, '.json'));
    fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    results.push({ query, outputPath, title: payload.draft.title, detailCount: payload.draft.details.length });
  }
  console.log(JSON.stringify({ count: results.length, results }, null, 2));
}

main().catch((error) => { console.error(error.message); process.exit(1); });
