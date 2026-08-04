export type OcrImageFormat = 'jpg' | 'jpeg' | 'png';

export type OcrRecognitionResult = {
  rawText: string;
  cleanedText: string;
  engine: string;
  engineVersion: string;
  isEmpty: boolean;
  durationMs: number;
  apiCallCount: number;
  retryCount: number;
  averageConfidence?: number;
  fieldCount?: number;
  readingOrderStrategy?: 'LINE_BREAK' | 'COORDINATE';
};

export interface OcrEngine {
  recognize(input: { filePath: string; format: OcrImageFormat; signal?: AbortSignal }): Promise<OcrRecognitionResult>;
}
