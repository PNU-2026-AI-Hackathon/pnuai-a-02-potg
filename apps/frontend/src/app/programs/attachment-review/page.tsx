import type { Metadata } from 'next';
import Link from 'next/link';
import { getProgramAttachmentReviews } from '@/lib/program-attachment-review';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '첨부 정제 검수 | 모이라' };

export default async function ProgramAttachmentReviewPage() {
  const reviews = await getProgramAttachmentReviews();
  const sessions = reviews.reduce((sum, item) => sum + item.curriculum.length, 0);
  const duplicates = reviews.reduce((sum, item) => sum + item.audit.skippedDuplicates.length, 0);
  const noise = reviews.reduce((sum, item) => sum + item.audit.discardedNoise.length, 0);
  return (
    <main className="programPage attachmentReviewPage">
      <section className="uiContainer programShell">
        <nav className="communityBreadcrumb" aria-label="현재 위치"><Link href="/">홈</Link><span>/</span><Link href="/programs">프로그램 게시판</Link><span>/</span><span>첨부 정제 검수</span></nav>
        <header className="communityBoardHeader programBoardHeader">
          <div><p className="uiEyebrow communityEyebrow">Attachment Review</p><h1>첨부 정제 대표 10건 검수</h1><p>원문과 첨부 선택 결과, 최종 게시판 데이터를 비교해 주세요.</p></div>
        </header>
        <section className="programSummary attachmentReviewSummary" aria-label="검수 현황">
          <div><strong>{reviews.length}</strong><span>검수 프로그램</span></div>
          <div><strong>{sessions}</strong><span>구조화 회차</span></div>
          <div><strong>{duplicates}</strong><span>제거한 중복</span></div>
          <div><strong>{noise}</strong><span>폐기한 잡음</span></div>
          <p>이 화면의 ‘자동 검토 후보’는 게시 승인 완료가 아니라 사람이 원본과 비교할 준비가 됐다는 뜻입니다.</p>
        </section>
        <div className="attachmentReviewList">
          {reviews.map((review) => (
            <article className="attachmentReviewCard" key={review.sourceId}>
              <div className="programCardFlags"><span>{review.attachment.detectedType}</span><span className="is-normalized">자동 검토 후보</span></div>
              <h2><Link href={`/programs/attachment-review/${review.sourceId}`}>{review.title}</Link></h2>
              <p>{review.attachment.name}</p>
              <dl>
                <div><dt>선택 페이지</dt><dd>{review.selectedPages.length ? review.selectedPages.join(', ') : '전체 문서'}</dd></div>
                <div><dt>일치 신뢰도</dt><dd>{Math.round(review.confidence * 100)}%</dd></div>
                <div><dt>구조화 회차</dt><dd>{review.curriculum.length}개</dd></div>
                <div><dt>추가 / 중복 제거</dt><dd>{review.audit.added.length} / {review.audit.skippedDuplicates.length}</dd></div>
              </dl>
              <Link className="programCardLink" href={`/programs/attachment-review/${review.sourceId}`}>비교 검수하기 <span>→</span></Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
