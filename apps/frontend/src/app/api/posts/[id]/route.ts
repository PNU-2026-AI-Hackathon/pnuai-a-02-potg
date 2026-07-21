import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

async function forward(request: Request, id: string) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/posts/${encodeURIComponent(id)}`, {
      method: request.method,
      headers: { 'Content-Type': 'application/json' },
      body: await request.text(),
    });

    if (response.status === 204) return new NextResponse(null, { status: 204 });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch (error) {
    console.error('Post mutation proxy request failed:', error);
    return NextResponse.json({ error: 'Backend posts server is unavailable.' }, { status: 503 });
  }
}

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return forward(request, (await context.params).id);
}

export async function DELETE(request: Request, context: RouteContext) {
  return forward(request, (await context.params).id);
}
