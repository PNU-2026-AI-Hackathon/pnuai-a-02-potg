export const PROGRAM_NORMALIZATION_VERSION = 'geumjeong-program-normalization-v1' as const;

export type RawAttachment = {
  name: string;
  url: string;
};

export type ProgramContentTable = {
  rows: Array<{ cells: Array<{ text: string; header: boolean; colSpan: number; rowSpan: number }> }>;
};

export type ProgramContent = {
  kind: 'table' | 'image' | 'text' | 'attachment_only' | 'empty';
  text: string;
  tables: ProgramContentTable[];
  images: Array<{ url: string; alt: string }>;
};

export type RawProgram = {
  idx: number;
  url: string;
  title: string;
  basicInfo: Record<string, string>;
  bodyText: string;
  detailText: string;
  onlineApplicationStatus?: string | null;
  programContent?: ProgramContent;
  noticeText?: string;
  attachments: RawAttachment[];
  hasAttachments: boolean;
  fetchedAt: string;
};

export type TargetGroup = '어린이' | '초등학생' | '중학생' | '일반인' | '어르신';
export type NormalizationStatus = 'normalized' | 'partial' | 'needs_review' | 'excluded';

export type NormalizedProgram = {
  normalizationVersion: typeof PROGRAM_NORMALIZATION_VERSION;
  /** 어느 판본의 사전으로 정제했는지. 사전만 갱신해도 결과가 달라지므로 함께 남긴다. */
  libraryDictionaryVersion: string;
  sourceId: number;
  sourceUrl: string;
  title: string;
  libraryName: string | null;
  targetGroup: TargetGroup | null;
  targetDetail: string | null;
  instructor: string | null;
  capacity: number | null;
  programStartDate: string | null;
  programEndDate: string | null;
  applyStartDate: string | null;
  applyEndDate: string | null;
  scheduleText: string | null;
  description: string | null;
  onlineApplicationStatus: string | null;
  programContent: ProgramContent;
  noticeText: string | null;
  isFree: boolean | null;
  feeText: string | null;
  materialFeeAmount: number | null;
  attachments: RawAttachment[];
  isExcluded: boolean;
  exclusionReason: string | null;
  normalizationStatus: NormalizationStatus;
  warnings: string[];
  evidence: {
    titleTags: string[];
    libraryMatchedText: string | null;
    /** 도서관명을 어디서 얻었는지. 제목 태그가 없을 때만 본문 장소로 폴백한다. */
    libraryNameSource: 'title_tag' | 'body_location' | null;
    knownNonLibraryTag: boolean;
    targetText: string | null;
    capacityText: string | null;
    capacityDetailCandidates: number[];
    programPeriodText: string | null;
    applyPeriodText: string | null;
    feeLines: string[];
  };
};

export type RepresentativeProgram = {
  selectionReason: string;
  raw: RawProgram;
  normalized: NormalizedProgram;
};
