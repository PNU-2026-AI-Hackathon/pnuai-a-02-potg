function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

export type HwpExtractionConfig = {
  timeoutMs: number;
  stdoutMaxBytes: number;
  stderrMaxBytes: number;
  outputMaxBytes: number;
  outputMaxCharacters: number;
  minimumNonWhitespaceCharacters: number;
  maximumReplacementCharactersPerTenThousand: number;
};

export function getHwpExtractionConfig(environment: NodeJS.ProcessEnv = process.env): HwpExtractionConfig {
  return {
    timeoutMs: positiveInteger(environment.HWP_EXTRACTION_TIMEOUT_MS, 60_000, 10 * 60_000),
    stdoutMaxBytes: 64 * 1024,
    stderrMaxBytes: 64 * 1024,
    outputMaxBytes: positiveInteger(environment.HWP_EXTRACTION_OUTPUT_MAX_BYTES, 5 * 1024 * 1024, 30 * 1024 * 1024),
    outputMaxCharacters: positiveInteger(environment.HWP_EXTRACTION_OUTPUT_MAX_CHARACTERS, 5_000_000, 20_000_000),
    minimumNonWhitespaceCharacters: positiveInteger(environment.HWP_EXTRACTION_MIN_CHARACTERS, 10, 10_000),
    maximumReplacementCharactersPerTenThousand: positiveInteger(
      environment.HWP_EXTRACTION_MAX_REPLACEMENT_PER_10000,
      100,
      10_000,
    ),
  };
}
