'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type AccountType = {
  id: string;
  title: string;
  description: string;
};

const accountTypes: AccountType[] = [
  { id: 'resident', title: '일반 사용자', description: '지역 도서관 프로그램을 찾고 참여합니다.' },
  { id: 'librarian', title: '사서', description: '도서관 프로그램과 지역 활동을 운영합니다.' },
  { id: 'admin', title: '관리자', description: '서비스 운영과 사용자 관리를 담당합니다.' },
];

const steps = ['계정 유형', '계정 정보', '이름', '기본 정보', '지역', '연락처'] as const;
const regions = ['금정구', '부산진구', '동래구', '해운대구', '북구', '남구'];
const genders = [
  { label: '선택 안 함', value: 'none' },
  { label: '여성', value: 'female' },
  { label: '남성', value: 'male' },
  { label: '기타', value: 'other' },
];

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1;
const currentDay = today.getDate();
const birthYears = Array.from({ length: 121 }, (_, index) => currentYear - index);

function getDaysInMonth(year: string, month: string) {
  if (!year || !month) {
    return 31;
  }

  return new Date(Number(year), Number(month), 0).getDate();
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState('resident');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('none');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [region, setRegion] = useState(regions[0]);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const progress = Math.round(((step - 1) / (steps.length - 1)) * 100);
  const stepTitle = useMemo(() => steps[step - 1], [step]);
  const isPasswordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const availableMonths = birthYear === String(currentYear) ? currentMonth : 12;
  const availableDays =
    birthYear && birthMonth
      ? Math.min(
          getDaysInMonth(birthYear, birthMonth),
          birthYear === String(currentYear) && Number(birthMonth) === currentMonth ? currentDay : 31,
        )
      : 31;
  const birthDate =
    birthYear && birthMonth && birthDay
      ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
      : '';

  const isStepOneValid = Boolean(accountType);
  const isStepTwoValid = /^[a-zA-Z0-9_-]{4,30}$/.test(userId.trim()) && password.length >= 8 && password === confirmPassword;
  const isStepThreeValid = name.trim().length > 0;
  const isStepFourValid = Boolean(birthDate);
  const isStepFiveValid = region.trim().length > 0;
  const isStepSixValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  function currentStepIsValid() {
    if (step === 1) return isStepOneValid;
    if (step === 2) return isStepTwoValid;
    if (step === 3) return isStepThreeValid;
    if (step === 4) return isStepFourValid;
    if (step === 5) return isStepFiveValid;
    if (step === 6) return isStepSixValid;
    return true;
  }

  function getValidationMessage() {
    if (step === 1) return '계정 유형을 선택해 주세요.';
    if (step === 2) {
      return isPasswordMismatch
        ? '비밀번호와 비밀번호 확인이 일치하지 않습니다.'
        : '회원 아이디는 4~30자, 비밀번호는 8자 이상이어야 합니다.';
    }
    if (step === 3) return '이름을 입력해 주세요.';
    if (step === 4) return '생년월일을 모두 선택해 주세요.';
    if (step === 5) return '지역을 선택해 주세요.';
    return '올바른 이메일 주소를 입력해 주세요.';
  }

  function handleNext() {
    setStatusMessage('');

    if (!currentStepIsValid()) {
      setStatusMessage(getValidationMessage());
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length));
  }

  function handlePrevious() {
    setStatusMessage('');
    setStep((current) => Math.max(current - 1, 1));
  }

  async function handleComplete() {
    if (!isStepSixValid) {
      setStatusMessage('올바른 이메일 주소를 입력해 주세요.');
      return;
    }

    setStatusMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType,
          userId: userId.trim(),
          password,
          name: name.trim(),
          gender,
          birthDate,
          region,
          email: email.trim(),
          phone: phone.trim() || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatusMessage(data?.error || '회원가입에 실패했습니다. 다시 시도해 주세요.');
        return;
      }

      router.replace('/interests');
      router.refresh();
    } catch (error) {
      console.error(error);
      setStatusMessage('회원가입 서버와 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="signupPage">
      <section className="signupShell" aria-labelledby="signup-title">
        <div className="signupCard">
          <div className="signupTopRow">
            <Link href="/login" className="signupBackLink">
              로그인으로 돌아가기
            </Link>
            <span className="signupStepBadge">
              {step} / {steps.length}
            </span>
          </div>

          <p className="signupEyebrow">MOIRA 회원가입</p>
          <h1 id="signup-title" className="signupTitle">
            {`${stepTitle}를 입력해 주세요`}
          </h1>

          <div className="signupProgressWrap" aria-label="회원가입 진행률">
            <div className="signupProgressTrack">
              <div className="signupProgressBar" style={{ width: `${progress}%` }} />
            </div>
            <div className="signupProgressMeta">
              <span>진행률</span>
              <strong>{progress}%</strong>
            </div>
          </div>

          <div className="signupStage">
            {step === 1 ? (
              <div className="signupChoiceGrid signupChoiceGridThree">
                {accountTypes.map((item) => {
                  const isSelected = accountType === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`signupChoiceCard ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        setAccountType(item.id);
                        setStatusMessage('');
                      }}
                      aria-pressed={isSelected}
                    >
                      <span>{item.title}</span>
                      <em>{item.description}</em>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {step === 2 ? (
              <div className="signupFieldGrid">
                <label className="signupField signupFieldWide" htmlFor="signup-userid">
                  <span>회원 아이디</span>
                  <input
                    id="signup-userid"
                    type="text"
                    value={userId}
                    onChange={(event) => setUserId(event.target.value)}
                    placeholder="영문, 숫자, 밑줄, 하이픈 4~30자"
                    autoComplete="username"
                  />
                </label>

                <label className="signupField" htmlFor="signup-password">
                  <span>비밀번호</span>
                  <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="8자 이상"
                    autoComplete="new-password"
                  />
                </label>

                <label className="signupField" htmlFor="signup-password-confirm">
                  <span>비밀번호 확인</span>
                  <input
                    id="signup-password-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="비밀번호를 다시 입력"
                    autoComplete="new-password"
                    aria-invalid={isPasswordMismatch}
                    aria-describedby={isPasswordMismatch ? 'signup-password-error' : undefined}
                  />
                  {isPasswordMismatch ? (
                    <small id="signup-password-error" className="signupFieldError" role="alert">
                      비밀번호가 일치하지 않습니다.
                    </small>
                  ) : null}
                </label>
              </div>
            ) : null}

            {step === 3 ? (
              <label className="signupField" htmlFor="signup-name">
                <span>이름</span>
                <input
                  id="signup-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="이름을 입력해 주세요"
                  autoComplete="name"
                />
              </label>
            ) : null}

            {step === 4 ? (
              <div className="signupFieldGrid">
                <label className="signupField" htmlFor="signup-gender">
                  <span>성별</span>
                  <select id="signup-gender" value={gender} onChange={(event) => setGender(event.target.value)}>
                    {genders.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="signupField signupFieldWide">
                  <span id="signup-birthdate-label">생년월일</span>
                  <div className="signupBirthDate" role="group" aria-labelledby="signup-birthdate-label">
                    <select
                      id="signup-birth-year"
                      value={birthYear}
                      onChange={(event) => {
                        const nextYear = event.target.value;
                        setBirthYear(nextYear);

                        if (nextYear === String(currentYear) && Number(birthMonth) > currentMonth) {
                          setBirthMonth('');
                          setBirthDay('');
                        }
                      }}
                      aria-label="출생 연도"
                    >
                      <option value="">연도</option>
                      {birthYears.map((year) => (
                        <option key={year} value={year}>
                          {year}년
                        </option>
                      ))}
                    </select>
                    <select
                      id="signup-birth-month"
                      value={birthMonth}
                      onChange={(event) => {
                        const nextMonth = event.target.value;
                        setBirthMonth(nextMonth);

                        const lastDay = nextMonth
                          ? Math.min(
                              getDaysInMonth(birthYear, nextMonth),
                              birthYear === String(currentYear) && Number(nextMonth) === currentMonth
                                ? currentDay
                                : 31,
                            )
                          : 31;
                        if (Number(birthDay) > lastDay) {
                          setBirthDay('');
                        }
                      }}
                      aria-label="출생 월"
                    >
                      <option value="">월</option>
                      {Array.from({ length: availableMonths }, (_, index) => index + 1).map((month) => (
                        <option key={month} value={month}>
                          {month}월
                        </option>
                      ))}
                    </select>
                    <select
                      id="signup-birth-day"
                      value={birthDay}
                      onChange={(event) => setBirthDay(event.target.value)}
                      aria-label="출생 일"
                    >
                      <option value="">일</option>
                      {Array.from({ length: availableDays }, (_, index) => index + 1).map((day) => (
                        <option key={day} value={day}>
                          {day}일
                        </option>
                      ))}
                    </select>
                  </div>
                  <small className="signupFieldHint">오늘 이전의 날짜만 선택할 수 있습니다.</small>
                </div>
              </div>
            ) : null}

            {step === 5 ? (
              <label className="signupField" htmlFor="signup-region">
                <span>지역</span>
                <select id="signup-region" value={region} onChange={(event) => setRegion(event.target.value)}>
                  {regions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {step === 6 ? (
              <div className="signupFieldGrid">
                <label className="signupField signupFieldWide" htmlFor="signup-email">
                  <span>이메일</span>
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="example@domain.com"
                    autoComplete="email"
                  />
                </label>

                <label className="signupField signupFieldWide" htmlFor="signup-phone">
                  <span>전화번호</span>
                  <input
                    id="signup-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="010-0000-0000"
                    autoComplete="tel"
                  />
                </label>
              </div>
            ) : null}

          </div>

          {statusMessage ? (
            <p className="signupMessage" role="alert" aria-live="polite">
              {statusMessage}
            </p>
          ) : null}

          <div className="signupActions">
            <button type="button" className="signupGhostButton" onClick={handlePrevious} disabled={step === 1 || isSubmitting}>
              이전
            </button>

            {step < 6 ? (
              <button type="button" className="signupPrimaryButton" onClick={handleNext} disabled={!currentStepIsValid()}>
                다음
              </button>
            ) : (
              <button type="button" className="signupPrimaryButton" onClick={handleComplete} disabled={!isStepSixValid || isSubmitting}>
                {isSubmitting ? '가입 처리 중...' : '가입 완료'}
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
