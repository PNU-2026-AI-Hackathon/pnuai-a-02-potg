import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProgramAttachmentReview, REVIEW_STATUS_LABEL } from '@/lib/program-attachment-review';

type PageProps = { params: Promise<{ sourceId: string }> };

export default async function ProgramAttachmentReviewDetail({ params }: PageProps) {
  const { sourceId } = await params;
  const review = await getProgramAttachmentReview(Number(sourceId));
  if (!review) notFound();
  const content = review.board.sections.find((section) => section.id === 'content');
  const others = review.board.sections.filter((section) => section.id !== 'content');
  const showCurriculumDate = review.curriculum.some((session) => Boolean(session.date));
  const showTeachingMethod = review.curriculum.some((session) => Boolean(session.teachingMethod));
  const showMaterials = review.curriculum.some((session) => Boolean(session.materials));
  const showNotes = review.curriculum.some((session) => Boolean(session.notes) || session.referenceBooks.length > 0 || session.referenceImages.some((image) => image.src));
  return (
    <main className="programPage attachmentReviewPage">
      <section className="uiContainer programShell">
        <nav className="communityBreadcrumb"><Link href="/programs/attachment-review">첨부 정제 검수</Link><span>/</span><span>{review.sourceId}</span></nav>
        <header className="attachmentReviewDetailHeader">
          <div><p className="uiEyebrow">Comparison Review</p><h1>{review.title}</h1><p>{review.matchReason || REVIEW_STATUS_LABEL[review.reviewStatus]}</p></div>
          <div className="attachmentReviewActions">
            <a className="uiButton uiButtonSecondary" href={review.sourceUrl} target="_blank" rel="noreferrer">원사이트 열기</a>
            {review.attachment?.url ? <a className="uiButton uiButtonPrimary" href={review.attachment.url} target="_blank" rel="noreferrer">첨부파일 열기</a> : null}
          </div>
        </header>

        <section className="attachmentMatchBanner">
          <strong>
            {review.attachment
              ? `${review.attachment.detectedType} · ${review.selectedPages.length
                ? `${review.selectedPages.join(', ')}${review.attachment.detectedType === 'HWP' ? '번째 구간' : '페이지'} 선택`
                : '전체 문서 선택'}`
              : REVIEW_STATUS_LABEL[review.reviewStatus]}
          </strong>
          {review.attachment && review.ocrConfidence == null
            ? <span>일치 신뢰도 {Math.round(review.confidence * 100)}%</span>
            : null}
          {review.ocrConfidence != null
            ? <span>OCR 인식 신뢰도 {Math.round(review.ocrConfidence * 100)}% · 이미지 {review.ocrImageCount}장</span>
            : null}
          {/* 포스터에서 읽어낸 내용이 있으면 본문이 없어도 게시할 거리는 있다. */}
          <span>{review.bodyPublishable || review.ocrConfidence != null ? '게시 내용 있음' : '게시 내용 없음'}</span>
        </section>

        {review.ocrConfidence != null ? (
          <section className="attachmentExtractionWarnings">
            <h3>
              {review.curriculum.length ? '이미지에서 읽은 회차입니다'
                : review.curriculumExpected ? '회차 입력이 필요합니다'
                  : '이미지에서 읽은 결과입니다'}
            </h3>
            <p className="attachmentSourceHint">
              {review.curriculum.length
                ? `표 머리글을 찾아 ${review.curriculum.length}개 회차를 읽었습니다. 문서가 아니라 글자 위치로 복원한 것이니 원본 이미지와 대조해 주세요.`
                : review.curriculumExpected
                  ? '포스터에 회차표가 있지만 표 머리글을 찾지 못해 복원하지 못했습니다. 아래 첨부 이미지와 추출문을 보고 회차를 입력해 주세요.'
                  : '회차표가 없는 안내문이라 회차는 비어 있는 것이 정상입니다. 기본정보만 원본과 대조해 주세요.'}
            </p>
            {review.attachments.length ? (
              <p className="attachmentSourceHint">
                {review.attachments.map((attachment) => (
                  <a key={attachment.url} href={attachment.url} target="_blank" rel="noreferrer">원본 이미지 열기</a>
                ))}
              </p>
            ) : null}
          </section>
        ) : null}

        {review.failure ? (
          <section className="attachmentExtractionWarnings">
            <h3>추출 실패</h3>
            <ul><li>{review.failure.code} — {review.failure.message}{review.failure.retryable ? ' (재시도 가능)' : ''}</li></ul>
          </section>
        ) : null}

        {review.reviewStatus === 'OCR_REQUIRED' ? (
          <section className="attachmentExtractionWarnings">
            <h3>OCR 대기 {review.ocrTargets.length}건</h3>
            <p className="attachmentSourceHint">
              {review.bodyPublishable
                ? '본문만으로 먼저 게시할 수 있습니다. 회차 등 상세 정보는 OCR 이후 보완됩니다.'
                : '본문이 없어 OCR 전까지 게시할 내용이 없습니다.'}
            </p>
            <ul>{review.ocrTargets.map((target) => (
              <li key={target.url}><a href={target.url} target="_blank" rel="noreferrer">{target.name}</a></li>
            ))}</ul>
          </section>
        ) : null}

        <section className="attachmentComparisonGrid" aria-label="원문과 첨부 비교">
          <article><h2>1. 공공예약 본문</h2><p className="attachmentSourceHint">원사이트에서 크롤링한 본문</p><pre>{review.originalBody || '본문 없음'}</pre></article>
          <article><h2>2. 자동 선택한 첨부 구간</h2><p className="attachmentSourceHint">{review.attachment?.name ?? '문서 첨부 없음'}</p><pre>{review.selectedText || '선택된 텍스트 없음'}</pre></article>
        </section>

        <section className="attachmentAuditPanel">
          <h2>3. 병합 판단 내역</h2>
          {review.extractionWarnings.length ? <div className="attachmentExtractionWarnings"><h3>원본 대조 필요</h3><ul>{review.extractionWarnings.map((warning) => <li key={warning.code}>{warning.message}</li>)}</ul></div> : null}
          <div className="attachmentAuditGrid">
            <div><h3>새로 추가 <span>{review.audit.added.length}</span></h3><ul>{review.audit.added.map((item, index) => <li key={index}><strong>{item.label}</strong><p>{item.value}</p></li>)}</ul></div>
            <div><h3>중복 제거 <span>{review.audit.skippedDuplicates.length}</span></h3><ul>{review.audit.skippedDuplicates.map((item, index) => <li key={index}><strong>{item.label}</strong><p>{item.value}</p></li>)}</ul></div>
            <div><h3>잡음 폐기 <span>{review.audit.discardedNoise.length}</span></h3><ul>{review.audit.discardedNoise.map((item, index) => <li key={index}><strong>{item.label}</strong><p>{item.value}</p><small>{item.reason}</small></li>)}</ul></div>
            <div><h3>충돌 <span>{review.audit.warnings.length}</span></h3>{review.audit.warnings.length ? <ul>{review.audit.warnings.map((item, index) => <li key={index}><strong>{item.label}</strong><p>{item.basicValue} ↔ {item.attachmentValue}</p></li>)}</ul> : <p className="attachmentEmptyState">발견된 충돌이 없습니다.</p>}</div>
          </div>
        </section>

        <section className="attachmentBoardPreview">
          <div className="attachmentSectionHeading"><div><p className="uiEyebrow">Board Preview</p><h2>4. 최종 게시판 미리보기</h2></div><span>검수 전</span></div>
          <section className="programInfoPanel attachmentPreviewSection" aria-labelledby="attachment-basic-info"><h2 id="attachment-basic-info">프로그램 기본 정보</h2><dl>{review.basicInfo.map((item, index) => <div className={item.value.length > 32 ? 'isWide' : undefined} key={`${item.label}-${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></section>

          <section className="programDescription attachmentPreviewSection" aria-labelledby="attachment-content"><h2 id="attachment-content">프로그램 내용</h2>
            {content || review.board.intro.length ? <section className="programTextSection is-content"><h3>{content?.title ?? '프로그램 소개'}</h3>{content ? <dl>{content.items.map((item, index) => <div key={index}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl> : null}{review.board.intro.map((line, index) => <p key={index}>{line}</p>)}</section> : null}
            {others.map((section) => <section className={`programTextSection is-${section.id}`} key={section.id}><h3>{section.title}</h3><dl>{section.items.map((item, index) => <div key={index}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl></section>)}
            <section className="attachmentCurriculum"><h3>회차별 활동 <span>{review.curriculum.length}</span></h3>{review.curriculum.length ? <div className="programTableScroll"><table className="programCurriculumTable"><thead><tr><th>회차</th>{showCurriculumDate ? <th>일자</th> : null}<th>활동 내용</th>{showTeachingMethod ? <th>교수방법</th> : null}{showMaterials ? <th>준비물</th> : null}{showNotes ? <th>비고</th> : null}</tr></thead><tbody>{review.curriculum.map((session) => <tr key={session.session}><td>{session.session}</td>{showCurriculumDate ? <td>{session.date ?? '-'}</td> : null}<td>{session.category ? <strong className="attachmentCurriculumCategory">{session.category}</strong> : null}{session.activity}</td>{showTeachingMethod ? <td>{session.teachingMethod ?? '-'}</td> : null}{showMaterials ? <td>{session.materials ?? '-'}</td> : null}{showNotes ? <td>{session.referenceBooks.length || session.referenceImages.some((image) => image.src) || session.notes ? <div className="attachmentCurriculumReferences">{session.referenceBooks.length ? <div><strong>참고도서</strong><ul>{session.referenceBooks.map((book) => <li key={book}>{book}</li>)}</ul></div> : null}{session.referenceImages.filter((image) => image.src).map((image, index) => <img key={image.filename} src={image.src} alt={`${session.session}회차 참고 이미지 ${index + 1}`} />)}{session.notes ? <p>{session.notes}</p> : null}</div> : '-'}</td> : null}</tr>)}</tbody></table></div> : <p className="attachmentEmptyState">{review.curriculumExpected
              ? '포스터에 회차표가 있습니다. 위 추출문과 원본 이미지를 보고 회차를 입력해 주세요.'
              : review.ocrConfidence != null
                ? '회차표가 없는 안내문이라 회차가 비어 있는 것이 정상입니다.'
                : '표가 없는 프로그램이거나, 복잡한 PDF 표라 회차를 아직 복원하지 못했습니다.'}</p>}</section>
          </section>

          <section className="programNoticeGroups attachmentPreviewSection" aria-labelledby="attachment-notices"><h2 id="attachment-notices">이용 안내</h2>{review.board.notices.length ? <div className="programNoticeGrid">{review.board.notices.map((group) => <section className={`programNoticeGroup is-${group.id}`} key={group.id}><h3>{group.title}</h3><ul>{group.lines.map((line, index) => <li key={index}>{line}</li>)}</ul></section>)}</div> : <p className="attachmentEmptyState">별도의 이용 안내가 없습니다.</p>}</section>

          <section className="programAttachments attachmentPreviewSection" aria-labelledby="attachment-files"><h2 id="attachment-files">첨부파일</h2>{review.attachments.length ? <ul>{review.attachments.map((attachment) => <li key={attachment.url}><a href={attachment.url} target="_blank" rel="noreferrer">{attachment.name}</a></li>)}</ul> : <p className="attachmentEmptyState">첨부파일이 없습니다.</p>}</section>
        </section>
        <div className="programDetailActions"><Link className="uiButton uiButtonSecondary" href={`/programs/attachment-review?status=${review.reviewStatus}`}>검수 목록으로</Link></div>
      </section>
    </main>
  );
}
