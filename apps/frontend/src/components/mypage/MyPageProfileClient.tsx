'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import type {
  AccountType,
  Gender,
  Interest,
  UpdateUserProfileRequest,
  UserProfile,
} from '@/lib/auth-config';

type ProfileForm = {
  name: string;
  gender: Gender | '';
  birthDate: string;
  region: string;
  phone: string;
};

const accountTypeLabels: Record<AccountType, string> = {
  RESIDENT: '주민',
  LIBRARIAN: '사서',
  ADMIN: '관리자',
};

const genderLabels: Record<Gender, string> = {
  FEMALE: '여성',
  MALE: '남성',
  OTHER: '기타',
};

function createProfileForm(profile: UserProfile): ProfileForm {
  return {
    name: profile.name,
    gender: profile.gender ?? '',
    birthDate: profile.birthDate ?? '',
    region: profile.region ?? '',
    phone: profile.phone ?? '',
  };
}

function haveSameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id) => right.includes(id));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function validateProfileForm(form: ProfileForm) {
  const errors: Partial<Record<keyof ProfileForm, string>> = {};
  const name = form.name.trim();
  const region = form.region.trim();
  const normalizedPhone = form.phone.trim().replace(/[-\s]/g, '');

  if (!name || name.length > 50) errors.name = '이름은 1~50자로 입력해 주세요.';
  if (region.length > 100 || /[\u0000-\u001f\u007f]/.test(region)) {
    errors.region = '지역은 제어 문자 없이 100자 이내로 입력해 주세요.';
  }
  if (normalizedPhone && !/^\d{8,15}$/.test(normalizedPhone)) {
    errors.phone = '전화번호는 숫자 8~15자리로 입력해 주세요.';
  }
  if (form.birthDate) {
    const parsed = new Date(`${form.birthDate}T00:00:00.000Z`);
    const today = new Date().toISOString().slice(0, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== form.birthDate ||
      form.birthDate > today
    ) {
      errors.birthDate = '올바른 과거 생년월일을 선택해 주세요.';
    }
  }

  return errors;
}

