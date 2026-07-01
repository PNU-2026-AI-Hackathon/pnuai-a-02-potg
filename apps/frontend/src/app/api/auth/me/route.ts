import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/auth-config';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

export async function GET() {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const backendResponse = await fetch(`${BACKEND_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    const data = await backendResponse.json();
    const response = NextResponse.json(data, { status: backendResponse.status });
    response.headers.set('Cache-Control', 'no-store');

    if (backendResponse.status === 401) {
      response.cookies.delete(AUTH_COOKIE_NAME);
    }

    return response;
  } catch (error) {
    console.error('Current user proxy request failed:', error);
    return NextResponse.json(
      { error: '사용자 정보를 불러올 수 없습니다.' },
      { status: 503 },
    );
  }
}
