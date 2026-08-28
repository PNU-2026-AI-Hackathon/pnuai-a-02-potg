import { NextResponse } from 'next/server';
import { getBackendAuthHeaders } from '@/lib/backend-auth';
import { getBackendUrl } from '@/lib/backend-url';

type Context = { params: Promise<{ resource: string }> };

async function forward(request: Request, context: Context) {
  const { resource } = await context.params;
  if (!['profile', 'activity'].includes(resource)) {
    return NextResponse.json({ error: 'Unknown account resource.' }, { status: 404 });
  }
  const response = await fetch(getBackendUrl(`/api/me/${resource}`), {
    method: request.method,
    headers: {
      ...(request.method === 'PATCH' ? { 'Content-Type': 'application/json' } : {}),
      ...(await getBackendAuthHeaders()),
    },
    body: request.method === 'PATCH' ? await request.text() : undefined,
    cache: 'no-store',
  });
  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export const GET = forward;
export const PATCH = forward;
