export type SanitizationContext = 'STRUCTURED_FIELD' | 'RAW_TEXT' | 'ATTACHMENT_TEXT';
export type SanitizationCategory =
  | 'PHONE' | 'EMAIL' | 'BIRTH_DATE' | 'BANK_ACCOUNT' | 'PRIVATE_ADDRESS'
  | 'PERSONAL_CONTACT_ROW' | 'HIGH_RISK_DOCUMENT' | 'PERSON_NAME';
export type SanitizationResult = {
  text: string;
  removedCategories: SanitizationCategory[];
  changed: boolean;
};

const PHONE = /(?<![0-9A-Za-z])(?:0\d{1,2}\)?[- ]?\d{3,4}[- ]?\d{4})(?![0-9A-Za-z])/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BIRTH = /(?:생년월일|생일|출생일)/;
const ACCOUNT = /(?:입금계좌|환불계좌|계좌번호|계좌|예금주)\s*[:：]?/;
const ADDRESS = /(?:상세주소|거주지|주소)\s*[:：]?/;
const PERSON = /(?:(?:강사|담당자|사서|공무원|작성자)|(?:참여자|신청자|수강생|보호자|아동)\s*(?:이름|성명))\s*[:：]/;
const HIGH_RISK = /(?:참여자\s*명단|신청자\s*명단|수강생\s*명단|출석부|출석\s*명단|(?:^|\n)\s*신청서(?:\s|[:：]|$)|참가\s*신청서|개인정보\s*(?:수집[·ㆍ・.]?\s*이용|제공)\s*동의서|서명부|서명란|보호자\s*연락처|아동\s*정보|환불\s*계좌|강사\s*이력서|통장\s*사본|신분증\s*사본)/m;

function normalize(value: string) {
  return value.replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

export function sanitizeProgramCaseSearchText(input: string, context: SanitizationContext): SanitizationResult {
  const source = normalize(input);
  if (!source) return { text: '', removedCategories: [], changed: source !== input };
  const removed = new Set<SanitizationCategory>();
  if (context === 'ATTACHMENT_TEXT' && HIGH_RISK.test(source)) {
    return { text: '', removedCategories: ['HIGH_RISK_DOCUMENT'], changed: true };
  }
  PHONE.lastIndex = 0; EMAIL.lastIndex = 0;
  if (!PHONE.test(source) && !EMAIL.test(source) && !BIRTH.test(source)
    && !ACCOUNT.test(source) && !ADDRESS.test(source) && !PERSON.test(source)) {
    return { text: source, removedCategories: [], changed: source !== input };
  }
  const kept: string[] = [];
  for (const line of source.split('\n')) {
    PHONE.lastIndex = 0; EMAIL.lastIndex = 0;
    const hasPhone = PHONE.test(line);
    const hasEmail = EMAIL.test(line);
    if (BIRTH.test(line)) { removed.add('BIRTH_DATE'); continue; }
    if (ACCOUNT.test(line)) { removed.add('BANK_ACCOUNT'); continue; }
    if (ADDRESS.test(line)) { removed.add('PRIVATE_ADDRESS'); continue; }
    if (PERSON.test(line)) { removed.add('PERSON_NAME'); continue; }
    if ((hasPhone || hasEmail) && /(?:이름|성명|신청자|참여자|수강생|보호자|강사|담당자)/.test(line)) {
      removed.add('PERSONAL_CONTACT_ROW');
      if (hasPhone) removed.add('PHONE');
      if (hasEmail) removed.add('EMAIL');
      continue;
    }
    let value = line;
    PHONE.lastIndex = 0;
    if (PHONE.test(value)) { removed.add('PHONE'); PHONE.lastIndex = 0; value = value.replace(PHONE, ''); }
    EMAIL.lastIndex = 0;
    if (EMAIL.test(value)) { removed.add('EMAIL'); EMAIL.lastIndex = 0; value = value.replace(EMAIL, ''); }
    value = value.replace(/\s{2,}/g, ' ').replace(/\s*[:：]\s*$/, '').trim();
    if (value) kept.push(value);
  }
  const text = normalize(kept.join('\n'));
  return { text, removedCategories: [...removed].sort(), changed: text !== source || source !== input };
}

export function containsForbiddenProgramCaseSearchPattern(input: string) {
  PHONE.lastIndex = 0; EMAIL.lastIndex = 0;
  return PHONE.test(input) || EMAIL.test(input) || BIRTH.test(input)
    || ACCOUNT.test(input) || ADDRESS.test(input) || HIGH_RISK.test(input);
}

export function removeKnownPersonalValue(input: string, value: string | null | undefined) {
  const target = value?.trim();
  return target ? input.split(target).join('') : input;
}
