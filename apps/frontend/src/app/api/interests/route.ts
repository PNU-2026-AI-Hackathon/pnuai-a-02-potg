import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

export async function GET() {
  try {
    const backendResponse = await fetch(`${BACKEND_URL}/api/interests`, {
      cache: 'no-store',
    });
    const contentType = backendResponse.headers.get('content-type');
    const data = contentType?.includes('application/json')
      ? await backendResponse.json()
      : { error: await backendResponse.text() };
    const response = NextResponse.json(data, { status: backendResponse.status });
    response.headers.set('Cache-Control', 'no-store');

    return response;
  } catch (error) {
    console.error('Interest list proxy request failed:', error);
    return NextResponse.json(
      { code: 'BACKEND_UNAVAILABLE', error: '관심분야 목록을 불러올 수 없습니다.' },
      { status: 503 },
    );
  }
}
