import { baseRecord, stableHash, verifySourceBinary } from './common';
import { PdfPage, PdfTextItem, SourceBinary } from './types';

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
const nativeImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<PdfJsModule>;

function pageType(nonWhitespace: number): PdfPage['pageType'] {
  if (nonWhitespace >= 100) return 'TEXT';
  if (nonWhitespace < 30) return 'OCR_CANDIDATE';
  return 'LOW_DENSITY';
}

function cleanText(value: string) {
  return value.replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim();
}

export async function buildPdfRepresentation(source: SourceBinary) {
  await verifySourceBinary(source);
  let loadingTask: ReturnType<PdfJsModule['getDocument']> | undefined;
  try {
    const pdfjs = await nativeImport('pdfjs-dist/legacy/build/pdf.mjs');
    loadingTask = pdfjs.getDocument({ url: source.absolutePath, useSystemFonts: true });
    const document = await loadingTask.promise;
    const items: PdfTextItem[] = [];
    const pages: PdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        let text = '';
        const pageItems: PdfTextItem[] = [];
        for (let index = 0; index < content.items.length; index += 1) {
          const raw = content.items[index] as Record<string, unknown>;
          if (typeof raw.str !== 'string') continue;
          const hasEol = raw.hasEOL === true;
          const itemContent = {
            pageNumber, itemOrder: index, text: cleanText(raw.str), hasEol,
            transform: Array.isArray(raw.transform) ? raw.transform.map(Number) : null,
            width: typeof raw.width === 'number' ? raw.width : null,
            height: typeof raw.height === 'number' ? raw.height : null,
            fontName: typeof raw.fontName === 'string' ? raw.fontName : null,
          };
          const item = {
            ...baseRecord({ source, kind: 'PDFJS_TEXT_ITEM', origin: 'PARSER_NATIVE', parser: 'PDFJS',
              parserVersion: pdfjs.version, structuralOrder: index, structuralPosition: `page:${pageNumber}:item:${index}`,
              content: itemContent }),
            ...itemContent,
          } as PdfTextItem;
          pageItems.push(item);
          if (item.text) text += `${text && !text.endsWith('\n') ? ' ' : ''}${item.text}`;
          if (hasEol && text && !text.endsWith('\n')) text += '\n';
        }
        text = cleanText(text);
        const nonWhitespace = text.replace(/\s/g, '').length;
        const classification = pageType(nonWhitespace);
        const pageContent = {
          pageNumber, pageHash: stableHash({ pageNumber, text }), text,
          characterCount: text.length, nonWhitespaceCharacterCount: nonWhitespace,
          hangulCharacterCount: (text.match(/[\uAC00-\uD7A3]/g) || []).length,
          latinCharacterCount: (text.match(/[A-Za-z]/g) || []).length,
          digitCharacterCount: (text.match(/[0-9]/g) || []).length,
          replacementCharacterCount: (text.match(/\uFFFD/g) || []).length,
          pageType: classification, ocrCandidate: classification === 'OCR_CANDIDATE',
          textItemRefs: pageItems.map((item) => item.recordId),
        };
        pages.push({
          ...baseRecord({ source, kind: 'PDF_PAGE', origin: 'PARSER_NATIVE', parser: 'PDFJS', parserVersion: pdfjs.version,
            structuralOrder: pageNumber - 1, structuralPosition: `page:${pageNumber}`, content: pageContent }),
          ...pageContent,
        } as PdfPage);
        items.push(...pageItems);
      } finally { page.cleanup(); }
    }
    return { parser: 'PDFJS', parserVersion: pdfjs.version, pageCount: pages.length, pages, items };
  } finally { await loadingTask?.destroy().catch(() => undefined); }
}
