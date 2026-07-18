"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type LoginFormProps = {
  redirectTo?: string;
};

export default function LoginForm({ redirectTo = '/' }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isSubmitDisabled = !email.trim() || !password.trim() || isSubmitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data?.error || '로그인에 실패했습니다. 다시 시도해 주세요.');
        return;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage('서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인하세요.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="loginForm" onSubmit={handleSubmit}>
      <label className="loginField" htmlFor="login-email">
        <span>이메일</span>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="example@domain.com"
          autoComplete="email"
        />
      </label>

      <label className="loginField" htmlFor="login-password">
        <span>비밀번호</span>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호를 입력하세요"
          autoComplete="current-password"
        />
      </label>

      <p className="loginNote">
        로그인 상태는 보안 쿠키로 안전하게 유지됩니다.
      </p>

      {errorMessage ? (
        <p className="loginMessage error" role="alert" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}
      <button type="submit" className="loginButton" disabled={isSubmitDisabled}>
        {isSubmitting ? '로그인 중...' : '로그인'}
      </button>
    </form>
  );
}
