import fs from 'fs';
import path from 'path';
import { normalizeProgram } from '../services/programDataNormalization/normalizer';
import type { RawProgram } from '../services/programDataNormalization/types';
import { mergeProgramAttachment } from '../services/programAttachmentEnrichment/mergeProgramAttachment';

const DEFAULT_CRAWL_DIR = path.resolve(process.cwd(), '.local', 'geumjeong-small-library-crawl');
const DEFAULT_ENRICHMENT = path.resolve(process.cwd(), '.local', 'program-attachment-enrichment', 'samples.json');
const DEFAULT_OUTPUT = path.resolve(process.cwd(), '.local', 'program-attachment-enrichment', 'merged-samples.json');

function latestCrawlFile(dir: string) {
  const files = fs.readdirSync(dir).filter((name) => name.startsWith('geumjeong-small-library-programs-') && name.endsWith('.json')).sort();
  if (!files.length) throw new Error(`크롤링 결과가 없습니다: ${dir}`);
  return path.join(dir, files[files.length - 1]);
}

function option(args: string[], name: string, fallback: string) {
  const index = args.indexOf(name);
  return index >= 0 ? path.resolve(args[index + 1]) : fallback;
}

export function buildMergedSamples(records: RawProgram[], samples: Array<any>) {
  const byId = new Map(records.map((record) => [record.idx, record]));
  const items = samples.map((sample) => {
    const raw = byId.get(sample.sourceId);
    if (!raw) throw new Error(`크롤링 원본에서 sourceId를 찾을 수 없습니다: ${sample.sourceId}`);
    return mergeProgramAttachment({
      program: normalizeProgram(raw),
      attachment: sample.attachment,
      match: sample.match,
      structured: sample.structured,
    });
  });
  return {
    schemaVersion: 'program-board-attachment-merge-batch/v1',
    generatedAt: new Date().toISOString(),
    count: items.length,
    summary: {
      autoReviewCandidates: items.filter((item) => item.reviewStatus === 'AUTO_REVIEW_CANDIDATE').length,
      manualReviewRequired: items.filter((item) => item.reviewStatus === 'MANUAL_REVIEW_REQUIRED').length,
      curriculumPrograms: items.filter((item) => item.curriculum.length > 0).length,
      curriculumSessions: items.reduce((sum, item) => sum + item.curriculum.length, 0),
      addedItems: items.reduce((sum, item) => sum + item.mergeAudit.added.length, 0),
      skippedDuplicates: items.reduce((sum, item) => sum + item.mergeAudit.skippedDuplicates.length, 0),
      discardedNoise: items.reduce((sum, item) => sum + item.mergeAudit.discardedNoise.length, 0),
      conflicts: items.reduce((sum, item) => sum + item.mergeAudit.warnings.length, 0),
    },
    items,
  };
}

export async function main(args = process.argv.slice(2)) {
  const crawl = option(args, '--crawl', latestCrawlFile(DEFAULT_CRAWL_DIR));
  const enrichment = option(args, '--input', DEFAULT_ENRICHMENT);
  const output = option(args, '--out', DEFAULT_OUTPUT);
  const records = (JSON.parse(fs.readFileSync(crawl, 'utf8')) as { records: RawProgram[] }).records;
  const samples = (JSON.parse(fs.readFileSync(enrichment, 'utf8')) as { results: Array<any> }).results;
  const result = buildMergedSamples(records, samples);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ output, count: result.count, summary: result.summary }, null, 2));
  return result;
}

if (require.main === module) main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
