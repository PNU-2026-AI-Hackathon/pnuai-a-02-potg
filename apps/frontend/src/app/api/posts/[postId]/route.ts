import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

type RouteContext = { params: Promise<{ postId: string }> };

async function readBackendResponse(response: Response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type');
  return contentType?.includes('application/json')
    ? response.json()
    : { error: await response.text() };
}

async function getPostUrl(context: RouteContext) {
  const { postId } = await context.params;
  return getBackendUrl(`/api/posts/${encodeURIComponent(postId)}`);
}

async function forwardMutation(request: Request, context: RouteContext) {
  try {
    const response = await fetch(await getPostUrl(context), {
      method: request.method,
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
    });
    const data = await readBackendResponse(response);
    return data === null
      ? new NextResponse(null, { status: response.status })
      : NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Post mutation proxy request failed:', error);
    return NextResponse.json({ error: 'Backend posts server is unavailable.' }, { status: 503 });
  }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const response = await fetch(await getPostUrl(context), { cache: 'no-store' });
    return NextResponse.json(await readBackendResponse(response), { status: response.status });
  } catch (error) {
    console.error('Post proxy request failed:', error);
    return NextResponse.json({ error: 'Backend posts server is unavailable.' }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  return forwardMutation(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return forwardMutation(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return forwardMutation(request, context);
}
