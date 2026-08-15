import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getProgramAttachmentReviews,
  REVIEW_STATUS_LABEL,
  type ProgramAttachmentReview,
  type ReviewStatus,
} from '@/lib/program-attachment-review';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '첨부 정제 검수 | 모이라' };

/** 사람이 실제로 손대야 하는 순서. 기본 화면은 첫 번째 상태만 보여준다. */
const STATUS_ORDER: ReviewStatus[] = [
  'MANUAL_REVIEW_REQUIRED',
  'EXTRACTION_FAILED',
  'AUTO_REVIEW_CANDIDATE',
  'SINGLE_SESSION_EVENT',
  'OCR_REQUIRED',
  'OCR_BUDGET_EXCEEDED',
];

const STATUS_HINT: Record<ReviewStatus, string> = {
  MANUAL_REVIEW_REQUIRED: '값이 충돌하거나 회차를 읽지 못했습니다. 원본과 대조해 판단해 주세요.',
  EXTRACTION_FAILED: '다운로드나 형식 판별에 실패했습니다.',
  AUTO_REVIEW_CANDIDATE: '규칙이 명확히 적용됐습니다. 게시 승인이 아니라 대조 가능한 상태라는 뜻입니다.',
  SINGLE_SESSION_EVENT: '하루로 끝나는 행사라 회차가 없는 것이 정상입니다.',
  OCR_REQUIRED: 'OCR 실행 대기 중입니다. 본문이 있는 레코드는 본문만으로 먼저 게시할 수 있습니다.',
  OCR_BUDGET_EXCEEDED: 'OCR 호출 상한에 걸려 이번 배치에서 처리하지 못했습니다. 상한을 올리면 다시 대상이 됩니다.',
};

function statusClass(status: ReviewStatus) {
  if (status === 'MANUAL_REVIEW_REQUIRED' || status === 'EXTRACTION_FAILED') return 'is-needs_review';
  if (status === 'OCR_REQUIRED') return 'is-pending';
  return 'is-normalized';
}

function reasonsOf(review: ProgramAttachmentReview) {
  return [...new Set([
    ...review.audit.warnings.map((warning) => warning.code),
    ...review.extractionWarnings.map((warning) => warning.code),
  ])];
}

export default async function ProgramAttachmentReviewPage(
  { searchParams }: { searchParams: Promise<{ status?: string }> },
) {
  const reviews = await getProgramAttachmentReviews();
  const requested = (await searchParams).status as ReviewStatus | undefined;
  const active: ReviewStatus = STATUS_ORDER.includes(requested as ReviewStatus)
    ? requested as ReviewStatus
    : 'MANUAL_REVIEW_REQUIRED';

  const countOf = (status: ReviewStatus) => reviews.filter((item) => item.reviewStatus === status).length;
  const visible = reviews.filter((item) => item.reviewStatus === active);
  const sessions = reviews.reduce((sum, item) => sum + item.curriculum.length, 0);
  const publishable = reviews.filter((item) => item.bodyPublishable).length;

  return (
    <main className="programPage attachmentReviewPage">
      <section className="uiContainer programShell">
        <nav className="communityBreadcrumb" aria-label="현재 위치"><Link href="/">홈</Link><span>/</span><Link href="/programs">프로그램 게시판</Link><span>/</span><span>첨부 정제 검수</span></nav>
        <header className="communityBoardHeader programBoardHeader">
          <div>
            <p className="uiEyebrow communityEyebrow">Attachment Review</p>
            <h1>첨부 정제 검수 · 전체 {reviews.length}건</h1>
            <p>원문과 첨부 선택 결과, 최종 게시판 데이터를 비교해 주세요.</p>
          </div>
        </header>

        <section className="programSummary attachmentReviewSummary" aria-label="검수 현황">
          <div><strong>{countOf('MANUAL_REVIEW_REQUIRED')}</strong><span>수동 검수 필요</span></div>
          <div><strong>{sessions}</strong><span>구조화 회차</span></div>
          <div><strong>{publishable}</strong><span>본문 게시 가능</span></div>
          <div><strong>{countOf('OCR_REQUIRED')}</strong><span>OCR 대기</span></div>
          <p>
            ‘자동 검토 후보’는 게시 승인 완료가 아니라 사람이 원본과 비교할 준비가 됐다는 뜻입니다.
            ‘본문 게시 가능’은 본문만으로 화면을 구성할 수 있다는 뜻이며, 첨부 확인이 끝났다는 뜻은 아닙니다.
          </p>
        </section>

        <nav className="attachmentReviewFilters" aria-label="상태별 보기">
          {STATUS_ORDER.map((status) => (
            <Link
              key={status}
              href={`/programs/attachment-review?status=${status}`}
              className={status === active ? 'is-active' : undefined}
              aria-current={status === active ? 'page' : undefined}
            >
              {REVIEW_STATUS_LABEL[status]} <span>{countOf(status)}</span>
            </Link>
          ))}
        </nav>

        <p className="attachmentReviewHint">{STATUS_HINT[active]}</p>

        <div className="attachmentReviewList">
          {visible.map((review) => {
            const reasons = reasonsOf(review);
            return (
              <article className="attachmentReviewCard" key={review.sourceId}>
                <div className="programCardFlags">
                  <span>{review.attachment?.detectedType ?? review.contentProfile}</span>
                  <span className={statusClass(review.reviewStatus)}>{REVIEW_STATUS_LABEL[review.reviewStatus]}</span>
                  {!review.bodyPublishable ? <span className="is-pending">본문 없음</span> : null}
                </div>
                <h2><Link href={`/programs/attachment-review/${review.sourceId}`}>{review.title}</Link></h2>
                <p>{review.attachment?.name ?? `${review.ocrTargets.length}개 이미지 첨부`}</p>
                {reasons.length ? <p className="attachmentReviewReasons">{reasons.join(' · ')}</p> : null}
                <dl>
                  {review.attachment ? (
                    <>
                      <div>
                        <dt>{review.attachment.detectedType === 'HWP' ? '선택 구간' : '선택 페이지'}</dt>
                        <dd>{review.selectedPages.length ? review.selectedPages.join(', ') : '전체 문서'}</dd>
                      </div>
                      <div><dt>일치 신뢰도</dt><dd>{Math.round(review.confidence * 100)}%</dd></div>
                      <div><dt>구조화 회차</dt><dd>{review.curriculum.length}개</dd></div>
                      <div><dt>추가 / 중복 제거</dt><dd>{review.audit.added.length} / {review.audit.skippedDuplicates.length}</dd></div>
                    </>
                  ) : (
                    <>
                      <div><dt>본문</dt><dd>{review.bodyPublishable ? '게시 가능' : '없음'}</dd></div>
                      <div><dt>OCR 대상</dt><dd>{review.ocrTargets.length}개</dd></div>
                    </>
                  )}
                </dl>
                <Link className="programCardLink" href={`/programs/attachment-review/${review.sourceId}`}>비교 검수하기 <span>→</span></Link>
              </article>
            );
          })}
          {visible.length ? null : <p className="attachmentReviewEmpty">이 상태에 해당하는 프로그램이 없습니다.</p>}
        </div>
      </section>
    </main>
  );
}
