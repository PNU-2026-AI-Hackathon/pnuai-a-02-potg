'use client';

import { useEffect, useState } from 'react';

export default function ProgramFavoriteButton({ sourceId }: { sourceId: number }) {
  const [favorited, setFavorited] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`/api/program-favorites/${sourceId}`, { cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) return { favorited: false };
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => setFavorited(Boolean(data.favorited)))
      .catch(() => undefined)
      .finally(() => setIsLoading(false));
  }, [sourceId]);

  async function toggleFavorite() {
    setIsLoading(true);
    setMessage('');
    const response = await fetch(`/api/program-favorites/${sourceId}`, { method: favorited ? 'DELETE' : 'PUT' });
    const data = await response.json();
    if (response.status === 401) setMessage('로그인 후 저장할 수 있습니다.');
    else if (!response.ok) setMessage(data.error || '관심 프로그램을 변경하지 못했습니다.');
    else setFavorited(Boolean(data.favorited));
    setIsLoading(false);
  }

  return <div className="programFavoriteControl"><button aria-pressed={favorited} className={favorited ? 'isFavorited' : ''} disabled={isLoading} onClick={toggleFavorite} type="button"><span aria-hidden="true">{favorited ? '★' : '☆'}</span>{favorited ? '관심 프로그램' : '관심 등록'}</button>{message ? <small role="status">{message}</small> : null}</div>;
}
