import 'server-only';

import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME, type AuthUser } from './auth-config';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { user?: AuthUser };
    return data.user ?? null;
  } catch (error) {
    console.error('Current user request failed:', error);
    return null;
  }
}
