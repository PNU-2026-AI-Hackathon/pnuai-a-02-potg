import {
  removeKnownPersonalValue,
  sanitizeProgramCaseSearchText,
} from './programCaseDocumentSanitizer';

export type ProgramCaseDocumentProgram = {
  id: string;
  sourceType: string;
  sourcePostId: string;
  sourceUrl: string;
  title: string;
  targetAudience: string;
  instructor: string;
  capacity: number;
  currentApplicants: number;
  applicationStatus: string;
  educationStartDate: Date | string;
  educationEndDate: Date | string;
  educationStartDateText: string;
  educationEndDateText: string;
  location: string | null;
  feeText: string | null;
  preparationText: string | null;
  contactText: string | null;
  notices: string;
  rawText: string;
};

export type ProgramCaseDocumentSession = {
  id?: string;
  sessionNumber: number;
  sessionDate: Date | string | null;
  dateText: string;
  activity: string;
  sortOrder: number;
};

export type ProgramCaseDocumentAttachment = {
  id?: string;
  fileName: string;
  fileUrl?: string;
  fileType: string | null;
  detectedFileType: string | null;
  detectedMimeType?: string | null;
  extractionStatus: string;
  cleanedText: string | null;
  extractorType: string | null;
  extractorVersion?: string | null;
  isActive: boolean;
  createdAt?: Date | string;
};

export type ProgramCaseDocumentInput = {
  program: ProgramCaseDocumentProgram;
  sessions: readonly ProgramCaseDocumentSession[];
  attachments: readonly ProgramCaseDocumentAttachment[];
};

type Field = readonly [label: string, value: unknown];

