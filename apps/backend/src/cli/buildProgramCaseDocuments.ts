import { prisma } from '../lib/prisma';
import {
  buildProgramCaseDocuments,
  ProgramCaseDocumentBatchResult,
} from '../services/programCaseDocument/programCaseDocumentService';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BuildProgramCaseDocumentsArguments =
  | { programCaseId: string }
  | { all: true };

export function parseBuildProgramCaseDocumentsArguments(args: string[]): BuildProgramCaseDocumentsArguments {
  const values: Record<string, string | boolean> = {};
  const valueOptions = new Set(['--program-case-id']);
  const flagOptions = new Set(['--all']);
  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    if (!valueOptions.has(option) && !flagOptions.has(option)) throw new Error(`Unknown option: ${option}`);
    if (option in values) throw new Error(`Duplicate option: ${option}`);
    if (valueOptions.has(option)) {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
      values[option] = value;
    } else {
      values[option] = true;
    }
  }

  const programCaseId = values['--program-case-id'];
  const all = values['--all'] === true;
  if ((typeof programCaseId === 'string') === all) {
    throw new Error('Exactly one of --program-case-id or --all is required.');
  }
  if (typeof programCaseId === 'string') {
    if (!UUID.test(programCaseId)) throw new Error('--program-case-id must be a UUID.');
    return { programCaseId };
  }
  return { all: true };
}

export async function main(
  args = process.argv.slice(2),
  run: typeof buildProgramCaseDocuments = buildProgramCaseDocuments,
): Promise<ProgramCaseDocumentBatchResult> {
  const result = await run(parseBuildProgramCaseDocumentsArguments(args));
  console.log(JSON.stringify(result, null, 2));
  if (result.failed > 0) process.exitCode = 1;
  return result;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(JSON.stringify({
        code: 'PROGRAM_CASE_DOCUMENT_COMMAND_FAILED',
        error: error instanceof Error ? error.message : 'Program case document command failed.',
      }));
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
