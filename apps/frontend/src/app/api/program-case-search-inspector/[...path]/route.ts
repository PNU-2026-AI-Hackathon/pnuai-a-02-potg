import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path?.length || path.some((part) => part === '..' || part.includes('/') || part.includes('\\'))) return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  const target = new URL(getBackendUrl(`/api/internal/program-case-search-inspector/${path.map(encodeURIComponent).join('/')}`));
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  try {
    const response = await fetch(target, { cache: 'no-store' });
    const body = await response.arrayBuffer();
    return new NextResponse(body, { status: response.status, headers: { 'Content-Type': response.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Inspector backend is unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
