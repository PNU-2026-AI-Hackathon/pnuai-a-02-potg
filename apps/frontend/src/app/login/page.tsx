import { redirect } from 'next/navigation';
import Link from 'next/link';
import LoginForm from '../../components/auth/LoginForm';
import { getCurrentUser } from '@/lib/server-auth';

type LoginPageProps = {
  searchParams: Promise<{
    next?: string | string[];
    registered?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const requestedPath = typeof params.next === 'string' ? params.next : '/';
  const redirectTo =
    requestedPath.startsWith('/') && !requestedPath.startsWith('//') ? requestedPath : '/';
  const registered = params.registered;
  const user = await getCurrentUser();

  if (user) {
    redirect(redirectTo);
  }

  return (
    <main className="loginPage">
      <section className="loginShell" aria-labelledby="login-title">
        <div className="loginCard">
          <p className="loginEyebrow">모이라 로그인</p>
          <h1 id="login-title" className="loginTitle">
            다시 만나서 반갑습니다
          </h1>
          <p className="loginDescription">
            이메일과 비밀번호를 입력해 로그인하세요. 테스트 계정은 <strong>test@example.com / password123</strong>입니다.
          </p>

          {registered === 'true' ? (
            <p className="loginRegistrationMessage" role="status">
              회원가입이 완료되었습니다. 가입한 정보로 로그인해 주세요.
            </p>
          ) : null}

          <LoginForm redirectTo={redirectTo} />

          <p className="loginSignupLink">
            아직 회원이 아니신가요? <Link href="/signup">회원가입</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
