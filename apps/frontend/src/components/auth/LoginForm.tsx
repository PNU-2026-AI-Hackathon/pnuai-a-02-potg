"use client";

import { useState } from 'react';

const BACKEND_URL = 'http://localhost:4000';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const isSubmitDisabled = !email.trim() || !password.trim() || isSubmitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/auth/login`, {
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

      setSuccessMessage('로그인에 성공했습니다. 응답 데이터를 콘솔에서 확인하세요.');
      console.log('로그인 응답:', data);
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
        로그인 정보는 화면 상태를 관리하며, 백엔드 로그인 API 호출로 연동합니다.
      </p>

      {errorMessage ? (
        <p className="loginMessage error" role="alert" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="loginMessage success" aria-live="polite">
          {successMessage}
        </p>
      ) : null}

      <button type="submit" className="loginButton" disabled={isSubmitDisabled}>
        {isSubmitting ? '로그인 중...' : '로그인'}
      </button>
    </form>
  );
}
