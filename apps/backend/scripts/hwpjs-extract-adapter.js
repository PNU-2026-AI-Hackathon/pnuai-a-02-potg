const fs = require('fs');
const path = require('path');

function characterText(character) {
  if (typeof character?.value === 'string') return character.value;
  if (character?.value === 10 || character?.value === 13) return '\n';
  return '';
}

function paragraphText(paragraph) {
  return Array.isArray(paragraph?.content)
    ? paragraph.content.map(characterText).join('').replace(/\r\n?/g, '\n').trim()
    : '';
}

function tableText(control) {
  if (!Array.isArray(control?.content) || !Number.isInteger(control?.rowCount)) return null;
  const rows = control.content.slice(0, control.rowCount).map((row) =>
    (Array.isArray(row) ? row : []).map((cell) =>
      (Array.isArray(cell?.items) ? cell.items : []).map(extractParagraph).filter(Boolean).join(' '),
    ).join('\t'),
  );
  return rows.length > 0 ? `[TABLE]\n${rows.join('\n')}\n[/TABLE]` : null;
}

function controlText(control) {
  const table = tableText(control);
  if (table !== null) return table;
  if (Array.isArray(control?.content)) {
    return control.content.map((item) => {
      if (Array.isArray(item)) return item.map(controlText).filter(Boolean).join('\n');
      if (Array.isArray(item?.items)) return item.items.map(extractParagraph).filter(Boolean).join('\n');
      return '';
    }).filter(Boolean).join('\n');
  }
  return '';
}

function extractParagraph(paragraph) {
  const parts = [paragraphText(paragraph)];
  if (Array.isArray(paragraph?.controls)) {
    parts.push(...paragraph.controls.map(controlText).filter(Boolean));
  }
  return parts.filter(Boolean).join('\n');
}

function extractDocument(document) {
  return (Array.isArray(document?.sections) ? document.sections : [])
    .flatMap((section) => (Array.isArray(section?.content) ? section.content : []).map(extractParagraph))
    .filter(Boolean)
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function main() {
  const [runtimeDirectory, inputPath] = process.argv.slice(2);
  if (!runtimeDirectory || !inputPath) throw new Error('runtime directory and input path are required');
  const modulePath = path.join(path.resolve(runtimeDirectory), 'node_modules', 'hwp.js');
  const { parse } = require(modulePath);
  try {
    const document = parse(fs.readFileSync(path.resolve(inputPath)), { type: 'buffer' });
    const text = extractDocument(document);
    process.stdout.write(JSON.stringify({
      success: true,
      text,
      sectionCount: document.sections?.length ?? 0,
      rssBytes: process.memoryUsage().rss,
    }));
  } catch (error) {
    process.stdout.write(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'hwp.js parse failed',
      rssBytes: process.memoryUsage().rss,
    }));
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stdout.write(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'hwp.js extraction failed',
      rssBytes: process.memoryUsage().rss,
    }));
  }
}

module.exports = { extractDocument, extractParagraph, tableText };
