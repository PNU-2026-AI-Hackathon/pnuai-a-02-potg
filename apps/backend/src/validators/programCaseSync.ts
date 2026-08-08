import { ProgramCaseInput, ProgramCaseValidationIssue } from '../types/programCase';

type RecordValue = Record<string, unknown>;

export type ProgramCaseValidationResult =
  | { ok: true; programs: ProgramCaseInput[] }
  | { ok: false; issues: ProgramCaseValidationIssue[] };

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRequiredString(record: RecordValue, key: string, path: string, issues: ProgramCaseValidationIssue[]) {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    issues.push({ path: `${path}.${key}`, message: 'must be a non-empty string' });
    return '';
  }
  return value.trim();
}

function readText(record: RecordValue, key: string, path: string, issues: ProgramCaseValidationIssue[]) {
  const value = record[key];
  if (typeof value !== 'string') {
    issues.push({ path: `${path}.${key}`, message: 'must be a string' });
    return '';
  }
  return value;
}

function readNullableString(record: RecordValue, key: string, path: string, issues: ProgramCaseValidationIssue[]) {
  const value = record[key];
  if (value === null) return null;
  if (typeof value !== 'string') {
    issues.push({ path: `${path}.${key}`, message: 'must be a string or null' });
    return null;
  }
  return value;
}

function readInteger(record: RecordValue, key: string, path: string, issues: ProgramCaseValidationIssue[]) {
  const value = record[key];
  if (!Number.isInteger(value) || (value as number) < 0) {
    issues.push({ path: `${path}.${key}`, message: 'must be a non-negative integer' });
    return 0;
  }
  return value as number;
}

function readBoolean(record: RecordValue, key: string, path: string, issues: ProgramCaseValidationIssue[]) {
  const value = record[key];
  if (typeof value !== 'boolean') {
    issues.push({ path: `${path}.${key}`, message: 'must be a boolean' });
    return false;
  }
  return value;
}

function readUrl(record: RecordValue, key: string, path: string, issues: ProgramCaseValidationIssue[]) {
  const value = readRequiredString(record, key, path, issues);
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('invalid protocol');
  } catch {
    issues.push({ path: `${path}.${key}`, message: 'must be an absolute HTTP(S) URL' });
  }
  return value;
}

function readDateOnly(record: RecordValue, key: string, path: string, issues: ProgramCaseValidationIssue[]) {
  const value = readRequiredString(record, key, path, issues);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    issues.push({ path: `${path}.${key}`, message: 'must use YYYY-MM-DD format' });
    return { value, date: new Date(0) };
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    issues.push({ path: `${path}.${key}`, message: 'must be a valid calendar date' });
  }
  return { value, date };
}

function readDateTime(record: RecordValue, key: string, path: string, issues: ProgramCaseValidationIssue[]) {
  const value = readRequiredString(record, key, path, issues);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    issues.push({ path: `${path}.${key}`, message: 'must be a valid ISO date-time' });
    return new Date(0);
  }
  return date;
}

function readStringArray(record: RecordValue, key: string, path: string, issues: ProgramCaseValidationIssue[]) {
  const value = record[key];
  if (!Array.isArray(value)) {
    issues.push({ path: `${path}.${key}`, message: 'must be an array of strings' });
    return [];
  }
  const result: string[] = [];
  value.forEach((item, index) => {
    if (typeof item !== 'string') {
      issues.push({ path: `${path}.${key}[${index}]`, message: 'must be a string' });
    } else {
      result.push(item);
    }
  });
  return result;
}

function parseSessions(value: unknown, path: string, issues: ProgramCaseValidationIssue[]) {
  if (!Array.isArray(value)) {
    issues.push({ path, message: 'must be an array' });
    return [];
  }
  const seen = new Set<number>();
  return value.flatMap((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      issues.push({ path: itemPath, message: 'must be an object' });
      return [];
    }
    const sessionNumber = readInteger(item, 'sessionNumber', itemPath, issues);
    if (seen.has(sessionNumber)) {
      issues.push({ path: `${itemPath}.sessionNumber`, message: 'must be unique within the program' });
    }
    seen.add(sessionNumber);
    const date = readDateOnly(item, 'dateText', itemPath, issues);
    return [{
      sessionNumber,
      sessionDate: date.date,
      dateText: date.value,
      activity: readText(item, 'activity', itemPath, issues),
      sortOrder: index,
    }];
  });
}

