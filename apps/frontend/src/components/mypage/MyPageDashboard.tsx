'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '@/lib/auth-config';

type Profile = AuthUser & {
  userId: string | null;
  gender: 'FEMALE' | 'MALE' | 'OTHER' | null;
  birthDate: string | null;
  region: string | null;
  phone: string | null;
  interests: { id: string; name: string }[];
};

type Interest = { id: string; name: string };

type ActivityPost = {
  id: string;
  boardSlug: string;
  title: string;
  content: string;
  createdAt: string;
  tags: string[];
  commentCount: number;
  likeCount: number;
};

type ActivityComment = {
  id: string;
  content: string;
  createdAt: string;
  post: { id: string; boardSlug: string; title: string };
};

type Activity = {
  counts: { posts: number; comments: number; likes: number; saves: number };
  posts: ActivityPost[];
  comments: ActivityComment[];
  likedPosts: ActivityPost[];
  savedPosts: ActivityPost[];
};

const emptyActivity: Activity = {
  counts: { posts: 0, comments: 0, likes: 0, saves: 0 },
  posts: [], comments: [], likedPosts: [], savedPosts: [],
};

const dateFormatter = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' });

function postHref(postId: string) {
  return `/board/${encodeURIComponent(postId)}`;
}

async function fetchDashboardData() {
  const [profileResponse, activityResponse, interestsResponse] = await Promise.all([
    fetch('/api/me/profile', { cache: 'no-store' }),
    fetch('/api/me/activity', { cache: 'no-store' }),
    fetch('/api/interests', { cache: 'no-store' }),
  ]);
  const profileData = await profileResponse.json();
  const activityData = await activityResponse.json();
  const interestsData = await interestsResponse.json();
  if (!profileResponse.ok) throw new Error(profileData.error || '계정 정보를 불러오지 못했습니다.');
  if (!activityResponse.ok) throw new Error(activityData.error || '활동 내역을 불러오지 못했습니다.');
  if (!interestsResponse.ok) throw new Error(interestsData.error || '관심분야를 불러오지 못했습니다.');
  return { profile: profileData.profile as Profile, activity: activityData.activity as Activity, interests: interestsData.interests as Interest[] };
}

