export const AUTH_COOKIE_NAME = 'moira_session';
export const AUTH_COOKIE_MAX_AGE = 60 * 60;

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};