function parseAttachments(value: unknown, path: string, issues: ProgramCaseValidationIssue[]) {
  if (!Array.isArray(value)) {
    issues.push({ path, message: 'must be an array' });
    return [];
  }
  const seen = new Set<string>();
  return value.flatMap((item, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      issues.push({ path: itemPath, message: 'must be an object' });
      return [];
    }
    const fileUrl = readUrl(item, 'fileUrl', itemPath, issues);
    if (seen.has(fileUrl)) {
      issues.push({ path: `${itemPath}.fileUrl`, message: 'must be unique within the program' });
    }
    seen.add(fileUrl);
    const extractionStatus = item.extractionStatus === undefined
      ? 'PENDING'
      : readRequiredString(item, 'extractionStatus', itemPath, issues);
    return [{
      fileName: readRequiredString(item, 'fileName', itemPath, issues),
      fileUrl,
      fileType: readRequiredString(item, 'fileType', itemPath, issues),
      extractionStatus,
    }];
  });
}

function parseProgram(value: unknown, index: number, issues: ProgramCaseValidationIssue[]): ProgramCaseInput | null {
  const path = `programs[${index}]`;
  if (!isRecord(value)) {
    issues.push({ path, message: 'must be an object' });
    return null;
  }
  const educationStart = readDateOnly(value, 'educationStartDate', path, issues);
  const educationEnd = readDateOnly(value, 'educationEndDate', path, issues);
  return {
    sourceType: readRequiredString(value, 'sourceType', path, issues),
    sourcePostId: readRequiredString(value, 'sourcePostId', path, issues),
    sourceUrl: readUrl(value, 'sourceUrl', path, issues),
    title: readRequiredString(value, 'title', path, issues),
    targetAudience: readRequiredString(value, 'targetAudience', path, issues),
    instructor: readRequiredString(value, 'instructor', path, issues),
    capacity: readInteger(value, 'capacity', path, issues),
    currentApplicants: readInteger(value, 'currentApplicants', path, issues),
    applicationStatus: readRequiredString(value, 'applicationStatus', path, issues),
    educationStartDate: educationStart.date,
    educationEndDate: educationEnd.date,
    educationStartDateText: educationStart.value,
    educationEndDateText: educationEnd.value,
    location: readNullableString(value, 'location', path, issues),
    feeText: readNullableString(value, 'feeText', path, issues),
    preparationText: readNullableString(value, 'preparationText', path, issues),
    contactText: readNullableString(value, 'contactText', path, issues),
    notices: readText(value, 'notices', path, issues),
    rawText: readText(value, 'rawText', path, issues),
    hasUnparsedAttachments: readBoolean(value, 'hasUnparsedAttachments', path, issues),
    crawledAt: readDateTime(value, 'crawledAt', path, issues),
    requestSucceeded: readBoolean(value, 'requestSucceeded', path, issues),
    parseWarnings: readStringArray(value, 'parseWarnings', path, issues),
    sessions: parseSessions(value.sessions, `${path}.sessions`, issues),
    attachments: parseAttachments(value.attachments, `${path}.attachments`, issues),
  };
}

export function validateProgramCaseSyncRequest(body: unknown): ProgramCaseValidationResult {
  const issues: ProgramCaseValidationIssue[] = [];
  const values = Array.isArray(body) ? body : isRecord(body) ? body.programs : undefined;
  if (!Array.isArray(values)) {
    return { ok: false, issues: [{ path: 'programs', message: 'must be an array' }] };
  }
  if (values.length === 0) {
    return { ok: false, issues: [{ path: 'programs', message: 'must contain at least one program' }] };
  }
  const programs = values.flatMap((value, index) => {
    const program = parseProgram(value, index, issues);
    return program ? [program] : [];
  });
  const seen = new Set<string>();
  programs.forEach((program, index) => {
    const key = `${program.sourceType}\u0000${program.sourcePostId}`;
    if (seen.has(key)) {
      issues.push({ path: `programs[${index}]`, message: 'sourceType and sourcePostId must be unique within the request' });
    }
    seen.add(key);
  });
  return issues.length > 0 ? { ok: false, issues } : { ok: true, programs };
}
