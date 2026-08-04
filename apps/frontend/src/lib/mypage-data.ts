import 'server-only';

import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME, type Interest, type UserProfile } from './auth-config';
import { getBackendUrl } from './backend-url';

async function readJson<T>(response: Response): Promise<T | null> {
  if (!response.ok) return null;

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getMyPageData() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const authorization = { Authorization: `Bearer ${token}` };

  try {
    const [profileResponse, interestsResponse, selectedResponse] = await Promise.all([
      fetch(getBackendUrl('/api/me/profile'), { headers: authorization, cache: 'no-store' }),
      fetch(getBackendUrl('/api/interests'), { cache: 'no-store' }),
      fetch(getBackendUrl('/api/interests/me'), { headers: authorization, cache: 'no-store' }),
    ]);

    const [profileData, interestsData, selectedData] = await Promise.all([
      readJson<{ profile: UserProfile }>(profileResponse),
      readJson<{ interests: Interest[] }>(interestsResponse),
      readJson<{ interests: Interest[] }>(selectedResponse),
    ]);

    if (!profileData?.profile) return null;

    return {
      profile: profileData.profile,
      interests: interestsData?.interests ?? [],
      selectedInterests: selectedData?.interests ?? [],
      interestsAvailable: Boolean(interestsData && selectedData),
    };
  } catch (error) {
    console.error('My page data request failed.');
    return null;
  }
}
