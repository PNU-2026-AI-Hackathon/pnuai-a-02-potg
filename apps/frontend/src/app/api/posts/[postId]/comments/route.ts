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

async function getCommentsUrl(context: RouteContext) {
  const { postId } = await context.params;

  return `${BACKEND_URL}/api/posts/${encodeURIComponent(postId)}/comments`;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const response = await fetch(await getCommentsUrl(context), {
      cache: 'no-store',
    });
    const data = await readBackendResponse(response);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Comments proxy request failed:', error);

    return NextResponse.json(
      { error: 'Backend posts server is unavailable.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const body = await request.json();
    const response = await fetch(await getCommentsUrl(context), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await readBackendResponse(response);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Create comment proxy request failed:', error);

    return NextResponse.json(
      { error: 'Backend posts server is unavailable.' },
      { status: 503 },
    );
  }
}
