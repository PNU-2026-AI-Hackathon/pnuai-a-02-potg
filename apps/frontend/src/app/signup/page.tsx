'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type InterestCategory = {
  id: string;
  title: string;
};

type AccountType = {
  id: string;
  title: string;
  description: string;
};

const interestCategories: InterestCategory[] = [
  { id: 'reading', title: '독서/인문' },
  { id: 'culture', title: '문화/예술' },
  { id: 'digital', title: '디지털/AI' },
  { id: 'children', title: '아동/가족' },
  { id: 'youth', title: '청소년/진로' },
  { id: 'senior', title: '시니어/복지' },
  { id: 'community', title: '지역참여' },
  { id: 'volunteer', title: '봉사/나눔' },
];

const accountTypes: AccountType[] = [
  { id: 'resident', title: '일반 사용자', description: '마을 주민으로 가입해요' },
  { id: 'librarian', title: '사서', description: '도서관 운영자 계정이에요' },
  { id: 'admin', title: '관리자', description: '전체 관리 권한 계정이에요' },
];

const steps = ['계정 유형', '계정 정보', '이름', '기본 정보', '지역', '연락처', '관심분야', '완료'] as const;
const regions = ['금정구', '부산진구', '동래구', '해운대구', '북구', '남구'];
const genders = ['선택 안 함', '여성', '남성', '기타'];
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
  const [step, setStep] = useState(1);
  const [accountType, setAccountType] = useState('resident');
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [gender, setGender] = useState('선택 안 함');
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [region, setRegion] = useState('금정구');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('');

  const progress = Math.round(((step - 1) / (steps.length - 1)) * 100);
  const stepTitle = useMemo(() => steps[step - 1], [step]);

  const isStepOneValid = Boolean(accountType);
  const isStepTwoValid = userId.trim().length > 0 && password.trim().length > 0 && password === confirmPassword;
  const isStepThreeValid = name.trim().length > 0;
  const isPasswordMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const availableMonths =
    birthYear === String(currentYear) ? currentMonth : 12;
  const availableDays = birthYear && birthMonth
    ? Math.min(
        getDaysInMonth(birthYear, birthMonth),
        birthYear === String(currentYear) && Number(birthMonth) === currentMonth ? currentDay : 31,
      )
    : 31;
  const birthDate =
    birthYear && birthMonth && birthDay
      ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
      : '';
  const isStepFourValid = Boolean(birthDate);
  const isStepFiveValid = region.trim().length > 0;
  const isStepSixValid = email.trim().length > 0;
  const isStepSevenValid = selectedInterests.length > 0;
  const selectedAccountTypeLabel =
    accountTypes.find((item) => item.id === accountType)?.title || '일반 사용자';
  const selectedInterestLabels = interestCategories.filter((item) =>
    selectedInterests.includes(item.id),
  );

  function toggleInterest(interestId: string) {
    setStatusMessage('');
    setSelectedInterests((current) =>
      current.includes(interestId) ? current.filter((id) => id !== interestId) : [...current, interestId],
    );
  }

  function handleNext() {
    setStatusMessage('');

    if (step === 1 && !isStepOneValid) {
      setStatusMessage('계정 유형을 선택해 주세요.');
      return;
    }

    if (step === 2 && !isStepTwoValid) {
      setStatusMessage(
        isPasswordMismatch ? '비밀번호와 비밀번호 확인이 다릅니다.' : '회원 아이디와 비밀번호를 모두 입력해 주세요.',
      );
      return;
    }

    if (step === 3 && !isStepThreeValid) {
      setStatusMessage('이름을 입력해 주세요.');
      return;
    }

    if (step === 4 && !isStepFourValid) {
      setStatusMessage('생년월일을 모두 선택해 주세요.');
      return;
    }

    if (step === 5 && !isStepFiveValid) {
      setStatusMessage('지역을 선택해 주세요.');
      return;
    }

    if (step === 6 && !isStepSixValid) {
      setStatusMessage('이메일은 필수입니다.');
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length));
  }

  function handlePrevious() {
    setStatusMessage('');
    setStep((current) => Math.max(current - 1, 1));
  }

  function handleComplete() {
    if (!isStepSevenValid) {
      setStatusMessage('관심분야를 하나 이상 선택해 주세요.');
      return;
    }

    setStep(8);
    setStatusMessage('');
  }

  return (
    <main className="signupPage">
      <section className="signupShell" aria-labelledby="signup-title">
        <div className="signupCard">
          <div className="signupTopRow">
            <Link href="/login" className="signupBackLink">
              ← 로그인으로 돌아가기
            </Link>
            <span className="signupStepBadge">
              {step} / {steps.length}
            </span>
          </div>

          <p className="signupEyebrow">모이라 회원가입</p>
          <h1 id="signup-title" className="signupTitle">
            {step === 8 ? '환영합니다' : `${stepTitle}을 입력해 주세요`}
          </h1>

          <div className="signupProgressWrap" aria-label="진행률">
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
                    placeholder="모이라에서 사용할 아이디"
                  />
                </label>

                <label className="signupField" htmlFor="signup-password">
                  <span>비밀번호</span>
                  <input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="비밀번호를 입력하세요"
                  />
                </label>

                <label className="signupField signupFieldWide" htmlFor="signup-password-confirm">
                  <span>비밀번호 확인</span>
                  <input
                    id="signup-password-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value);
                      setStatusMessage('');
                    }}
                    placeholder="비밀번호를 다시 입력하세요"
                    aria-invalid={isPasswordMismatch}
                    aria-describedby={isPasswordMismatch ? 'signup-password-error' : undefined}
                  />
                  {isPasswordMismatch ? (
                    <small id="signup-password-error" className="signupFieldError" role="alert">
                      비밀번호와 비밀번호 확인이 다릅니다.
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
                  placeholder="이름을 입력하세요"
                />
              </label>
            ) : null}

            {step === 4 ? (
              <div className="signupFieldGrid">
                <label className="signupField" htmlFor="signup-gender">
                  <span>성별</span>
                  <select id="signup-gender" value={gender} onChange={(event) => setGender(event.target.value)}>
                    {genders.map((item) => (
                      <option key={item} value={item}>
                        {item}
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
                        } else if (
                          nextYear === String(currentYear) &&
                          Number(birthMonth) === currentMonth &&
                          Number(birthDay) > currentDay
                        ) {
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
                  <span>이메일 *</span>
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="example@domain.com"
                  />
                </label>

                <label className="signupField signupFieldWide" htmlFor="signup-phone">
                  <span>전화번호 (선택)</span>
                  <input
                    id="signup-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="010-0000-0000"
                  />
                </label>
              </div>
            ) : null}

            {step === 7 ? (
              <div className="signupInterestWrap">
                <div className="signupInterestHeader">
                  <span>관심분야</span>
                  <strong>{selectedInterests.length}개 선택</strong>
                </div>
                <div className="signupInterestGrid">
                  {interestCategories.map((item) => {
                    const isSelected = selectedInterests.includes(item.id);

                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`signupInterestButton ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleInterest(item.id)}
                        aria-pressed={isSelected}
                      >
                        <span>{item.title}</span>
                        <em>{isSelected ? '선택됨' : '선택하기'}</em>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 8 ? (
              <div className="signupWelcome">
                <p className="signupWelcomeEyebrow">환영합니다</p>
                <h2 className="signupWelcomeTitle">{name || '새로운 이용자'}님, 모이라 가입이 완료되었습니다.</h2>
                <p className="signupWelcomeText">
                  {selectedAccountTypeLabel} 계정으로 시작합니다. 선택한 관심분야는 추후 추천과 주민 참여 흐름에
                  활용됩니다.
                </p>

                <div className="signupWelcomeSummary">
                  <div>
                    <span>계정 유형</span>
                    <strong>{selectedAccountTypeLabel}</strong>
                  </div>
                  <div>
                    <span>아이디</span>
                    <strong>{userId || '미입력'}</strong>
                  </div>
                  <div>
                    <span>관심분야</span>
                    <strong>{selectedInterestLabels.length}개</strong>
                  </div>
                </div>

                <div className="signupWelcomeChips">
                  {selectedInterestLabels.map((item) => (
                    <span key={item.id}>{item.title}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {statusMessage ? (
            <p className="signupMessage" role="alert" aria-live="polite">
              {statusMessage}
            </p>
          ) : null}

          <div className="signupActions">
            <button type="button" className="signupGhostButton" onClick={handlePrevious} disabled={step === 1}>
              이전
            </button>

            {step < 7 ? (
              <button
                type="button"
                className="signupPrimaryButton"
                onClick={handleNext}
                disabled={
                  step === 1
                    ? !isStepOneValid
                    : step === 2
                      ? !isStepTwoValid
                      : step === 3
                        ? !isStepThreeValid
                        : step === 4
                          ? !isStepFourValid
                        : step === 5
                          ? !isStepFiveValid
                          : step === 6
                            ? !isStepSixValid
                            : false
                }
              >
                다음
              </button>
            ) : step === 7 ? (
              <button
                type="button"
                className="signupPrimaryButton"
                onClick={handleComplete}
                disabled={!isStepSevenValid}
              >
                완료
              </button>
            ) : (
              <Link href="/" className="signupPrimaryButton">
                시작하기
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
