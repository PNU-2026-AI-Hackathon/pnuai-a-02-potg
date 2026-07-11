'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type Interest = {
  id: string;
  name: string;
};

type InterestMeta = {
  description: string;
  icon: string;
  tint: string;
};

const interestMeta: Record<string, InterestMeta> = {
  reading: {
    description: '독서 모임, 인문 강좌, 북큐레이션 정보를 받아보세요.',
    icon: 'R',
    tint: 'interestTintWarm',
  },
  children: {
    description: '어린이와 가족이 함께 참여할 수 있는 프로그램입니다.',
    icon: 'C',
    tint: 'interestTintSun',
  },
  youth: {
    description: '청소년 활동, 진로 탐색, 학습 지원 소식을 모읍니다.',
    icon: 'Y',
    tint: 'interestTintSky',
  },
  senior: {
    description: '노년층을 위한 문화, 복지, 디지털 지원 주제입니다.',
    icon: 'S',
    tint: 'interestTintMint',
  },
  'digital-education': {
    description: '디지털 교육, AI 활용, 기초 문해 프로그램을 다룹니다.',
    icon: 'D',
    tint: 'interestTintIndigo',
  },
  environment: {
    description: '환경, 생태, 지속가능한 지역 활동을 확인하세요.',
    icon: 'E',
    tint: 'interestTintMint',
  },
  'culture-art': {
    description: '전시, 공연, 예술 체험과 문화예술 강좌입니다.',
    icon: 'A',
    tint: 'interestTintRose',
  },
  career: {
    description: '진로 탐색, 취업 준비, 역량 개발 정보를 연결합니다.',
    icon: 'J',
    tint: 'interestTintViolet',
  },
  writing: {
    description: '글쓰기 수업, 기록 활동, 창작 모임을 찾아보세요.',
    icon: 'W',
    tint: 'interestTintGold',
  },
  'local-issues': {
    description: '지역문제, 주민 참여, 마을 의제 활동에 관심을 둡니다.',
    icon: 'L',
    tint: 'interestTintSky',
  },
};

const fallbackMeta: InterestMeta = {
  description: '관심 있는 도서관 프로그램과 지역 활동을 연결합니다.',
  icon: 'I',
  tint: 'interestTintSky',
};

export default function InterestsPage() {
  const router = useRouter();
  const [interests, setInterests] = useState<Interest[]>([]);
  const [selectedInterestIds, setSelectedInterestIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'idle' | 'error' | 'success'>('idle');

  const selectedCount = selectedInterestIds.length;
  const selectedLabel = useMemo(
    () =>
      interests
        .filter((interest) => selectedInterestIds.includes(interest.id))
        .map((interest) => interest.name)
        .join(', '),
    [interests, selectedInterestIds],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInterests() {
      setIsLoading(true);
      setMessage('');
      setMessageType('idle');

      try {
        const [interestResponse, userInterestResponse] = await Promise.all([
          fetch('/api/interests', { cache: 'no-store' }),
          fetch('/api/user-interests', { cache: 'no-store' }),
        ]);
        const interestData = await interestResponse.json();
        const userInterestData = await userInterestResponse.json();

        if (!isMounted) {
          return;
        }

        if (!interestResponse.ok) {
          setMessage(interestData?.error || '관심분야 목록을 불러오지 못했습니다.');
          setMessageType('error');
          return;
        }

        setInterests(Array.isArray(interestData?.interests) ? interestData.interests : []);

        if (userInterestResponse.ok && Array.isArray(userInterestData?.interests)) {
          setSelectedInterestIds(userInterestData.interests.map((interest: Interest) => interest.id));
        } else if (userInterestResponse.status === 401) {
          setMessage('로그인 후 관심분야를 저장할 수 있습니다.');
          setMessageType('error');
        }
      } catch (error) {
        console.error(error);
        if (isMounted) {
          setMessage('관심분야 정보를 불러오는 중 오류가 발생했습니다.');
          setMessageType('error');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadInterests();

    return () => {
      isMounted = false;
    };
  }, []);

  function toggleInterest(interestId: string) {
    setMessage('');
    setMessageType('idle');
    setSelectedInterestIds((current) =>
      current.includes(interestId) ? current.filter((id) => id !== interestId) : [...current, interestId],
    );
  }

  async function handleSave() {
    if (selectedInterestIds.length === 0) {
      setMessage('관심분야를 하나 이상 선택해 주세요.');
      setMessageType('error');
      return;
    }

    setIsSaving(true);
    setMessage('');
    setMessageType('idle');

    try {
      const response = await fetch('/api/user-interests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestIds: selectedInterestIds }),
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data?.error || '관심분야 저장에 실패했습니다.');
        setMessageType('error');
        return;
      }

      setMessage('관심분야가 저장되었습니다.');
      setMessageType('success');
      router.replace('/');
      router.refresh();
    } catch (error) {
      console.error(error);
      setMessage('서버와 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.');
      setMessageType('error');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="interestPage">
      <section className="interestShell" aria-labelledby="interest-title">
        <div className="interestCardShell">
          <div className="interestCardHead">
            <p className="interestEyebrow">관심분야 설정</p>
            <h1 id="interest-title">관심 있는 주제를 선택해 주세요</h1>
            <p className="interestLead">
              선택한 관심분야는 사용자별로 저장되며, 이후 프로그램 추천과 지역 활동 탐색에 활용됩니다.
            </p>
          </div>

          <div className="interestSelectionBar" aria-live="polite">
            <span>{selectedCount}개 선택</span>
            <span>{selectedLabel || '관심분야를 선택해 주세요'}</span>
          </div>

          {isLoading ? <p className="interestStatus">관심분야를 불러오는 중입니다.</p> : null}

          {!isLoading && interests.length > 0 ? (
            <div className="interestGrid">
              {interests.map((interest) => {
                const isSelected = selectedInterestIds.includes(interest.id);
                const meta = interestMeta[interest.id] || fallbackMeta;

                return (
                  <button
                    key={interest.id}
                    type="button"
                    className={`interestCard ${meta.tint} ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleInterest(interest.id)}
                    aria-pressed={isSelected}
                  >
                    <span className="interestIcon" aria-hidden="true">
                      {meta.icon}
                    </span>
                    <span className="interestTitle">{interest.name}</span>
                    <span className="interestDescription">{meta.description}</span>
                    <span className="interestState">{isSelected ? '선택됨' : '선택하기'}</span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {!isLoading && interests.length === 0 ? (
            <p className="interestStatus">등록된 관심분야가 없습니다. 먼저 seed 데이터를 확인해 주세요.</p>
          ) : null}

          {message ? (
            <p className={`interestMessage ${messageType}`} role="alert" aria-live="polite">
              {message}
            </p>
          ) : null}

          <div className="interestActionRow">
            <Link href="/" className="interestGhostButton">
              나중에 하기
            </Link>
            <button
              type="button"
              className="interestPrimaryButton"
              onClick={handleSave}
              disabled={isLoading || isSaving || selectedInterestIds.length === 0}
            >
              {isSaving ? '저장 중...' : '선택 완료'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
