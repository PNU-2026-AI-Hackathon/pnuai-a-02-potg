import { NextResponse } from 'next/server';
import { getBackendAuthHeaders } from '@/lib/backend-auth';
import { getBackendUrl } from '@/lib/backend-url';

export async function GET() {
  try {
    const response = await fetch(getBackendUrl('/api/program-favorites'), { headers: await getBackendAuthHeaders(), cache: 'no-store' });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    console.error('Favorite program proxy failed:', error);
    return NextResponse.json({ error: '관심 프로그램 서버에 연결하지 못했습니다.' }, { status: 503 });
  }
}
