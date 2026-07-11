import { NextResponse } from 'next/server';
import { AUTH_COOKIE_MAX_AGE, AUTH_COOKIE_NAME, type AuthUser } from '@/lib/auth-config';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

type RegisterResponse = {
  token?: string;
  user?: AuthUser;
  code?: string;
  error?: string;
  message?: string;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const contentType = response.headers.get('content-type');
    const data: RegisterResponse = contentType?.includes('application/json')
      ? await response.json()
      : { error: await response.text() };

    const { token, ...responseBody } = data;
    const nextResponse = NextResponse.json(responseBody, { status: response.status });
    nextResponse.headers.set('Cache-Control', 'no-store');

    if (response.ok && token) {
      nextResponse.cookies.set({
        name: AUTH_COOKIE_NAME,
        value: token,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: AUTH_COOKIE_MAX_AGE,
      });
    }

    return nextResponse;
  } catch (error) {
    console.error('Register proxy request failed:', error);
    return NextResponse.json(
      { code: 'BACKEND_UNAVAILABLE', error: '회원가입 서버에 연결할 수 없습니다.' },
      { status: 503 },
    );
  }
}
