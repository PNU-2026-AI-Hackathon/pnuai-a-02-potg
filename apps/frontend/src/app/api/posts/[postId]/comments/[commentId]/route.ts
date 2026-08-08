import { NextResponse } from 'next/server';
import { getBackendAuthHeaders } from '@/lib/backend-auth';
import { getBackendUrl } from '@/lib/backend-url';

type Context = { params: Promise<{ postId: string; commentId: string }> };

async function forward(request: Request, context: Context) {
  const { postId, commentId } = await context.params;
  try {
    const response = await fetch(getBackendUrl(`/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`), {
      method: request.method,
      headers: { 'Content-Type': 'application/json', ...(await getBackendAuthHeaders()) },
      body: request.method === 'PATCH' ? await request.text() : undefined,
    });
    if (response.status === 204) return new NextResponse(null, { status: 204 });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    console.error('Comment mutation proxy failed:', error);
    return NextResponse.json({ error: '댓글 서버에 연결할 수 없습니다.' }, { status: 503 });
  }
}

export const PATCH = forward;
export const DELETE = forward;