export function normalizeText(value: string) {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .split('\n')
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function textValue(value: unknown) {
  if (value === null || value === undefined) return '';
  return normalizeText(String(value));
}

export function dateValue(value: Date | string | null) {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  const normalized = textValue(value);
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? normalized : parsed.toISOString().slice(0, 10);
}

export function fieldLines(fields: readonly Field[]) {
  return fields.flatMap(([label, value]) => {
    const text = textValue(value);
    return text ? [`${label}: ${text}`] : [];
  });
}

export function section(title: string, blocks: readonly string[]) {
  const content = blocks.map(textValue).filter(Boolean);
  return content.length > 0 ? [`[${title}]`, '', content.join('\n\n')].join('\n') : '';
}

function sessionKey(session: ProgramCaseDocumentSession) {
  return session.id ?? '';
}

function attachmentKey(attachment: ProgramCaseDocumentAttachment) {
  const createdAt = attachment.createdAt instanceof Date
    ? attachment.createdAt.toISOString()
    : textValue(attachment.createdAt);
  return `${createdAt}\u0000${attachment.id ?? ''}\u0000${attachment.fileName}`;
}

export function buildSessions(sessions: readonly ProgramCaseDocumentSession[]) {
  return [...sessions]
    .sort((left, right) =>
      left.sortOrder - right.sortOrder
      || left.sessionNumber - right.sessionNumber
      || sessionKey(left).localeCompare(sessionKey(right)))
    .map((session) => {
      const details = fieldLines([
        ['운영 일자', textValue(session.dateText) || dateValue(session.sessionDate)],
        ['활동', session.activity],
      ]);
      return details.length > 0
        ? [`${session.sessionNumber}회차`, ...details.map((line) => `- ${line}`)].join('\n')
        : '';
    })
    .filter(Boolean);
}

function attachmentFormat(attachment: ProgramCaseDocumentAttachment) {
  return textValue(attachment.detectedFileType)
    || textValue(attachment.fileType)
    || textValue(attachment.detectedMimeType);
}

function buildAttachments(attachments: readonly ProgramCaseDocumentAttachment[]) {
  return [...attachments]
    .map((attachment) => ({
      ...attachment,
      fileName: sanitizeProgramCaseSearchText(attachment.fileName, 'ATTACHMENT_TEXT').text,
    }))
    .filter((attachment) =>
      attachment.isActive
      && attachment.extractionStatus === 'COMPLETED'
      && textValue(attachment.cleanedText).length > 0)
    .sort((left, right) => attachmentKey(left).localeCompare(attachmentKey(right)))
    .map((attachment) => {
      const sanitizedText = sanitizeProgramCaseSearchText(
        textValue(attachment.cleanedText),
        'ATTACHMENT_TEXT',
      ).text;
      if (!sanitizedText) return '';
      const metadata = fieldLines([
        ['파일명', attachment.fileName],
        ['파일 형식', attachmentFormat(attachment)],
        ['추출기', attachment.extractorType],
      ]);
      return [...metadata, '', sanitizedText].filter(Boolean).join('\n');
    })
    .filter(Boolean);
}

export function originalBody(program: ProgramCaseDocumentProgram) {
  let body = textValue(program.rawText);
  const title = textValue(program.title);
  const duplicatedTitle = `${title} ${title}`;
  if (title && body.startsWith(duplicatedTitle)) {
    body = body.slice(title.length).trim();
  }

  const notices = textValue(program.notices);
  if (notices && body.includes(notices)) {
    body = normalizeText(body.replace(notices, ''));
  }
  return body;
}

export function buildProgramCaseDocument(input: ProgramCaseDocumentInput) {
  const instructor = input.program.instructor;
  const sanitizeKnown = (
    value: string | null | undefined,
    context: 'STRUCTURED_FIELD' | 'RAW_TEXT' | 'ATTACHMENT_TEXT',
  ) => sanitizeProgramCaseSearchText(
    removeKnownPersonalValue(value ?? '', instructor),
    context,
  ).text;
  input = {
    program: {
      ...input.program,
      sourcePostId: sanitizeKnown(input.program.sourcePostId, 'STRUCTURED_FIELD'),
      sourceUrl: sanitizeKnown(input.program.sourceUrl, 'STRUCTURED_FIELD'),
      title: sanitizeKnown(input.program.title, 'STRUCTURED_FIELD'),
      targetAudience: sanitizeKnown(input.program.targetAudience, 'STRUCTURED_FIELD'),
      location: sanitizeKnown(input.program.location, 'STRUCTURED_FIELD'),
      feeText: sanitizeKnown(input.program.feeText, 'STRUCTURED_FIELD'),
      preparationText: sanitizeKnown(input.program.preparationText, 'STRUCTURED_FIELD'),
      notices: sanitizeKnown(input.program.notices, 'RAW_TEXT'),
      rawText: sanitizeKnown(input.program.rawText, 'RAW_TEXT'),
    },
    sessions: input.sessions.map((session) => ({
      ...session,
      activity: sanitizeKnown(session.activity, 'RAW_TEXT'),
    })),
    attachments: input.attachments.map((attachment) => ({
      ...attachment,
      fileName: sanitizeKnown(attachment.fileName, 'ATTACHMENT_TEXT'),
      cleanedText: sanitizeKnown(attachment.cleanedText, 'ATTACHMENT_TEXT'),
    })),
  };
  const program = {
    ...input.program,
    instructor: '',
    contactText: null,
    notices: sanitizeProgramCaseSearchText(input.program.notices, 'RAW_TEXT').text,
    rawText: sanitizeProgramCaseSearchText(input.program.rawText, 'RAW_TEXT').text,
  };
  const period = [
    textValue(program.educationStartDateText) || dateValue(program.educationStartDate),
    textValue(program.educationEndDateText) || dateValue(program.educationEndDate),
  ].filter(Boolean).join(' ~ ');

  const basicInformation = fieldLines([
    ['프로그램명', program.title],
    ['대상', program.targetAudience],
    ['강사', program.instructor],
    ['모집 인원', program.capacity],
    ['현재 신청 인원', program.currentApplicants],
    ['신청 상태', program.applicationStatus],
    ['운영 기간', period],
    ['장소', program.location],
    ['비용', program.feeText],
    ['준비물', program.preparationText],
    ['문의처', program.contactText],
  ]);

  const sections = [
    section('프로그램 기본 정보', [basicInformation.join('\n')]),
    section('프로그램 안내', [program.notices]),
    section('원본 게시글 본문', [originalBody(program)]),
    section('회차별 활동', buildSessions(input.sessions)),
    section('첨부파일 내용', buildAttachments(input.attachments)),
    section('출처 정보', [fieldLines([
      ['프로그램 사례 ID', program.id],
      ['출처 유형', program.sourceType],
      ['원본 게시글 ID', program.sourcePostId],
      ['원본 URL', program.sourceUrl],
    ]).join('\n')]),
  ].filter(Boolean);

  return normalizeText(sections.join('\n\n'));
}
