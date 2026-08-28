import 'server-only';

const DEFAULT_BACKEND_URL = 'http://localhost:4000';

function normalizeBackendUrl(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * 배포에서 BACKEND_URL 을 빼먹으면 기본값인 localhost:4000 으로 붙는다. 그 주소는
 * 배포된 기계 자신이라 아무것도 없고, 화면에는 「백엔드에 닿지 못했습니다」만 남아
 * 설정이 빠진 것인지 서버가 죽은 것인지 구분할 수 없다. 그래서 운영에서는 한 번 알린다.
 *
 * 던지지 않고 알리기만 하는 것은, 이 값이 없다고 사이트 전체가 500으로 닫히는 것보다
 * 게시판만 비는 편이 낫기 때문이다.
 */
let warnedAboutMissingBackendUrl = false;

function readBackendUrl(): string {
  const configured = process.env.BACKEND_URL?.trim();

  if (configured) {
    return normalizeBackendUrl(configured);
  }

  if (process.env.NODE_ENV === 'production' && !warnedAboutMissingBackendUrl) {
    warnedAboutMissingBackendUrl = true;
    console.error(
      'BACKEND_URL 이 설정되지 않아 localhost:4000 으로 붙습니다. 배포 환경에서는 백엔드 주소를 넣어 주세요.',
    );
  }

  return DEFAULT_BACKEND_URL;
}

export function getBackendUrl(path = ''): string {
  const baseUrl = readBackendUrl();
  const normalizedPath = path ? `/${path.replace(/^\/+/, '')}` : '';

  return `${baseUrl}${normalizedPath}`;
}
