import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/auth-config';
import { getBackendUrl } from '@/lib/backend-url';

async function readBackendResponse(response: Response) {
  const contentType = response.headers.get('content-type');
  return contentType?.includes('application/json')
    ? response.json()
    : { code: 'INVALID_BACKEND_RESPONSE', error: await response.text() };
}

async function proxyProfile(method: 'GET' | 'PATCH', request?: Request) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json(
      { code: 'AUTHENTICATION_REQUIRED', error: '로그인이 필요합니다.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let body: string | undefined;
  if (method === 'PATCH') {
    try {
      body = JSON.stringify(await request?.json());
    } catch {
      return NextResponse.json(
        { code: 'INVALID_BODY', error: '요청 본문은 올바른 JSON이어야 합니다.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  try {
    const backendResponse = await fetch(getBackendUrl('/api/me/profile'), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === 'PATCH' ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      cache: 'no-store',
    });
    const data = await readBackendResponse(backendResponse);
    const response = NextResponse.json(data, { status: backendResponse.status });
    response.headers.set('Cache-Control', 'no-store');

    if (backendResponse.status === 401) {
      response.cookies.delete(AUTH_COOKIE_NAME);
    }

    return response;
  } catch (error) {
    console.error('Profile proxy request failed.');
    return NextResponse.json(
      { code: 'BACKEND_UNAVAILABLE', error: '프로필 정보를 처리할 수 없습니다.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function GET() {
  return proxyProfile('GET');
}

export async function PATCH(request: Request) {
  return proxyProfile('PATCH', request);
}
