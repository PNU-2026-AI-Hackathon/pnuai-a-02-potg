"use client";

import { useState } from 'react';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const isSubmitDisabled = !email.trim() || !password.trim();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    console.log({
      email,
      password,
    });
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
        로그인 정보는 화면 상태만 관리하며, 실제 인증 요청은 전송하지 않습니다.
      </p>

      <button type="submit" className="loginButton" disabled={isSubmitDisabled}>
        로그인
      </button>
    </form>
  );
}