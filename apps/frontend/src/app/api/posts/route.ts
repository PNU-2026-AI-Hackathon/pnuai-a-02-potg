import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:4000';

async function readBackendResponse(response: Response) {
  const contentType = response.headers.get('content-type');

  return contentType?.includes('application/json')
    ? response.json()
    : { error: await response.text() };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const response = await fetch(`${BACKEND_URL}/api/posts?${url.searchParams.toString()}`, {
      cache: 'no-store',
    });
    const data = await readBackendResponse(response);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Posts proxy request failed:', error);

    return NextResponse.json(
      { error: 'Backend posts server is unavailable.' },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${BACKEND_URL}/api/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await readBackendResponse(response);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Create post proxy request failed:', error);

    return NextResponse.json(
      { error: 'Backend posts server is unavailable.' },
      { status: 503 },
    );
  }
}
