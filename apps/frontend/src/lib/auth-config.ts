export const AUTH_COOKIE_NAME = 'moira_session';
export const AUTH_COOKIE_MAX_AGE = 60 * 60;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  accountType?: 'RESIDENT' | 'LIBRARIAN' | 'ADMIN';
};

/**
 * 스튜디오는 사서와 프로그램 기획 담당자의 도구다.
 *
 * 서버(화면 앞에서 막을 때)와 브라우저(버튼이 어디로 갈지 정할 때) 양쪽이 같은 판단을
 * 해야 한다. 한쪽만 고치면 버튼은 들여보내는데 화면은 되돌려보내는 일이 생긴다.
 */
export function isStudioStaff(accountType: AuthUser['accountType'] | null | undefined) {
  return accountType === 'LIBRARIAN' || accountType === 'ADMIN';
}
