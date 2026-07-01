import type { Metadata } from 'next';
import SignupForm from '../../components/auth/SignupForm';

export const metadata: Metadata = {
  title: '회원가입 | 모이라',
  description: '모이라 서비스 회원가입 페이지',
};

export default function SignupPage() {
  return (
    <main className="signupPage">
      <section className="signupShell" aria-labelledby="signup-title">
        <div className="signupCard">
          <p className="signupEyebrow">모이라 회원가입</p>
          <h1 id="signup-title" className="signupTitle">
            모이라와 함께 시작하세요
          </h1>
          <p className="signupDescription">
            계정을 만들고 지역의 이야기와 도서관 프로그램에 참여해 보세요.
          </p>

          <SignupForm />
        </div>
      </section>
    </main>
  );
}
