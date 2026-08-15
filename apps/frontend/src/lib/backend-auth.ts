import 'server-only';

import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from './auth-config';

const STUDIO_ANONYMOUS_OWNER_COOKIE_NAME = 'moira-studio-anonymous-owner';
const STUDIO_ANONYMOUS_OWNER_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

export async function getBackendAuthHeaders(): Promise<Record<string, string>> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getBackendStudioDocumentHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (token) {
    return { Authorization: `Bearer ${token}` };
  }

  let anonymousOwnerId = cookieStore.get(STUDIO_ANONYMOUS_OWNER_COOKIE_NAME)?.value;

  if (!anonymousOwnerId) {
    anonymousOwnerId = randomUUID();
    cookieStore.set(STUDIO_ANONYMOUS_OWNER_COOKIE_NAME, anonymousOwnerId, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: STUDIO_ANONYMOUS_OWNER_COOKIE_MAX_AGE,
    });
  }

  return { 'X-Studio-Anonymous-Owner-Id': anonymousOwnerId };
}
