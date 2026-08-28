import Image from 'next/image';
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
          <Link className="authBrand" href="/" aria-label="모이라 홈">
            <Image
              className="authBrandLogo"
              src="/moira-logo-mark-no-ai.png"
              alt=""
              width={72}
              height={56}
              priority
            />
            <span>
              <strong>모이라</strong>
              <small>모두가 이어지는 라이브러리</small>
            </span>
          </Link>

          {registered === 'true' ? (
            <p className="loginRegistrationMessage" role="status">
              회원가입이 완료되었습니다. 가입한 정보로 로그인해 주세요.
            </p>
          ) : null}

          <LoginForm redirectTo={redirectTo} />
        </div>
      </section>
    </main>
  );
}
