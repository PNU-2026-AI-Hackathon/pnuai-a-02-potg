'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type InterestCategory = {
  id: string;
  title: string;
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

const steps = ['이름', '기본 정보', '지역', '연락처', '관심분야'] as const;
const regions = ['금정구', '부산진구', '동래구', '해운대구', '북구', '남구'];
const genders = ['선택 안 함', '여성', '남성', '기타'];

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('선택 안 함');
  const [birthDate, setBirthDate] = useState('');
  const [region, setRegion] = useState('금정구');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('');

  const progress = Math.round((step / steps.length) * 100);
  const stepTitle = useMemo(() => steps[step - 1], [step]);

  const isStepOneValid = name.trim().length > 0;
  const isStepThreeValid = region.trim().length > 0;
  const isStepFourValid = email.trim().length > 0;
  const isStepFiveValid = selectedInterests.length > 0;

  function toggleInterest(interestId: string) {
    setStatusMessage('');
    setSelectedInterests((current) =>
      current.includes(interestId) ? current.filter((id) => id !== interestId) : [...current, interestId],
    );
  }

  function handleNext() {
    setStatusMessage('');

    if (step === 1 && !isStepOneValid) {
      setStatusMessage('이름을 입력해 주세요.');
      return;
    }

    if (step === 3 && !isStepThreeValid) {
      setStatusMessage('지역을 선택해 주세요.');
      return;
    }

    if (step === 4 && !isStepFourValid) {
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
    if (!isStepFiveValid) {
      setStatusMessage('관심분야를 하나 이상 선택해 주세요.');
      return;
    }

    setStatusMessage('회원가입과 관심분야 선택을 합친 화면 스켈레톤입니다. 실제 저장은 연결하지 않았습니다.');
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
            {step === 5 ? '관심분야까지 선택해 주세요' : `${stepTitle}을 입력해 주세요`}
          </h1>
          <p className="signupDescription">
            회원가입과 관심분야 선택을 하나의 흐름으로 묶은 화면입니다. 입력한 내용은 화면에서만
            상태로 관리하는 스켈레톤입니다.
          </p>

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

            {step === 2 ? (
              <div className="signupFieldGrid">
                <label className="signupField" htmlFor="signup-age">
                  <span>나이</span>
                  <input
                    id="signup-age"
                    type="number"
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    placeholder="선택"
                  />
                </label>

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

                <label className="signupField signupFieldWide" htmlFor="signup-birthdate">
                  <span>생년월일</span>
                  <input
                    id="signup-birthdate"
                    type="date"
                    value={birthDate}
                    onChange={(event) => setBirthDate(event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            {step === 3 ? (
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

            {step === 4 ? (
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

            {step === 5 ? (
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

            {step < steps.length ? (
              <button
                type="button"
                className="signupPrimaryButton"
                onClick={handleNext}
                disabled={step === 1 ? !isStepOneValid : step === 3 ? !isStepThreeValid : step === 4 ? !isStepFourValid : false}
              >
                다음
              </button>
            ) : (
              <button type="button" className="signupPrimaryButton" onClick={handleComplete} disabled={!isStepFiveValid}>
                가입 완료
              </button>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
