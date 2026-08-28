import fs from 'fs';
import path from 'path';

type Json = Record<string, any>;
const SHA256 = /^[a-f0-9]{64}$/;

function json(file: string): Json { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function jsonl(file: string): Json[] {
  if (!fs.existsSync(file)) return [];
  const value = fs.readFileSync(file, 'utf8').trim();
  return value ? value.split(/\r?\n/).map((line) => JSON.parse(line)) : [];
}

export class ProgramCaseSearchInspector {
  private readonly root: string;
  private readonly programCases: Json[];
  private readonly groups: Json[];
  private readonly coreCorpus: Json[];
  private readonly safeCorpus: Json[];
  private readonly safety: Json[];
  private readonly relationships: Json[];
  private readonly sections: Json[];
  private readonly candidates: Json[];
  private readonly units: Json[];
  private readonly validation: Json;

  constructor(root = path.resolve(process.cwd(), '.local/program-case-search-v2')) {
    this.root = root;
    const source = path.join(root, 'sources');
    const representation = path.join(root, 'representation');
    const corpus = path.join(root, 'corpus');
    this.programCases = jsonl(path.join(source, 'program-cases.jsonl'));
    this.groups = jsonl(path.join(corpus, 'program-groups.jsonl'));
    this.coreCorpus = jsonl(path.join(corpus, 'search-corpus-core.jsonl'));
    this.safeCorpus = jsonl(path.join(corpus, 'search-corpus-safe.jsonl'));
    this.safety = jsonl(path.join(corpus, 'section-safety-decisions.jsonl'));
    this.relationships = jsonl(path.join(representation, 'shared-binary-relationships.jsonl'));
    this.sections = jsonl(path.join(representation, 'attachment-sections.jsonl'));
    this.candidates = jsonl(path.join(representation, 'program-case-candidates.jsonl'));
    this.units = ['pdf-pages.jsonl', 'ocr-lines.jsonl', 'ocr-blocks.jsonl', 'hwp-structural-units.jsonl'].flatMap((name) => jsonl(path.join(representation, name)));
    this.validation = json(path.join(corpus, 'validation-report.json'));
  }

  summary() { return { ...this.validation, capabilities: { readOnly: true, assetPreview: true, overlay: true } }; }

  list(query: { q?: string; safety?: string; relationship?: string; fileType?: string; shared?: string; exceptionCode?: string }) {
    const q = (query.q ?? '').trim().toLowerCase();
    const groupByMember = new Map<string, Json>(this.groups.flatMap((group) => group.memberProgramCaseIds.map((id: string) => [id, group] as [string, Json])));
    return this.programCases.map((pc) => {
      const group = groupByMember.get(pc.programCaseId);
      const decisions = this.safety.filter((d) => d.programCaseId === pc.programCaseId);
      const attachments = pc.attachments ?? [];
      const relations = [...new Set(attachments.flatMap((a: Json) => this.relationships.filter((r) => r.sourceSha256 === a.sourceSha256).map((r) => r.relationshipType)))];
      const safetyStatuses = [...new Set(decisions.map((d) => d.safetyStatus))];
      const candidateStatuses = [...new Set(decisions.map((d) => d.candidateStatus))];
      return {
        programCaseId: pc.programCaseId,
        title: pc.core?.title ?? '',
        groupId: group?.groupId ?? null,
        representative: group?.representativeProgramCaseId === pc.programCaseId,
        fileTypes: [...new Set(attachments.map((a: Json) => a.snapshot?.detectedType).filter(Boolean))],
        sharedBinary: attachments.some((a: Json) => (a.snapshot?.linkedProgramCaseIds?.length ?? 0) > 1),
        relationshipTypes: relations,
        safetyStatuses,
        candidateStatuses,
      };
    }).filter((item) => !q || `${item.title} ${item.programCaseId} ${item.groupId}`.toLowerCase().includes(q))
      .filter((item) => !query.safety || item.safetyStatuses.includes(query.safety) || item.candidateStatuses.includes(query.safety))
      .filter((item) => !query.relationship || item.relationshipTypes.includes(query.relationship))
      .filter((item) => !query.fileType || item.fileTypes.includes(query.fileType))
      .filter((item) => query.shared == null || item.sharedBinary === (query.shared === 'true'))
      .slice(0, 500);
  }

  programCase(id: string) {
    const pc = this.programCases.find((item) => item.programCaseId === id);
    if (!pc) return null;
    const attachments = (pc.attachments ?? []).map((attachment: Json) => {
      const sha = attachment.sourceSha256;
      const decisions = this.safety.filter((d) => d.programCaseId === id && d.sourceSha256 === sha);
      const sectionIds = new Set(decisions.map((d) => d.sectionId));
      const sections = this.sections.filter((s) => sectionIds.has(s.sectionId));
      const refs = new Set(sections.flatMap((s) => s.orderedUnitRefs ?? []));
      return {
        attachmentId: attachment.attachmentId,
        fileName: attachment.fileName,
        sourceSha256: sha,
        fileType: attachment.snapshot?.detectedType,
        sharedProgramCaseIds: attachment.snapshot?.linkedProgramCaseIds ?? [],
        relationships: this.relationships.filter((r) => r.sourceSha256 === sha),
        safetyDecisions: decisions,
        sections,
        candidates: this.candidates.filter((c) => sectionIds.has(c.sectionId)),
        units: this.units.filter((unit) => refs.has(unit.recordId)),
      };
    });
    const safeCore = {
      title: pc.core?.title,
      targetAudience: pc.core?.targetAudience,
      educationStartDateText: pc.core?.educationStartDateText,
      educationEndDateText: pc.core?.educationEndDateText,
      location: pc.core?.location,
    };
    return { programCaseId: id, sourceType: pc.dbIdentity?.sourceType, sourcePostId: pc.dbIdentity?.sourcePostId, sourceUrl: pc.dbIdentity?.sourceUrl, core: safeCore, sessions: pc.sessions, attachments };
  }

  group(id: string) { return this.groups.find((group) => group.groupId === id) ?? null; }
  corpus(id: string) {
    const core = this.coreCorpus.find((record) => record.corpusId === id || record.groupId === id);
    const safe = this.safeCorpus.find((record) => record.corpusId === id || record.groupId === id);
    return core || safe ? { core, safe } : null;
  }
  source(sha: string) {
    if (!SHA256.test(sha)) return null;
    const linked = this.programCases.flatMap((pc) => (pc.attachments ?? []).filter((a: Json) => a.sourceSha256 === sha).map((a: Json) => ({ programCaseId: pc.programCaseId, attachmentId: a.attachmentId, fileName: a.fileName, fileType: a.snapshot?.detectedType })));
    return linked.length ? { sourceSha256: sha, linked, relationships: this.relationships.filter((r) => r.sourceSha256 === sha) } : null;
  }
  asset(sha: string) {
    const source = this.source(sha);
    if (!source) return null;
    const file = path.resolve(this.root, 'sources', 'sha256', sha, 'original.bin');
    const allowedRoot = path.resolve(this.root, 'sources', 'sha256');
    if (!file.startsWith(`${allowedRoot}${path.sep}`) || !fs.existsSync(file)) return null;
    return { file, fileType: source.linked[0]?.fileType ?? 'UNKNOWN' };
  }
}
