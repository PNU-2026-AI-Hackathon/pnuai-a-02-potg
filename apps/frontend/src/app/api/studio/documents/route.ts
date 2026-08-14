import { NextResponse } from 'next/server';
import { getBackendAuthHeaders } from '@/lib/backend-auth';
import { getBackendUrl } from '@/lib/backend-url';

async function readBackendResponse(response: Response) {
  const contentType = response.headers.get('content-type');

  return contentType?.includes('application/json')
    ? response.json()
    : { error: await response.text() };
}

export async function GET() {
  try {
    const response = await fetch(getBackendUrl('/api/studio/documents'), {
      headers: await getBackendAuthHeaders(),
      cache: 'no-store',
    });

    return NextResponse.json(await readBackendResponse(response), { status: response.status });
  } catch (error) {
    console.error('Studio document list proxy failed:', error);

    return NextResponse.json({ error: 'Backend studio document server is unavailable.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const response = await fetch(getBackendUrl('/api/studio/documents'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getBackendAuthHeaders()),
      },
      body: await request.text(),
    });

    return NextResponse.json(await readBackendResponse(response), { status: response.status });
  } catch (error) {
    console.error('Studio document creation proxy failed:', error);

    return NextResponse.json({ error: 'Backend studio document server is unavailable.' }, { status: 503 });
  }
}
