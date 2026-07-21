export type ProgramCaseSessionInput = {
  sessionNumber: number;
  sessionDate: Date | null;
  dateText: string;
  activity: string;
  sortOrder: number;
};

export type ProgramCaseAttachmentInput = {
  fileName: string;
  fileUrl: string;
  fileType: string;
  extractionStatus: string;
};

export type ProgramCaseInput = {
  sourceType: string;
  sourcePostId: string;
  sourceUrl: string;
  title: string;
  targetAudience: string;
  instructor: string;
  capacity: number;
  currentApplicants: number;
  applicationStatus: string;
  educationStartDate: Date;
  educationEndDate: Date;
  educationStartDateText: string;
  educationEndDateText: string;
  location: string | null;
  feeText: string | null;
  preparationText: string | null;
  contactText: string | null;
  notices: string;
  rawText: string;
  hasUnparsedAttachments: boolean;
  crawledAt: Date;
  requestSucceeded: boolean;
  parseWarnings: string[];
  sessions: ProgramCaseSessionInput[];
  attachments: ProgramCaseAttachmentInput[];
};

export type ProgramCaseValidationIssue = {
  path: string;
  message: string;
};

export type ProgramCaseSyncFailure = {
  sourceType: string | null;
  sourcePostId: string | null;
  message: string;
};

export type ProgramCaseSyncResult = {
  total: number;
  succeeded: number;
  failed: number;
  created: number;
  updated: number;
  sessions: number;
  attachments: number;
  failures: ProgramCaseSyncFailure[];
  durationMs: number;
};
