import { NextResponse } from 'next/server';
import { getBackendAuthHeaders } from '@/lib/backend-auth';
import { getBackendUrl } from '@/lib/backend-url';

type Context = { params: Promise<{ postId: string; action: string }> };

async function forward(request: Request, context: Context) {
  const { postId, action } = await context.params;
  if (!['activity', 'like', 'save'].includes(action)) {
    return NextResponse.json({ error: 'Unknown post action.' }, { status: 404 });
  }
  const response = await fetch(getBackendUrl(`/api/posts/${encodeURIComponent(postId)}/${action}`), {
    method: request.method,
    headers: await getBackendAuthHeaders(),
    cache: 'no-store',
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return NextResponse.json(
      { error: '게시글 활동 API가 올바르지 않은 응답을 반환했습니다.' },
      { status: response.ok ? 502 : response.status },
    );
  }
  return NextResponse.json(await response.json(), { status: response.status });
}

export const GET = forward;
export const PUT = forward;
export const DELETE = forward;
