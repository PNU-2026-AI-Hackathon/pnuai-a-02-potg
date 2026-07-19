import { AttachmentProcessingError } from './attachmentErrors';

type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');
const nativeImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<PdfJsModule>;

export type PdfPageClassification = 'TEXT' | 'LOW_DENSITY' | 'OCR_CANDIDATE';
export type PdfDocumentClassification = 'TEXT' | 'MIXED' | 'OCR_REQUIRED';

export type PdfPageTextResult = {
  pageNumber: number;
  text: string;
  characterCount: number;
  nonWhitespaceCharacterCount: number;
  hangulCharacterCount: number;
  latinCharacterCount: number;
  digitCharacterCount: number;
  replacementCharacterCount: number;
  classification: PdfPageClassification;
};

export type PdfTextExtractionResult = {
  extractorVersion: string;
  pageCount: number;
  pages: PdfPageTextResult[];
  rawText: string;
  cleanedText: string;
  totalCharacterCount: number;
  totalNonWhitespaceCharacterCount: number;
  replacementCharacterCount: number;
  classification: PdfDocumentClassification;
  ocrCandidatePages: number[];
};

export function cleanExtractedText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pageClassification(nonWhitespaceCharacterCount: number): PdfPageClassification {
  if (nonWhitespaceCharacterCount >= 100) return 'TEXT';
  if (nonWhitespaceCharacterCount < 30) return 'OCR_CANDIDATE';
  return 'LOW_DENSITY';
}

function textFromItems(items: readonly unknown[]) {
  const lines: string[] = [];
  let current = '';
  for (const item of items) {
    if (!item || typeof item !== 'object' || !('str' in item)) continue;
    const textItem = item as { str: string; hasEOL?: boolean };
    if (textItem.str) current += `${current && !current.endsWith(' ') ? ' ' : ''}${textItem.str}`;
    if (textItem.hasEOL) {
      lines.push(current);
      current = '';
    }
  }
  if (current) lines.push(current);
  return lines.join('\n');
}

function analyzePage(pageNumber: number, text: string): PdfPageTextResult {
  const nonWhitespaceCharacterCount = text.replace(/\s/g, '').length;
  return {
    pageNumber,
    text,
    characterCount: text.length,
    nonWhitespaceCharacterCount,
    hangulCharacterCount: (text.match(/[\uAC00-\uD7A3]/g) || []).length,
    latinCharacterCount: (text.match(/[A-Za-z]/g) || []).length,
    digitCharacterCount: (text.match(/[0-9]/g) || []).length,
    replacementCharacterCount: (text.match(/\uFFFD/g) || []).length,
    classification: pageClassification(nonWhitespaceCharacterCount),
  };
}

function documentClassification(pages: readonly PdfPageTextResult[]): PdfDocumentClassification {
  const textPages = pages.filter((page) => page.classification === 'TEXT').length;
  const ocrPages = pages.filter((page) => page.classification === 'OCR_CANDIDATE').length;
  if (textPages > 0 && ocrPages > 0) return 'MIXED';
  if (textPages > 0) return 'TEXT';
  return 'OCR_REQUIRED';
}

export async function extractPdfText(filePath: string): Promise<PdfTextExtractionResult> {
  let loadingTask: ReturnType<PdfJsModule['getDocument']> | undefined;
  try {
    const pdfjs = await nativeImport('pdfjs-dist/legacy/build/pdf.mjs');
    loadingTask = pdfjs.getDocument({
      url: filePath,
      useSystemFonts: true,
    });
    const document = await loadingTask.promise;
    const pages: PdfPageTextResult[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        pages.push(analyzePage(pageNumber, textFromItems(content.items)));
      } finally {
        page.cleanup();
      }
    }

    const rawText = pages.map((page) => `[Page ${page.pageNumber}]\n${page.text}`).join('\n\n').trim();
    const cleanedText = cleanExtractedText(pages.map((page) => page.text).filter(Boolean).join('\n\n'));
    return {
      extractorVersion: pdfjs.version,
      pageCount: pages.length,
      pages,
      rawText,
      cleanedText,
      totalCharacterCount: pages.reduce((sum, page) => sum + page.characterCount, 0),
      totalNonWhitespaceCharacterCount: pages.reduce((sum, page) => sum + page.nonWhitespaceCharacterCount, 0),
      replacementCharacterCount: pages.reduce((sum, page) => sum + page.replacementCharacterCount, 0),
      classification: documentClassification(pages),
      ocrCandidatePages: pages.filter((page) => page.classification === 'OCR_CANDIDATE').map((page) => page.pageNumber),
    };
  } catch (error) {
    if (error instanceof AttachmentProcessingError) throw error;
    throw new AttachmentProcessingError('PDF_PARSE_FAILED', 'PDF text extraction failed.');
  } finally {
    await loadingTask?.destroy().catch(() => undefined);
  }
}
