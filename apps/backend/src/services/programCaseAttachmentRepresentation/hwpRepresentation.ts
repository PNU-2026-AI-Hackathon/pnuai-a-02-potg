import { copyFile, mkdtemp, rm } from 'fs/promises';
import os from 'os';
import path from 'path';
import { extractHwpText } from '../attachment/hwpTextExtractor';
import { baseRecord, verifySourceBinary } from './common';
import { HwpStructuralUnit, SourceBinary } from './types';

const PARSER_VERSION = '4.2.7';
const HEADING_VERSION = 'hwp-heading-candidate-v1';

function decode(value: string) {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (match, entity: string) => {
    if (!entity.startsWith('#')) return named[entity.toLowerCase()] ?? match;
    const radix = entity[1]?.toLowerCase() === 'x' ? 16 : 10;
    const parsed = Number.parseInt(radix === 16 ? entity.slice(2) : entity.slice(1), radix);
    return Number.isSafeInteger(parsed) ? String.fromCodePoint(parsed) : match;
  });
}

function plain(value: string) {
  return decode(value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']?(\\d+)`, 'i'));
  return match ? Number(match[1]) : 1;
}

function headingEvidence(text: string) {
  const evidence: string[] = [];
  if (text.length > 0 && text.length <= 40) evidence.push('SHORT_STANDALONE_PARAGRAPH');
  if (/^(?:#{1,6}\s+|\d+[.)]\s*|[가-힣][.)]\s*)/.test(text)) evidence.push('HEADING_PREFIX');
  if (!/[.!?。]$/.test(text)) evidence.push('NO_SENTENCE_TERMINATOR');
  return evidence;
}

export async function buildHwpRepresentation(source: SourceBinary) {
  await verifySourceBinary(source);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'attachment-representation-hwp-'));
  const input = path.join(directory, 'source.hwp');
  try {
    await copyFile(source.absolutePath, input);
    const extraction = await extractHwpText(input);
    return parseHwpMarkdown(source, extraction.rawText);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

export function parseHwpMarkdown(source: SourceBinary, raw: string) {
    const tableRanges = [...raw.matchAll(/<table\b[^>]*>[\s\S]*?<\/table\s*>/gi)]
      .map((match) => ({ start: match.index ?? 0, end: (match.index ?? 0) + match[0].length, html: match[0] }));
    const units: HwpStructuralUnit[] = [];
    let structuralOrder = 0;
    let cursor = 0;
    const addParagraphs = (fragment: string) => {
      for (const block of fragment.split(/\n\s*\n|\n/).map(plain).filter(Boolean)) {
        const content = { text: block, parentRef: null, rowIndex: null, cellIndex: null, rowspan: null, colspan: null, evidence: [] as string[] };
        const paragraph = { ...baseRecord({ source, kind: 'HWP_PARAGRAPH', origin: 'PARSER_NATIVE', parser: 'KORDOC_HWP',
          parserVersion: PARSER_VERSION, structuralOrder, structuralPosition: `unit:${structuralOrder}:paragraph`, content }), ...content } as HwpStructuralUnit;
        units.push(paragraph); structuralOrder += 1;
        const evidence = headingEvidence(block);
        if (evidence.length >= 2) {
          const headingContent = { ...content, evidence };
          units.push({ ...baseRecord({ source, kind: 'HWP_HEADING_CANDIDATE', origin: 'DERIVED', parser: 'KORDOC_HWP',
            parserVersion: PARSER_VERSION, structuralOrder, structuralPosition: `unit:${structuralOrder}:heading`, content: headingContent,
            confidence: Math.min(0.9, 0.35 + evidence.length * 0.18), derivationRule: 'SHORT_PARAGRAPH_HEADING_HEURISTIC',
            derivationVersion: HEADING_VERSION, inputUnitRefs: [paragraph.recordId] }), ...headingContent } as HwpStructuralUnit);
          structuralOrder += 1;
        }
      }
    };
    for (const range of tableRanges) {
      addParagraphs(raw.slice(cursor, range.start));
      const tableText = plain(range.html);
      const tableContent = { text: tableText, parentRef: null, rowIndex: null, cellIndex: null, rowspan: null, colspan: null, evidence: [] as string[] };
      const table = { ...baseRecord({ source, kind: 'HWP_TABLE', origin: 'PARSER_NATIVE', parser: 'KORDOC_HWP', parserVersion: PARSER_VERSION,
        structuralOrder, structuralPosition: `unit:${structuralOrder}:table`, content: tableContent }), ...tableContent } as HwpStructuralUnit;
      units.push(table); structuralOrder += 1;
      const rows = [...range.html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)];
      rows.forEach((row, rowIndex) => {
        const rowContent = { text: plain(row[1]), parentRef: table.recordId, rowIndex, cellIndex: null, rowspan: null, colspan: null, evidence: [] as string[] };
        const rowUnit = { ...baseRecord({ source, kind: 'HWP_TABLE_ROW', origin: 'PARSER_NATIVE', parser: 'KORDOC_HWP', parserVersion: PARSER_VERSION,
          structuralOrder, structuralPosition: `unit:${structuralOrder}:table:${table.recordId}:row:${rowIndex}`, content: rowContent }), ...rowContent } as HwpStructuralUnit;
        units.push(rowUnit); structuralOrder += 1;
        const cells = [...row[1].matchAll(/<(t[dh])\b([^>]*)>([\s\S]*?)<\/t[dh]\s*>/gi)];
        cells.forEach((cell, cellIndex) => {
          const cellContent = { text: plain(cell[3]), parentRef: rowUnit.recordId, rowIndex, cellIndex,
            rowspan: attribute(cell[2], 'rowspan'), colspan: attribute(cell[2], 'colspan'), evidence: [] as string[] };
          units.push({ ...baseRecord({ source, kind: 'HWP_TABLE_CELL', origin: 'PARSER_NATIVE', parser: 'KORDOC_HWP', parserVersion: PARSER_VERSION,
            structuralOrder, structuralPosition: `unit:${structuralOrder}:row:${rowUnit.recordId}:cell:${cellIndex}`, content: cellContent }), ...cellContent } as HwpStructuralUnit);
          structuralOrder += 1;
        });
      });
      cursor = range.end;
    }
    addParagraphs(raw.slice(cursor));
  return { parser: 'KORDOC_HWP', parserVersion: PARSER_VERSION, rawMarkdown: raw, units };
}
