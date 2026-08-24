import { NextResponse } from 'next/server';
import { getBackendStudioVoteHeaders } from '@/lib/backend-auth';
import { getBackendUrl } from '@/lib/backend-url';

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  try {
    const { id } = await context.params;
    const response = await fetch(getBackendUrl(`/api/studio/votes/${encodeURIComponent(id)}`), {
      headers: await getBackendStudioVoteHeaders(), cache: 'no-store',
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: '기획서를 불러오지 못했습니다.' }, { status: 503 });
  }
}

async function forward(method: 'POST' | 'DELETE', context: Context, request?: Request) {
  try {
    const { id } = await context.params;
    const response = await fetch(getBackendUrl(`/api/studio/votes/${encodeURIComponent(id)}`), {
      method,
      headers: { ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}), ...(await getBackendStudioVoteHeaders()) },
      body: method === 'POST' ? await request?.text() : undefined,
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: '응답을 처리하지 못했습니다.' }, { status: 503 });
  }
}

export async function POST(request: Request, context: Context) { return forward('POST', context, request); }
export async function DELETE(_: Request, context: Context) { return forward('DELETE', context); }
