'use client';

import { useMemo, useState } from 'react';

type Stage = '새로운 제안' | '함께 구체화' | '실행 준비' | '우리동네에서 진행';
type Card = { id: number; title: string; description: string; stage: Stage; tag: string; author: string; supporters: number; comments: number; accent: string };
const stages: { name: Stage; caption: string; icon: string }[] = [
  { name: '새로운 제안', caption: '가능성을 발견해요', icon: '✦' }, { name: '함께 구체화', caption: '의견을 모아 다듬어요', icon: '◌' }, { name: '실행 준비', caption: '역할과 일정을 정해요', icon: '✓' }, { name: '우리동네에서 진행', caption: '드디어 현실이 돼요', icon: '●' },
];
const seed: Card[] = [
  { id: 1, title: '세대공감 책 교환 피크닉', description: '서로에게 한 권을 추천하고 공원에서 함께 읽어요.', stage: '새로운 제안', tag: '책·배움', author: '민호', supporters: 24, comments: 8, accent: 'coral' },
  { id: 2, title: '우리동네 반려식물 병원', description: '식물 고민을 나누고 삽목도 교환하는 주말 진료소예요.', stage: '새로운 제안', tag: '생활', author: '연두', supporters: 18, comments: 5, accent: 'green' },
  { id: 3, title: '골목을 무대로, 작은 공연제', description: '빈 점포와 도서관 마당을 잇는 주민 공연을 만들어요.', stage: '함께 구체화', tag: '문화·예술', author: '소연', supporters: 46, comments: 21, accent: 'purple' },
  { id: 4, title: '어린이 동네 탐험 지도', description: '아이의 눈으로 안전하고 재미있는 장소를 기록해요.', stage: '함께 구체화', tag: '어린이', author: '하늘', supporters: 32, comments: 14, accent: 'yellow' },
  { id: 5, title: '제로웨이스트 수선 카페', description: '고쳐 쓰는 기술을 배우고 이웃의 물건도 함께 수선해요.', stage: '실행 준비', tag: '환경', author: '초록단추', supporters: 53, comments: 17, accent: 'blue' },
  { id: 6, title: '여름밤 옥상 영화관', description: '도서관 옥상에서 주민 투표로 고른 영화를 상영해요.', stage: '우리동네에서 진행', tag: '문화·예술', author: '도담도서관', supporters: 87, comments: 29, accent: 'navy' },
];

export default function IdeaKanbanBoard() {
  const [cards, setCards] = useState(seed); const [query, setQuery] = useState(''); const [menu, setMenu] = useState<number | null>(null);
  const shown = useMemo(() => cards.filter((card) => `${card.title} ${card.description} ${card.tag}`.includes(query)), [cards, query]);
  const move = (id: number, direction: -1 | 1) => setCards((items) => items.map((card) => { if (card.id !== id) return card; const index = stages.findIndex((stage) => stage.name === card.stage); return { ...card, stage: stages[Math.max(0, Math.min(stages.length - 1, index + direction))].name }; }));
  return <main className="kanbanPage">
    <header className="kanbanHero"><div><p>MOIRA IDEA LAB · KANBAN</p><h1>아이디어가 우리동네의<br />진짜 행사가 되는 과정</h1><span>시민의 제안부터 실행까지, 함께 한 칸씩 움직여요.</span></div><button type="button">＋ 아이디어 제안하기</button></header>
    <section className="kanbanOverview"><div><strong>18</strong><span>모인 아이디어</span></div><div><strong>146</strong><span>함께한 시민</span></div><div><strong>4</strong><span>곧 만날 행사</span></div><label><span aria-hidden="true">⌕</span><input aria-label="아이디어 검색" onChange={(event) => setQuery(event.target.value)} placeholder="아이디어 검색" value={query}/></label></section>
    <section className="kanbanBoard" aria-label="아이디어 진행 보드">{stages.map((stage, stageIndex) => { const stageCards = shown.filter((card) => card.stage === stage.name); return <section className={`kanbanColumn stage-${stageIndex + 1}`} key={stage.name} aria-labelledby={`stage-${stageIndex}`}><header><div><span>{stage.icon}</span><div><h2 id={`stage-${stageIndex}`}>{stage.name}</h2><p>{stage.caption}</p></div></div><strong>{stageCards.length}</strong></header><div className="kanbanCardList">{stageCards.map((card) => <article className={`kanbanCard accent-${card.accent}`} key={card.id}><div className="kanbanCardTop"><span>{card.tag}</span><button aria-label={`${card.title} 메뉴`} onClick={() => setMenu(menu === card.id ? null : card.id)} type="button">•••</button></div><h3>{card.title}</h3><p>{card.description}</p><div className="kanbanProgress" aria-label={`4단계 중 ${stageIndex + 1}단계`}><span style={{ width: `${(stageIndex + 1) * 25}%` }}/></div><footer><span className="kanbanAvatar">{card.author[0]}</span><span>{card.author}</span><div><span>♡ {card.supporters}</span><span>◌ {card.comments}</span></div></footer>{menu === card.id && <div className="kanbanMoveMenu"><strong>단계 이동</strong><button disabled={stageIndex === 0} onClick={() => { move(card.id, -1); setMenu(null); }} type="button">← 이전 단계</button><button disabled={stageIndex === stages.length - 1} onClick={() => { move(card.id, 1); setMenu(null); }} type="button">다음 단계 →</button></div>}</article>)}<button className="kanbanQuickAdd" type="button">＋ 이 단계에 아이디어 추가</button></div></section>; })}</section>
    <p className="kanbanMobileHint">옆으로 밀어 전체 진행 단계를 확인하세요 →</p>
  </main>;
}
