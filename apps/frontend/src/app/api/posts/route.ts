import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';
import { getBackendAuthHeaders } from '@/lib/backend-auth';

async function readBackendResponse(response: Response) {
  const contentType = response.headers.get('content-type');

  return contentType?.includes('application/json')
    ? response.json()
    : { error: await response.text() };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const response = await fetch(getBackendUrl(`/api/posts?${url.searchParams.toString()}`), {
      headers: await getBackendAuthHeaders(),
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
    const response = await fetch(getBackendUrl('/api/posts'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getBackendAuthHeaders()),
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
