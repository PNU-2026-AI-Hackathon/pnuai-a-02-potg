'use client';

import { useMemo, useState } from 'react';

type Topic = {
  id: number;
  title: string;
  body: string;
  author: string;
  role: string;
  category: string;
  votes: number;
  comments: number;
  time: string;
  status: string;
};

const topics: Topic[] = [
  { id: 1, title: '골목을 무대로 만드는 하루, 우리동네 작은 공연제', body: '빈 점포 앞과 작은도서관 마당을 연결해 주민이 직접 공연하고 관객이 되는 하루를 제안해요.', author: '소연', role: '장전동 주민', category: '문화·예술', votes: 128, comments: 24, time: '12분 전', status: '함께 다듬는 중' },
  { id: 2, title: '아이와 어른이 바꾸어 읽는 세대공감 책장', body: '서로에게 한 권을 추천하고 짧은 편지를 책갈피로 남기는 교환 행사는 어떨까요?', author: '책방지기 민호', role: '금정구 활동가', category: '책·배움', votes: 96, comments: 18, time: '1시간 전', status: '아이디어 모집' },
  { id: 3, title: '버려지는 천으로 만드는 동네 피크닉 매트', body: '재봉을 배우면서 공동 피크닉 물품도 만드는 자원순환 워크숍을 열고 싶습니다.', author: '초록단추', role: '부곡동 주민', category: '환경', votes: 74, comments: 11, time: '어제', status: '실행 검토' },
];

const replies = [
  { id: 1, author: '유진', role: '지역 예술가', time: '8분 전', body: '공연 사이 이동 동선에 작은 전시를 두면 골목 전체가 하나의 무대처럼 느껴질 것 같아요.', votes: 19, depth: 0 },
  { id: 2, author: '소연', role: '제안자', time: '5분 전', body: '좋아요! 주민 사진전을 함께 열 수 있도록 아이디어에 반영해 볼게요.', votes: 12, depth: 1 },
  { id: 3, author: '도담도서관', role: '공간 파트너', time: '2분 전', body: '도서관 마당은 오후 2시부터 사용할 수 있어요. 음향 규모만 같이 확인하면 좋겠습니다.', votes: 8, depth: 0 },
];

export default function IdeaThreadBoard() {
  const [sort, setSort] = useState<'인기순' | '최신순'>('인기순');
  const [selected, setSelected] = useState(1);
  const [liked, setLiked] = useState<number[]>([]);
  const [reply, setReply] = useState('');
  const ordered = useMemo(() => sort === '인기순' ? topics : [...topics].reverse(), [sort]);
  const active = topics.find((topic) => topic.id === selected) ?? topics[0];

  const toggleLike = (id: number) => setLiked((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);

  return (
    <main className="ideaThreadPage">
      <section className="ideaHero">
        <div>
          <p className="ideaEyebrow">MOIRA IDEA LAB · THREAD</p>
          <h1>같이 말할수록<br />아이디어는 선명해져요.</h1>
          <p>동네에 필요한 행사를 제안하고, 댓글로 가능성을 더해 함께 완성해 보세요.</p>
        </div>
        <button className="ideaPrimaryButton" type="button">+ 새 아이디어 제안</button>
      </section>

      <section className="threadStats" aria-label="아이디어 게시판 현황">
        <span><strong>32</strong> 열린 아이디어</span><span><strong>186</strong> 시민의 의견</span><span><strong>7</strong> 실행 준비 중</span>
      </section>

      <div className="threadWorkspace">
        <section className="threadFeed" aria-label="아이디어 목록">
          <div className="threadToolbar">
            <div className="threadTabs" role="tablist" aria-label="정렬 방식">
              {(['인기순', '최신순'] as const).map((item) => <button aria-selected={sort === item} className={sort === item ? 'isActive' : ''} key={item} onClick={() => setSort(item)} role="tab" type="button">{item}</button>)}
            </div>
            <button className="threadFilter" type="button">전체 주제⌄</button>
          </div>
          <div className="threadCards">
            {ordered.map((topic) => (
              <article className={`threadCard ${selected === topic.id ? 'isSelected' : ''}`} key={topic.id} onClick={() => setSelected(topic.id)}>
                <button aria-label={`${topic.title} 공감`} className={`voteBox ${liked.includes(topic.id) ? 'isLiked' : ''}`} onClick={(event) => { event.stopPropagation(); toggleLike(topic.id); }} type="button"><span>▲</span><strong>{topic.votes + (liked.includes(topic.id) ? 1 : 0)}</strong></button>
                <div className="threadCardBody">
                  <div className="threadCardFlags"><span>{topic.category}</span><em>{topic.status}</em></div>
                  <h2>{topic.title}</h2><p>{topic.body}</p>
                  <footer><span className="ideaAvatar">{topic.author[0]}</span><span><strong>{topic.author}</strong> · {topic.role}</span><span>💬 {topic.comments}</span><time>{topic.time}</time></footer>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="threadDetail" aria-label="선택한 아이디어 토론">
          <div className="threadDetailHeader"><span>{active.category}</span><button aria-label="닫기" type="button">×</button></div>
          <h2>{active.title}</h2><p>{active.body}</p>
          <div className="threadAuthor"><span className="ideaAvatar">{active.author[0]}</span><div><strong>{active.author}</strong><small>{active.role} · {active.time}</small></div></div>
          <div className="threadDiscussionTitle"><strong>대화 {active.comments}</strong><span>좋아요 순⌄</span></div>
          <div className="replyList">
            {replies.map((item) => <article className={item.depth ? 'isNested' : ''} key={item.id}><div><span className="ideaAvatar">{item.author[0]}</span><strong>{item.author}</strong><small>{item.role} · {item.time}</small></div><p>{item.body}</p><footer><button type="button">♡ {item.votes}</button><button type="button">답글 달기</button></footer></article>)}
          </div>
          <form className="replyComposer" onSubmit={(event) => { event.preventDefault(); setReply(''); }}><label htmlFor="thread-reply">의견 보태기</label><textarea id="thread-reply" onChange={(event) => setReply(event.target.value)} placeholder="아이디어가 더 좋아질 수 있는 생각을 나눠주세요." value={reply} /><button disabled={!reply.trim()} type="submit">댓글 남기기</button></form>
        </aside>
      </div>
    </main>
  );
}