export default function MyPageProfileClient({
  initialProfile,
  availableInterests,
  initialInterests,
  interestsAvailable,
}: {
  initialProfile: UserProfile;
  availableInterests: Interest[];
  initialInterests: Interest[];
  interestsAvailable: boolean;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [form, setForm] = useState(() => createProfileForm(initialProfile));
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileErrors, setProfileErrors] = useState<Partial<Record<keyof ProfileForm, string>>>({});
  const [selectedInterestIds, setSelectedInterestIds] = useState(() =>
    initialInterests.map((interest) => interest.id),
  );
  const [savedInterestIds, setSavedInterestIds] = useState(() =>
    initialInterests.map((interest) => interest.id),
  );
  const [isSavingInterests, setIsSavingInterests] = useState(false);
  const [interestMessage, setInterestMessage] = useState('');

  const selectedInterests = availableInterests.filter((interest) =>
    savedInterestIds.includes(interest.id),
  );

  function cancelEditing() {
    setForm(createProfileForm(profile));
    setProfileErrors({});
    setProfileMessage('');
    setIsEditing(false);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateProfileForm(form);
    setProfileErrors(errors);
    setProfileMessage('');
    if (Object.keys(errors).length > 0) return;

    const request: UpdateUserProfileRequest = {
      name: form.name.trim(),
      gender: form.gender || null,
      birthDate: form.birthDate || null,
      region: form.region.trim() || null,
      phone: form.phone.trim() || null,
    };

    setIsSaving(true);
    try {
      const response = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const data = (await response.json()) as { profile?: UserProfile; error?: string };
      if (!response.ok || !data.profile) throw new Error(data.error || '프로필을 저장하지 못했습니다.');

      setProfile(data.profile);
      setForm(createProfileForm(data.profile));
      setProfileMessage('프로필을 저장했습니다.');
      setIsEditing(false);
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : '프로필을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  function toggleInterest(interestId: string) {
    setInterestMessage('');
    setSelectedInterestIds((current) =>
      current.includes(interestId)
        ? current.filter((id) => id !== interestId)
        : [...current, interestId],
    );
  }

  async function saveInterests() {
    setIsSavingInterests(true);
    setInterestMessage('');
    try {
      const response = await fetch('/api/user-interests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestIds: selectedInterestIds }),
      });
      const data = (await response.json()) as { interests?: Interest[]; error?: string };
      if (!response.ok || !data.interests) throw new Error(data.error || '관심 분야를 저장하지 못했습니다.');

      const savedIds = data.interests.map((interest) => interest.id);
      setSelectedInterestIds(savedIds);
      setSavedInterestIds(savedIds);
      setInterestMessage('관심 분야를 저장했습니다.');
    } catch (error) {
      setInterestMessage(error instanceof Error ? error.message : '관심 분야를 저장하지 못했습니다.');
    } finally {
      setIsSavingInterests(false);
    }
  }

  return (
    <>
      <section className="mypageIntro">
        <div className="uiContainer">
          <nav className="mypageBreadcrumb" aria-label="현재 위치">
            <Link href="/">홈</Link>
            <span aria-hidden="true">/</span>
            <strong>마이페이지</strong>
          </nav>

          <div className="mypageWelcome">
            <div>
              <p className="uiEyebrow">MY MOIRA</p>
              <h1>{profile.name}님, 반가워요!</h1>
              <p>계정 정보와 관심 분야를 안전하게 관리할 수 있어요.</p>
            </div>
          </div>

          <div className="mypageProfileCard mypageProfileCardLive">
            <div className="mypageIdentity">
              <div className="mypageAvatar" aria-hidden="true">{profile.name.slice(0, 1)}</div>
              <div>
                <strong>{profile.name}</strong>
                <p>{profile.region || '지역 미설정'} · {accountTypeLabels[profile.accountType]}</p>
                <div className="mypageInterestTags" aria-label="나의 관심 분야">
                  {selectedInterests.length > 0
                    ? selectedInterests.map((interest) => <span key={interest.id}>{interest.name}</span>)
                    : <span>관심 분야 미설정</span>}
                </div>
              </div>
            </div>
            <dl className="mypageProfileSummary">
              <div><dt>사용자 ID</dt><dd>{profile.userId || '미설정'}</dd></div>
              <div><dt>이메일</dt><dd>{profile.email}</dd></div>
              <div><dt>가입일</dt><dd>{formatDate(profile.createdAt)}</dd></div>
            </dl>
            <button
              className="uiButton uiButtonSecondary mypageEditButton"
              type="button"
              onClick={() => { setProfileMessage(''); setIsEditing(true); }}
              disabled={isEditing}
            >
              내 정보 관리
            </button>
          </div>
        </div>
      </section>

      <div className="uiContainer mypageContent mypageAccountContent">
        <section className="mypageAccountCard" aria-labelledby="mypage-profile-title">
          <div className="mypageAccountHeading">
            <div>
              <p className="uiEyebrow">PROFILE</p>
              <h2 id="mypage-profile-title">계정 및 프로필 정보</h2>
              <p>로그인 정보는 읽기 전용이며 기본 프로필만 수정할 수 있습니다.</p>
            </div>
          </div>

          {isEditing ? (
            <form className="mypageProfileForm" onSubmit={saveProfile} noValidate>
              <label><span>이름</span><input value={form.name} maxLength={50} onChange={(event) => setForm({ ...form, name: event.target.value })} />{profileErrors.name ? <small>{profileErrors.name}</small> : null}</label>
              <label><span>성별</span><select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as Gender | '' })}><option value="">미설정</option><option value="FEMALE">여성</option><option value="MALE">남성</option><option value="OTHER">기타</option></select>{profileErrors.gender ? <small>{profileErrors.gender}</small> : null}</label>
              <label><span>생년월일</span><input type="date" value={form.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} />{profileErrors.birthDate ? <small>{profileErrors.birthDate}</small> : null}</label>
              <label><span>지역</span><input value={form.region} maxLength={100} placeholder="예: 부산광역시 금정구" onChange={(event) => setForm({ ...form, region: event.target.value })} />{profileErrors.region ? <small>{profileErrors.region}</small> : null}</label>
              <label><span>전화번호</span><input inputMode="tel" value={form.phone} placeholder="예: 010-1234-5678" onChange={(event) => setForm({ ...form, phone: event.target.value })} />{profileErrors.phone ? <small>{profileErrors.phone}</small> : null}</label>
              <div className="mypageFormActions">
                <button className="uiButton uiButtonSecondary" type="button" onClick={cancelEditing} disabled={isSaving}>취소</button>
                <button className="uiButton uiButtonPrimary" type="submit" disabled={isSaving}>{isSaving ? '저장 중...' : '저장'}</button>
              </div>
            </form>
          ) : (
            <dl className="mypageDetails">
              <div><dt>이름</dt><dd>{profile.name}</dd></div>
              <div><dt>사용자 ID</dt><dd>{profile.userId || '미설정'}</dd></div>
              <div><dt>이메일</dt><dd>{profile.email}</dd></div>
              <div><dt>계정 유형</dt><dd>{accountTypeLabels[profile.accountType]}</dd></div>
              <div><dt>성별</dt><dd>{profile.gender ? genderLabels[profile.gender] : '미설정'}</dd></div>
              <div><dt>생년월일</dt><dd>{profile.birthDate ? formatDate(profile.birthDate) : '미설정'}</dd></div>
              <div><dt>지역</dt><dd>{profile.region || '미설정'}</dd></div>
              <div><dt>전화번호</dt><dd>{profile.phone || '미설정'}</dd></div>
              <div><dt>가입일</dt><dd>{formatDate(profile.createdAt)}</dd></div>
            </dl>
          )}
          {profileMessage ? <p className="mypageStatusMessage" role="status">{profileMessage}</p> : null}
        </section>

        <section className="mypageAccountCard" aria-labelledby="mypage-interests-title">
          <div className="mypageAccountHeading">
            <div>
              <p className="uiEyebrow">INTERESTS</p>
              <h2 id="mypage-interests-title">관심 분야</h2>
              <p>관심 있는 분야를 선택하면 이후 맞춤 서비스에 활용됩니다.</p>
            </div>
          </div>
          {!interestsAvailable ? (
            <p className="mypageEmptyState" role="alert">관심 분야 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
          ) : (
            <>
              <div className="mypageInterestOptions">
                {availableInterests.map((interest) => (
                  <label key={interest.id} className={selectedInterestIds.includes(interest.id) ? 'selected' : undefined}>
                    <input type="checkbox" checked={selectedInterestIds.includes(interest.id)} onChange={() => toggleInterest(interest.id)} />
                    <span>{interest.name}</span>
                  </label>
                ))}
              </div>
              <div className="mypageInterestActions">
                <p>선택하지 않고 저장하면 모든 관심 분야가 해제됩니다.</p>
                <button className="uiButton uiButtonPrimary" type="button" onClick={saveInterests} disabled={isSavingInterests || haveSameIds(selectedInterestIds, savedInterestIds)}>{isSavingInterests ? '저장 중...' : '관심 분야 저장'}</button>
              </div>
            </>
          )}
          {interestMessage ? <p className="mypageStatusMessage" role="status">{interestMessage}</p> : null}
        </section>

        <section className="mypageComingSoon" aria-labelledby="mypage-coming-soon-title">
          <p className="uiEyebrow">COMING SOON</p>
          <h2 id="mypage-coming-soon-title">나의 활동 기능을 준비하고 있어요</h2>
          <p>작성글, 댓글, 북마크, 좋아요와 맞춤 행사 기능은 추후 제공될 예정입니다.</p>
        </section>
      </div>
    </>
  );
}
