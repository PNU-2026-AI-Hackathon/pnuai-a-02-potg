import { NextResponse } from 'next/server';
import { getBackendStudioDocumentHeaders } from '@/lib/backend-auth';
import { getBackendUrl } from '@/lib/backend-url';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function readBackendResponse(response: Response) {
  const contentType = response.headers.get('content-type');

  return contentType?.includes('application/json')
    ? response.json()
    : { error: await response.text() };
}

async function getStudioDocumentUrl(context: RouteContext) {
  const { id } = await context.params;

  return getBackendUrl(`/api/studio/documents/${encodeURIComponent(id)}`);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const response = await fetch(await getStudioDocumentUrl(context), {
      headers: await getBackendStudioDocumentHeaders(),
      cache: 'no-store',
    });

    return NextResponse.json(await readBackendResponse(response), { status: response.status });
  } catch (error) {
    console.error('Studio document detail proxy failed:', error);

    return NextResponse.json({ error: 'Backend studio document server is unavailable.' }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const response = await fetch(await getStudioDocumentUrl(context), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(await getBackendStudioDocumentHeaders()),
      },
      body: await request.text(),
    });

    return NextResponse.json(await readBackendResponse(response), { status: response.status });
  } catch (error) {
    console.error('Studio document update proxy failed:', error);

    return NextResponse.json({ error: 'Backend studio document server is unavailable.' }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const response = await fetch(await getStudioDocumentUrl(context), {
      method: 'DELETE',
      headers: await getBackendStudioDocumentHeaders(),
    });

    return NextResponse.json(await readBackendResponse(response), { status: response.status });
  } catch (error) {
    console.error('Studio document deletion proxy failed:', error);

    return NextResponse.json({ error: 'Backend studio document server is unavailable.' }, { status: 503 });
  }
}
