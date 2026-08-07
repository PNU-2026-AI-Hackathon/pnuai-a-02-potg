import 'server-only';

import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from './auth-config';

export async function getBackendAuthHeaders(): Promise<Record<string, string>> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
