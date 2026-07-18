import 'server-only';

const DEFAULT_BACKEND_URL = 'http://localhost:4000';

function normalizeBackendUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function getBackendUrl(path = ''): string {
  const baseUrl = normalizeBackendUrl(process.env.BACKEND_URL || DEFAULT_BACKEND_URL);
  const normalizedPath = path ? `/${path.replace(/^\/+/, '')}` : '';

  return `${baseUrl}${normalizedPath}`;
}
