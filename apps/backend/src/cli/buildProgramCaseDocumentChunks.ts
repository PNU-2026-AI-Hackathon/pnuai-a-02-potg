import { prisma } from '../lib/prisma';
import {
  ProgramCaseDocumentChunkBatchResult,
  syncProgramCaseDocumentChunks,
} from '../services/programCaseDocumentChunk/programCaseDocumentChunkService';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type BuildProgramCaseDocumentChunksArguments =
  | { programCaseDocumentId: string }
  | { all: true };

export function parseBuildProgramCaseDocumentChunksArguments(args: string[]): BuildProgramCaseDocumentChunksArguments {
  const values: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const equals = argument.indexOf('=');
    const option = equals >= 0 ? argument.slice(0, equals) : argument;
    if (!['--program-case-document-id', '--all'].includes(option)) throw new Error(`Unknown option: ${option}`);
    if (option in values) throw new Error(`Duplicate option: ${option}`);
    if (option === '--all') {
      if (equals >= 0) throw new Error('--all does not accept a value.');
      values[option] = true;
    } else {
      const value = equals >= 0 ? argument.slice(equals + 1) : args[++index];
      if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
      values[option] = value;
    }
  }
  const id = values['--program-case-document-id'];
  const all = values['--all'] === true;
  if ((typeof id === 'string') === all) throw new Error('Exactly one of --program-case-document-id or --all is required.');
  if (typeof id === 'string') {
    if (!UUID.test(id)) throw new Error('--program-case-document-id must be a UUID.');
    return { programCaseDocumentId: id };
  }
  return { all: true };
}

export async function main(
  args = process.argv.slice(2),
  run: typeof syncProgramCaseDocumentChunks = syncProgramCaseDocumentChunks,
): Promise<ProgramCaseDocumentChunkBatchResult> {
  const result = await run(parseBuildProgramCaseDocumentChunksArguments(args));
  console.log(JSON.stringify(result, null, 2));
  if (result.documentsFailed > 0) process.exitCode = 1;
  return result;
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(JSON.stringify({
        code: 'PROGRAM_CASE_DOCUMENT_CHUNK_COMMAND_FAILED',
        error: error instanceof Error ? error.message : 'Command failed.',
      }));
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