export default function MyPageDashboard({ initialUser }: { initialUser: AuthUser }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activity, setActivity] = useState<Activity>(emptyActivity);
  const [availableInterests, setAvailableInterests] = useState<Interest[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      const data = await fetchDashboardData();
      setProfile(data.profile);
      setActivity(data.activity);
      setAvailableInterests(data.interests);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '마이페이지를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData()
      .then((data) => { setProfile(data.profile); setActivity(data.activity); setAvailableInterests(data.interests); })
      .catch((error) => setMessage(error instanceof Error ? error.message : '마이페이지를 불러오지 못했습니다.'))
      .finally(() => setIsLoading(false));
  }, []);

  async function removeActivity(postId: string, kind: 'like' | 'save') {
    const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/${kind}`, { method: 'DELETE' });
    if (response.ok) await loadDashboard();
    else setMessage((await response.json()).error || '활동을 변경하지 못했습니다.');
  }

  const displayName = profile?.name ?? initialUser.name;

  return (
    <main className="mypageMain">
      <section className="mypageIntro">
        <div className="uiContainer">
          <nav className="mypageBreadcrumb" aria-label="현재 위치"><Link href="/">홈</Link><span>/</span><strong>마이페이지</strong></nav>
          <div className="mypageWelcome"><div><p className="uiEyebrow">MY MOIRA</p><h1>{displayName}님, 반가워요!</h1><p>계정 정보와 커뮤니티 활동을 한곳에서 관리하세요.</p></div></div>
          <div className="mypageProfileCard">
            <div className="mypageIdentity"><div className="mypageAvatar" aria-hidden="true">{displayName.slice(0, 1)}</div><div><strong>{displayName}</strong><p>{profile?.region ?? '지역 미설정'} · {profile?.email ?? initialUser.email}</p><div className="mypageInterestTags">{profile?.interests.map((interest) => <span key={interest.id}>{interest.name}</span>)}</div></div></div>
            <dl className="mypageStats">
              <div><dt>작성글</dt><dd>{activity.counts.posts}</dd></div><div><dt>댓글</dt><dd>{activity.counts.comments}</dd></div><div><dt>관심글</dt><dd>{activity.counts.saves}</dd></div><div><dt>좋아요</dt><dd>{activity.counts.likes}</dd></div>
            </dl>
            <button className="uiButton uiButtonSecondary mypageEditButton" type="button" onClick={() => setIsEditing((value) => !value)}>내 정보 관리</button>
          </div>
          {isEditing && profile ? <ProfileForm profile={profile} availableInterests={availableInterests} onSaved={(next) => { setProfile(next); setIsEditing(false); }} /> : null}
        </div>
      </section>

      <div className="uiContainer mypageContent">
        {message ? <p className="mypageDataMessage" role="alert">{message}</p> : null}
        {isLoading ? <p className="mypageDataMessage" role="status">활동 내역을 불러오는 중입니다.</p> : null}
        {!isLoading ? <div className="mypageActivityGrid">
          <PostSection title="내가 작성한 글" eyebrow="MY POSTS" icon="✎" items={activity.posts} empty="작성한 글이 없습니다." />
          <CommentSection items={activity.comments} />
          <PostSection title="관심글" eyebrow="BOOKMARKS" icon="☆" items={activity.savedPosts} empty="관심글이 없습니다." actionLabel="관심 해제" onAction={(id) => removeActivity(id, 'save')} />
          <PostSection title="좋아요 표시글" eyebrow="LIKES" icon="♥" items={activity.likedPosts} empty="좋아요 표시한 글이 없습니다." actionLabel="좋아요 취소" onAction={(id) => removeActivity(id, 'like')} />
        </div> : null}
      </div>
    </main>
  );
}

function PostSection({ title, eyebrow, icon, items, empty, actionLabel, onAction }: { title: string; eyebrow: string; icon: string; items: ActivityPost[]; empty: string; actionLabel?: string; onAction?: (id: string) => void }) {
  return <section className="mypageActivityCard"><div className="mypageSectionHeading"><span className="mypageSectionIcon" aria-hidden="true">{icon}</span><div><p className="uiEyebrow">{eyebrow}</p><h2>{title}</h2></div></div><div className="mypagePostList">{items.length ? items.map((post) => <article className="mypagePostItem" key={post.id}><span className="uiTag">{post.boardSlug}</span><div className="mypagePostCopy"><Link href={postHref(post.id)}><h3>{post.title}</h3></Link><p>{post.content}</p><div className="mypagePostMeta"><span>{dateFormatter.format(new Date(post.createdAt))}</span><span>댓글 {post.commentCount} · 좋아요 {post.likeCount}</span></div></div>{onAction && actionLabel ? <button className="mypageInlineAction" type="button" onClick={() => onAction(post.id)}>{actionLabel}</button> : <span className="mypageRowArrow">›</span>}</article>) : <p className="mypageEmptyState">{empty}</p>}</div></section>;
}

function CommentSection({ items }: { items: ActivityComment[] }) {
  return <section className="mypageActivityCard"><div className="mypageSectionHeading"><span className="mypageSectionIcon" aria-hidden="true">💬</span><div><p className="uiEyebrow">MY COMMENTS</p><h2>내가 작성한 댓글</h2></div></div><div className="mypagePostList">{items.length ? items.map((comment) => <article className="mypagePostItem" key={comment.id}><span className="uiTag">댓글</span><div className="mypagePostCopy"><Link href={postHref(comment.post.id)}><h3>{comment.post.title}</h3></Link><p>{comment.content}</p><div className="mypagePostMeta"><span>{dateFormatter.format(new Date(comment.createdAt))}</span></div></div><span className="mypageRowArrow">›</span></article>) : <p className="mypageEmptyState">작성한 댓글이 없습니다.</p>}</div></section>;
}

function ProfileForm({ profile, availableInterests, onSaved }: { profile: Profile; availableInterests: Interest[]; onSaved: (profile: Profile) => void }) {
  const [form, setForm] = useState({ name: profile.name, region: profile.region ?? '', phone: profile.phone ?? '', birthDate: profile.birthDate ?? '', gender: profile.gender ?? '' });
  const [selectedInterestIds, setSelectedInterestIds] = useState(profile.interests.map((interest) => interest.id));
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (selectedInterestIds.length === 0) return setMessage('관심분야를 하나 이상 선택해 주세요.');
    const [profileResponse, interestsResponse] = await Promise.all([
      fetch('/api/me/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, region: form.region || null, phone: form.phone || null, birthDate: form.birthDate || null, gender: form.gender || null }) }),
      fetch('/api/user-interests', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interestIds: selectedInterestIds }) }),
    ]);
    const profileData = await profileResponse.json();
    const interestsData = await interestsResponse.json();
    if (!profileResponse.ok) return setMessage(profileData.error || '계정 정보를 수정하지 못했습니다.');
    if (!interestsResponse.ok) return setMessage(interestsData.error || '관심분야를 수정하지 못했습니다.');
    onSaved({ ...profileData.profile, interests: interestsData.interests });
  }
  function toggleInterest(id: string) { setSelectedInterestIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  return <form className="mypageProfileForm" onSubmit={submit}><label><span>이름</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label><span>지역</span><input value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></label><label><span>전화번호</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label><span>생년월일</span><input type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label><label><span>성별</span><select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="">선택 안 함</option><option value="FEMALE">여성</option><option value="MALE">남성</option><option value="OTHER">기타</option></select></label><fieldset className="mypageInterestPicker"><legend>관심분야</legend><div>{availableInterests.map((interest) => { const selected = selectedInterestIds.includes(interest.id); return <button className={selected ? 'isSelected' : ''} key={interest.id} type="button" aria-pressed={selected} onClick={() => toggleInterest(interest.id)}>{interest.name}<span>{selected ? '✓' : '+'}</span></button>; })}</div><small>하나 이상 선택해 주세요.</small></fieldset>{message ? <p role="alert">{message}</p> : null}<button className="uiButton uiButtonPrimary" type="submit">저장</button></form>;
}
