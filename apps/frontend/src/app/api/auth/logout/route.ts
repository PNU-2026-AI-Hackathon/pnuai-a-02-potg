import { NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME } from '@/lib/auth-config';

export async function POST() {
  const response = NextResponse.json({ message: '로그아웃되었습니다.' });
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
