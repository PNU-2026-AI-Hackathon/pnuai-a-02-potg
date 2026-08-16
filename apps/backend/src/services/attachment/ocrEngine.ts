import type { OcrTextBox } from './clovaOcrResponseParser';

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
  /** 인식된 글자 조각의 위치. 표를 복원할 때 행·열을 묶는 근거가 된다. */
  boxes?: OcrTextBox[];
};

export interface OcrEngine {
  recognize(input: { filePath: string; format: OcrImageFormat; signal?: AbortSignal }): Promise<OcrRecognitionResult>;
}
