import LoginForm from '../../components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="loginPage">
      <section className="loginShell" aria-labelledby="login-title">
        <div className="loginCard">
          <p className="loginEyebrow">모이라 로그인</p>
          <h1 id="login-title" className="loginTitle">
            다시 만나서 반갑습니다
          </h1>
          <p className="loginDescription">
            이메일과 비밀번호를 입력해 로그인하세요!!!! 테스트 계정은 <strong>test@example.com / password123</strong>입니다.
          </p>

          <LoginForm />
        </div>
      </section>
    </main>
  );
}
