import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

type RouteContext = {
  params: Promise<{
    postId: string;
  }>;
};

async function readBackendResponse(response: Response) {
  const contentType = response.headers.get('content-type');

  return contentType?.includes('application/json')
    ? response.json()
    : { error: await response.text() };
}

async function getPostUrl(context: RouteContext) {
  const { postId } = await context.params;

  return `${BACKEND_URL}/api/posts/${encodeURIComponent(postId)}`;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const response = await fetch(await getPostUrl(context), {
      cache: 'no-store',
    });
    const data = await readBackendResponse(response);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Post proxy request failed:', error);

    return NextResponse.json(
      { error: 'Backend posts server is unavailable.' },
      { status: 503 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const response = await fetch(await getPostUrl(context), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await readBackendResponse(response);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Update post proxy request failed:', error);

    return NextResponse.json(
      { error: 'Backend posts server is unavailable.' },
      { status: 503 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const response = await fetch(await getPostUrl(context), {
      method: 'DELETE',
    });
    const data = await readBackendResponse(response);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Delete post proxy request failed:', error);

    return NextResponse.json(
      { error: 'Backend posts server is unavailable.' },
      { status: 503 },
    );
  }
}
