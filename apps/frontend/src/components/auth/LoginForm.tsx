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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
      <div className="loginIntro">
        <h1 id="login-title" className="loginTitle">환영합니다!</h1>
        <p className="loginDescription">이메일과 비밀번호를 입력하여 로그인하세요.</p>
      </div>

      <label className="loginField" htmlFor="login-email">
        <span>이메일</span>
        <div className="loginInputWrap">
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="example@domain.com"
            autoComplete="email"
          />
        </div>
      </label>

      <label className="loginField" htmlFor="login-password">
        <span>비밀번호</span>
        <div className="loginInputWrap">
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="비밀번호를 입력하세요"
            autoComplete="current-password"
          />
          <button
            type="button"
            className="loginPasswordToggle"
            aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? '숨기기' : '보기'}
          </button>
        </div>
      </label>

      <label className="loginRemember" htmlFor="login-remember-me">
        <input
          id="login-remember-me"
          type="checkbox"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
        />
        <span>로그인 상태 유지</span>
      </label>

      {errorMessage ? (
        <p className="loginMessage error" role="alert" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}

      <button type="submit" className="uiButton uiButtonPrimary loginButton" disabled={isSubmitDisabled}>
        {isSubmitting ? '로그인 중...' : '로그인하기'}
      </button>

      <div className="loginDivider" aria-hidden="true">
        <span>또는</span>
      </div>

      <button type="button" className="loginSecondaryButton" onClick={() => router.push('/signup')}>
        아직 회원이 아니신가요? <strong>회원가입</strong>
      </button>
    </form>
  );
}
