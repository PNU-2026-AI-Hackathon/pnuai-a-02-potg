import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '함께 만드는 행사 | 모이라',
  description: '모이라 아이디어 게시판의 세 가지 UI를 비교합니다.',
};

export default function IdeasPage() {
  return (
    <main className="ideaConceptPage">
      <section className="ideaConceptHero">
        <p>MOIRA IDEA LAB</p>
        <h1>함께 만드는 방식도<br />함께 골라요.</h1>
        <span>같은 아이디어를 세 가지 협업 방식으로 경험하고, 우리 동네에 가장 잘 맞는 게시판을 살펴보세요.</span>
      </section>
      <section className="ideaConceptGrid" aria-label="아이디어 게시판 UI 선택">
        <Link className="ideaConceptCard isThread" href="/community/ideas/thread">
          <div className="ideaConceptPreview"><span>▲ 128</span><i/><i/><i/></div>
          <p>01 · 대화 중심</p><h2>Thread / Reddit</h2><span>제안에 의견을 보태고, 답글을 이어가며 아이디어를 깊게 발전시켜요.</span><strong>스레드로 둘러보기 →</strong>
        </Link>
        <Link className="ideaConceptCard isWhiteboard" href="/community/ideas/whiteboard">
          <div className="ideaConceptPreview"><i/><i/><i/><i/></div>
          <p>02 · 발산 중심</p><h2>Whiteboard / Post-it</h2><span>떠오르는 생각을 자유롭게 붙이고 연결하며 가능성을 넓혀요.</span><strong>화이트보드로 둘러보기 →</strong>
        </Link>
        <Link className="ideaConceptCard isKanban" href="/community/ideas/kanban">
          <div className="ideaConceptPreview"><i/><i/><i/><i/><i/><i/></div>
          <p>03 · 실행 중심</p><h2>Kanban Board</h2><span>아이디어가 제안에서 실행까지 나아가는 과정을 한눈에 살펴봐요.</span><strong>칸반으로 둘러보기 →</strong>
        </Link>
      </section>
    </main>
  );
}
