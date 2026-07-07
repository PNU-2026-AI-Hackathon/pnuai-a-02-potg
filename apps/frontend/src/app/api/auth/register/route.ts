import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const contentType = response.headers.get('content-type');
    const data = contentType?.includes('application/json')
      ? await response.json()
      : { error: await response.text() };

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Register proxy request failed:', error);
    return NextResponse.json(
      { code: 'BACKEND_UNAVAILABLE', error: '회원가입 서버에 연결할 수 없습니다.' },
      { status: 503 },
    );
  }
}
