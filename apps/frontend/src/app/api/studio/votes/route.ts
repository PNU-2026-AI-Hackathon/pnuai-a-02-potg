import { NextResponse } from 'next/server';
import { getBackendStudioVoteHeaders } from '@/lib/backend-auth';
import { getBackendUrl } from '@/lib/backend-url';

export async function GET() {
  try {
    const response = await fetch(getBackendUrl('/api/studio/votes'), { headers: await getBackendStudioVoteHeaders(), cache: 'no-store' });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: '수요조사 목록을 불러오지 못했습니다.' }, { status: 503 });
  }
}
