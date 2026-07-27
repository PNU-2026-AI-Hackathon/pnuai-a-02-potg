function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maximum ? parsed : fallback;
}

export type HwpAnalysisLimits = {
  overallTimeoutMs: number;
  oleMaxDirectoryEntries: number;
  oleMaxStreamBytes: number;
  zipMaxEntries: number;
  zipMaxEntryBytes: number;
  zipMaxTotalUncompressedBytes: number;
  zipMaxCompressionRatio: number;
};

export function getHwpAnalysisLimits(environment: NodeJS.ProcessEnv = process.env): HwpAnalysisLimits {
  return {
    overallTimeoutMs: positiveInteger(environment.HWP_ANALYSIS_TIMEOUT_MS, 10 * 60_000, 60 * 60_000),
    oleMaxDirectoryEntries: positiveInteger(environment.HWP_OLE_MAX_DIRECTORY_ENTRIES, 2_048, 16_384),
    oleMaxStreamBytes: positiveInteger(environment.HWP_OLE_MAX_STREAM_BYTES, 4 * 1024 * 1024, 30 * 1024 * 1024),
    zipMaxEntries: positiveInteger(environment.HWP_ZIP_MAX_ENTRIES, 1_024, 10_000),
    zipMaxEntryBytes: positiveInteger(environment.HWP_ZIP_MAX_ENTRY_BYTES, 8 * 1024 * 1024, 30 * 1024 * 1024),
    zipMaxTotalUncompressedBytes: positiveInteger(environment.HWP_ZIP_MAX_TOTAL_BYTES, 30 * 1024 * 1024, 100 * 1024 * 1024),
    zipMaxCompressionRatio: positiveInteger(environment.HWP_ZIP_MAX_COMPRESSION_RATIO, 100, 1_000),
  };
}
