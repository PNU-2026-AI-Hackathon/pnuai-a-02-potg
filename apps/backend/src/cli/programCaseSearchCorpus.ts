import path from 'path';
import { buildCorpusArtifacts } from '../services/programCaseSearchCorpus/artifactStore';

const command = process.argv.slice(2).find((arg) => arg.startsWith('--')) ?? '--analyze';
const root = path.resolve(process.cwd(), '.local/program-case-search-v2');
if (!['--analyze', '--build-groups', '--build-sections', '--build-corpus', '--validate', '--all'].includes(command)) {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
const { output, summary } = buildCorpusArtifacts(root);
console.log(JSON.stringify({ command, output, ...summary }, null, 2));
if (!summary.valid || summary.privacyScan.matches > 0) process.exitCode = 1;
