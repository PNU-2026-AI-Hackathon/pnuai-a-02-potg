import { AttachmentProcessingError } from './attachmentErrors';
import { cleanExtractedText, sanitizeRawTextForStorage } from './pdfTextExtractor';

export type PdfPageSource = 'PDFJS_TEXT' | 'CLOVA_OCR';

export type PdfPageTextResult = {
  pageNumber: number;
  source: PdfPageSource;
  rawText: string;
  cleanedText: string;
  fieldCount?: number;
  averageConfidence?: number;
  readingOrderStrategy?: string;
  renderWidth?: number;
  renderHeight?: number;
};

export type MergedPdfOcrResult = {
  rawText: string;
  cleanedText: string;
  pages: PdfPageTextResult[];
  pdfJsPageCount: number;
  ocrPageCount: number;
};

function pageMap(pageCount: number, pages: readonly PdfPageTextResult[]) {
  const result = new Map<number, PdfPageTextResult>();
  for (const page of pages) {
    if (!Number.isSafeInteger(page.pageNumber) || page.pageNumber < 1 || page.pageNumber > pageCount) {
      throw new AttachmentProcessingError('PDF_OCR_PAGE_NUMBER_OUT_OF_RANGE', 'PDF OCR page number is out of range.');
    }
    if (result.has(page.pageNumber)) {
      throw new AttachmentProcessingError('PDF_OCR_PAGE_NUMBER_DUPLICATED', 'PDF OCR page number is duplicated.');
    }
    result.set(page.pageNumber, page);
  }
  return result;
}

export function mergePdfOcrPages(input: {
  pageCount: number;
  pdfJsPages: readonly PdfPageTextResult[];
  ocrCandidatePages: readonly number[];
  ocrPages: readonly PdfPageTextResult[];
}): MergedPdfOcrResult {
  if (!Number.isSafeInteger(input.pageCount) || input.pageCount < 1) {
    throw new AttachmentProcessingError('PDF_OCR_PAGE_COUNT_INVALID', 'PDF page count is invalid.');
  }
  try {
    const pdfJs = pageMap(input.pageCount, input.pdfJsPages);
    const ocr = pageMap(input.pageCount, input.ocrPages);
    const candidates = new Set<number>();
    for (const pageNumber of input.ocrCandidatePages) {
      if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > input.pageCount) {
        throw new AttachmentProcessingError('PDF_OCR_PAGE_NUMBER_OUT_OF_RANGE', 'PDF OCR candidate page is out of range.');
      }
      if (candidates.has(pageNumber)) {
        throw new AttachmentProcessingError('PDF_OCR_PAGE_NUMBER_DUPLICATED', 'PDF OCR candidate page is duplicated.');
      }
      candidates.add(pageNumber);
    }
    if ([...ocr.keys()].some((pageNumber) => !candidates.has(pageNumber))) {
      throw new AttachmentProcessingError('PDF_OCR_PAGE_NUMBER_OUT_OF_RANGE', 'Unexpected PDF OCR page result was provided.');
    }
    const pages: PdfPageTextResult[] = [];
    for (let pageNumber = 1; pageNumber <= input.pageCount; pageNumber += 1) {
      const selected = candidates.has(pageNumber) ? ocr.get(pageNumber) : pdfJs.get(pageNumber);
      if (!selected) {
        throw new AttachmentProcessingError('PDF_OCR_PAGE_RESULT_MISSING', 'Required PDF page result is missing.');
      }
      pages.push({ ...selected, pageNumber, source: candidates.has(pageNumber) ? 'CLOVA_OCR' : 'PDFJS_TEXT' });
    }
    return {
      rawText: sanitizeRawTextForStorage(
        pages.map((page) => `[Page ${page.pageNumber}]\n${page.rawText}`).join('\n\n').trim(),
      ),
      cleanedText: cleanExtractedText(pages.map((page) => page.cleanedText).join('\n\n')),
      pages,
      pdfJsPageCount: pages.filter((page) => page.source === 'PDFJS_TEXT').length,
      ocrPageCount: pages.filter((page) => page.source === 'CLOVA_OCR').length,
    };
  } catch (error) {
    if (error instanceof AttachmentProcessingError) throw error;
    throw new AttachmentProcessingError('PDF_OCR_MERGE_FAILED', 'PDF OCR page merge failed.');
  }
}
