import Link from 'next/link';

export default function SignupForm() {
  return (
    <form className="signupForm">
      <label className="signupField" htmlFor="signup-name">
        <span>이름</span>
        <input
          id="signup-name"
          name="name"
          type="text"
          placeholder="이름을 입력하세요"
          autoComplete="name"
        />
      </label>

      <label className="signupField" htmlFor="signup-email">
        <span>이메일</span>
        <input
          id="signup-email"
          name="email"
          type="email"
          placeholder="example@domain.com"
          autoComplete="email"
        />
      </label>

      <label className="signupField" htmlFor="signup-password">
        <span>비밀번호</span>
        <input
          id="signup-password"
          name="password"
          type="password"
          placeholder="비밀번호를 입력하세요"
          autoComplete="new-password"
        />
      </label>

      <label className="signupField" htmlFor="signup-password-confirm">
        <span>비밀번호 확인</span>
        <input
          id="signup-password-confirm"
          name="passwordConfirm"
          type="password"
          placeholder="비밀번호를 다시 입력하세요"
          autoComplete="new-password"
        />
      </label>

      <label className="signupField" htmlFor="signup-user-type">
        <span>이용자 유형</span>
        <select id="signup-user-type" name="userType" defaultValue="">
          <option value="" disabled>
            이용자 유형을 선택하세요
          </option>
          <option value="general">일반 이용자</option>
          <option value="librarian">사서</option>
          <option value="admin">관리자</option>
        </select>
      </label>

      <button type="button" className="signupButton">
        회원가입
      </button>

      <p className="signupLoginPrompt">
        이미 계정이 있으신가요? <Link href="/login">로그인</Link>
      </p>
    </form>
  );
}
