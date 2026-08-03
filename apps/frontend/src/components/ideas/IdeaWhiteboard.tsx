'use client';

import { useState } from 'react';

type Note = { id: number; text: string; author: string; color: string; rotation: number; tag: string; x: number; y: number; likes: number };
const initialNotes: Note[] = [
  { id: 1, text: '골목 곳곳을 작은 무대로 만드는 하루는 어때요?', author: '소연', color: 'yellow', rotation: -2, tag: '핵심 아이디어', x: 5, y: 8, likes: 18 },
  { id: 2, text: '도서관 마당에서 주민 밴드 공연을 열어요.', author: '민호', color: 'mint', rotation: 2, tag: '프로그램', x: 35, y: 4, likes: 12 },
  { id: 3, text: '아이들이 직접 만드는 골목 안내 지도가 있으면 좋겠어요!', author: '하늘', color: 'pink', rotation: 1, tag: '더해요', x: 66, y: 10, likes: 21 },
  { id: 4, text: '빈 점포 앞에 동네 사진과 오래된 이야기를 전시해요.', author: '유진', color: 'blue', rotation: -1, tag: '공간', x: 15, y: 51, likes: 9 },
  { id: 5, text: '공연 사이에 모두 함께 먹는 긴 테이블 저녁!', author: '정우', color: 'orange', rotation: 3, tag: '연결', x: 47, y: 48, likes: 26 },
  { id: 6, text: '소음과 이동이 불편한 주민을 위한 조용한 쉼터도 필요해요.', author: '다정', color: 'lavender', rotation: -2, tag: '살펴봐요', x: 73, y: 55, likes: 15 },
];

export default function IdeaWhiteboard() {
  const [notes, setNotes] = useState(initialNotes); const [filter, setFilter] = useState('전체'); const [zoom, setZoom] = useState(100); const [draft, setDraft] = useState(''); const [isWriting, setIsWriting] = useState(false);
  const visible = filter === '전체' ? notes : notes.filter((note) => note.tag === filter);
  const addNote = () => { if (!draft.trim()) return; setNotes((items) => [...items, { id: Date.now(), text: draft, author: '나', color: 'yellow', rotation: -1, tag: '더해요', x: 40, y: 30, likes: 0 }]); setDraft(''); setIsWriting(false); };
  return <main className="whiteboardPage">
    <header className="whiteboardHeader"><div><p>MOIRA IDEA LAB · WHITEBOARD</p><h1>우리동네 골목 공연제</h1><span>생각을 붙이고, 연결하고, 함께 키워보세요.</span></div><div className="whiteboardPeople"><span>소</span><span>민</span><span>하</span><span>유</span><strong>+12 함께 보는 중</strong></div></header>
    <nav className="whiteboardTools" aria-label="화이트보드 도구"><div className="whiteboardFilters">{['전체', '핵심 아이디어', '프로그램', '더해요', '살펴봐요'].map((item) => <button className={filter === item ? 'isActive' : ''} key={item} onClick={() => setFilter(item)} type="button">{item}</button>)}</div><div className="whiteboardActions"><button onClick={() => setZoom(Math.max(70, zoom - 10))} type="button">−</button><span>{zoom}%</span><button onClick={() => setZoom(Math.min(130, zoom + 10))} type="button">＋</button><button className="whiteboardAdd" onClick={() => setIsWriting(true)} type="button">＋ 포스트잇</button></div></nav>
    <section className="whiteboardCanvas" aria-label="아이디어 포스트잇 보드"><div className="whiteboardHint">빈 공간을 두 번 눌러 생각을 더해보세요</div><div className="whiteboardStage" style={{ transform: `scale(${zoom / 100})` }}><svg className="ideaConnections" aria-hidden="true" viewBox="0 0 1000 650" preserveAspectRatio="none"><path d="M210 150 C360 90 430 145 520 160"/><path d="M550 190 C660 210 730 190 805 175"/><path d="M250 460 C380 390 470 430 560 450"/><path d="M600 430 C700 390 750 450 840 470"/></svg>{visible.map((note) => <article className={`postitNote is-${note.color}`} key={note.id} style={{ left: `${note.x}%`, top: `${note.y}%`, transform: `rotate(${note.rotation}deg)` }}><span className="postitPin" aria-hidden="true"/><em>{note.tag}</em><p>{note.text}</p><footer><span>{note.author}</span><button onClick={() => setNotes((items) => items.map((item) => item.id === note.id ? { ...item, likes: item.likes + 1 } : item))} type="button">♡ {note.likes}</button></footer></article>)}</div></section>
    <button className="mobilePostitButton" onClick={() => setIsWriting(true)} type="button">＋ 생각 붙이기</button>
    {isWriting && <div className="postitModal" role="dialog" aria-modal="true" aria-labelledby="postit-title"><form onSubmit={(event) => { event.preventDefault(); addNote(); }}><button aria-label="닫기" className="postitClose" onClick={() => setIsWriting(false)} type="button">×</button><p>NEW POST-IT</p><h2 id="postit-title">어떤 생각을 붙일까요?</h2><textarea autoFocus maxLength={120} onChange={(event) => setDraft(event.target.value)} placeholder="짧고 자유롭게 적어주세요." value={draft}/><span>{draft.length}/120</span><button className="postitSubmit" disabled={!draft.trim()} type="submit">보드에 붙이기</button></form></div>}
  </main>;
}
