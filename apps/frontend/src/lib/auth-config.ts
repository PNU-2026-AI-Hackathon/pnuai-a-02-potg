export const AUTH_COOKIE_NAME = 'moira_session';
export const AUTH_COOKIE_MAX_AGE = 60 * 60;

export type AccountType = 'RESIDENT' | 'LIBRARIAN' | 'ADMIN';
export type Gender = 'FEMALE' | 'MALE' | 'OTHER';

export type AuthUser = {
  id: string;
  userId: string | null;
  name: string;
  email: string;
  accountType: AccountType;
};

export type UserProfile = AuthUser & {
  gender: Gender | null;
  birthDate: string | null;
  region: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpdateUserProfileRequest = {
  name?: string;
  gender?: Gender | null;
  birthDate?: string | null;
  region?: string | null;
  phone?: string | null;
};

export type Interest = {
  id: string;
  name: string;
};
