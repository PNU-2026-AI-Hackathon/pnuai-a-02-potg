'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AuthUser } from '@/lib/auth-config';

type AuthActionsProps = {
  initialUser: AuthUser | null;
};

export default function AuthActions({ initialUser }: AuthActionsProps) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleLogout() {
    setIsLoggingOut(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' });

      if (!response.ok) {
        throw new Error('Logout failed');
      }

      setUser(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage('로그아웃에 실패했습니다.');
    } finally {
      setIsLoggingOut(false);
    }
  }

  if (!user) {
    return (
      <div className="authActions">
        <Link href="/login">로그인</Link>
        <Link className="signupLink" href="/signup">회원가입</Link>
      </div>
    );
  }

  return (
    <div className="authActions">
      <button
        type="button"
        className="mypageButton"
        disabled
        title="마이페이지는 준비 중입니다."
      >
        마이페이지
      </button>
      <button
        type="button"
        className="logoutButton"
        onClick={handleLogout}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
      </button>
      {errorMessage ? (
        <span className="authError" role="alert">
          {errorMessage}
        </span>
      ) : null}
    </div>
  );
}
