import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const target = new URL(getBackendUrl('/api/libraries'));
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));

  try {
    const response = await fetch(target, { cache: 'no-store' });
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { libraries: [], total: 0, query: '', error: 'Library backend is unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
