import { NextResponse } from 'next/server';
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME, type AuthUser } from '@/lib/auth-config';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

type LoginResponse = {
  token?: string;
  user?: AuthUser;
  error?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const contentType = response.headers.get('content-type');
    const data: LoginResponse = contentType?.includes('application/json')
      ? await response.json()
      : { error: await response.text() };

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || '로그인에 실패했습니다.' },
        { status: response.status },
      );
    }

    if (!data.token || !data.user) {
      return NextResponse.json(
        { error: '로그인 응답에 인증 정보가 없습니다.' },
        { status: 502 },
      );
    }

    const nextResponse = NextResponse.json({ user: data.user });
    nextResponse.headers.set('Cache-Control', 'no-store');
    nextResponse.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: data.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: AUTH_COOKIE_MAX_AGE,
    });

    return nextResponse;
  } catch (error) {
    console.error('Login proxy request failed:', error);

    return NextResponse.json(
      { error: 'Backend login server is unavailable.' },
      { status: 503 },
    );
  }
}
