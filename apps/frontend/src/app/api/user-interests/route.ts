import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/auth-config';
import { getBackendUrl } from '@/lib/backend-url';

async function proxyUserInterests(method: 'GET' | 'POST' | 'PUT', request?: Request) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ code: 'AUTHENTICATION_REQUIRED', error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const backendResponse = await fetch(getBackendUrl('/api/interests/me'), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
      },
      body: method === 'GET' ? undefined : JSON.stringify(await request?.json()),
      cache: 'no-store',
    });
    const contentType = backendResponse.headers.get('content-type');
    const data = contentType?.includes('application/json')
      ? await backendResponse.json()
      : { error: await backendResponse.text() };
    const response = NextResponse.json(data, { status: backendResponse.status });
    response.headers.set('Cache-Control', 'no-store');

    if (backendResponse.status === 401) {
      response.cookies.delete(AUTH_COOKIE_NAME);
    }

    return response;
  } catch (error) {
    console.error('User interest proxy request failed:', error);
    return NextResponse.json(
      { code: 'BACKEND_UNAVAILABLE', error: '관심분야 정보를 처리할 수 없습니다.' },
      { status: 503 },
    );
  }
}

export async function GET() {
  return proxyUserInterests('GET');
}

export async function POST(request: Request) {
  return proxyUserInterests('POST', request);
}

export async function PUT(request: Request) {
  return proxyUserInterests('PUT', request);
}
