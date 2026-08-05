import fs from 'fs';
import path from 'path';
import { buildAll, hash, loadBuildInputs, summarize } from './builder';

function writeJsonl(file: string, values: unknown[]) {
  fs.writeFileSync(file, `${values.map((value) => JSON.stringify(value)).join('\n')}\n`, 'utf8');
}

export function buildCorpusArtifacts(root: string) {
  const inputs = loadBuildInputs(root);
  const result = buildAll(inputs);
  const summary = summarize(inputs, result);
  const output = path.join(root, 'corpus');
  fs.mkdirSync(output, { recursive: true });
  writeJsonl(path.join(output, 'program-groups.jsonl'), result.groups);
  writeJsonl(path.join(output, 'program-group-members.jsonl'), result.groups.flatMap((group) => group.memberProgramCaseIds.map((programCaseId) => ({ groupId: group.groupId, programCaseId, representative: programCaseId === group.representativeProgramCaseId }))));
  writeJsonl(path.join(output, 'program-variants.jsonl'), result.groups.flatMap((group) => group.variantCandidates.map((variant) => ({ groupId: group.groupId, ...variant }))));
  writeJsonl(path.join(output, 'section-safety-decisions.jsonl'), result.safety);
  writeJsonl(path.join(output, 'search-corpus-core.jsonl'), result.coreCorpus);
  writeJsonl(path.join(output, 'search-corpus-safe.jsonl'), result.safeCorpus);
  fs.writeFileSync(path.join(output, 'validation-report.json'), `${JSON.stringify({ ...summary, generatedAt: null }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(output, 'grouping-analysis-report.json'), `${JSON.stringify({ counts: summary.counts, relationshipTypes: summary.relationshipTypes, groupingHash: summary.deterministic.programGroupsHash }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(output, 'corpus-analysis-report.json'), `${JSON.stringify({ counts: summary.counts, safetyStatuses: summary.safetyStatuses, documentLengths: summary.documentLengths, privacyScan: summary.privacyScan, datasetHash: summary.datasetHash }, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(output, 'inspector-index.json'), `${JSON.stringify({ datasetHash: summary.datasetHash, programCaseCount: inputs.programCases.length, groupCount: result.groups.length, corpusCount: result.safeCorpus.length, contentHash: hash(result.groups.map((g) => g.contentHash)) }, null, 2)}\n`, 'utf8');
  return { output, result, summary };
}
