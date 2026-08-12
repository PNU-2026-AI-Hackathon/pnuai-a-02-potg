import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  formatProgramPeriod,
  getProgramOccurrences,
  getProgramPrototype,
  programCapacityLabel,
  programFeeLabel,
} from '@/lib/program-prototype';

type PageProps = { params: Promise<{ sourceId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sourceId } = await params;
  const program = await getProgramPrototype(Number(sourceId));
  return program
    ? { title: `${program.title} | 모이라`, description: program.description?.slice(0, 150) }
    : { title: '프로그램을 찾을 수 없습니다 | 모이라' };
}

export default async function ProgramDetailPage({ params }: PageProps) {
  const { sourceId } = await params;
  const program = await getProgramPrototype(Number(sourceId));
  if (!program) notFound();

  const occurrences = await getProgramOccurrences(program);
  const contentSection = program.board.sections.find((section) => section.id === 'content');
  const otherSections = program.board.sections.filter((section) => section.id !== 'content');
  const hasCapacityConflict = program.warnings.includes('CAPACITY_DETAIL_AMBIGUOUS');
  const tables = program.programContent.tables.filter((table) =>
    table.rows.length > 1 || table.rows.some((row) => row.cells.length > 1));

  // 표 셀에 들어 있던 이미지는 아래 안내 이미지에서 크게 보여준다. 어느 칸의 이미지인지
  // 알 수 있도록 번호를 매겨 셀과 연결한다.
  const cellImageNumber = new Map<string, number>();
  tables.forEach((table) => table.rows.forEach((row) => row.cells.forEach((cell) => cell.images.forEach((image) => {
    if (!cellImageNumber.has(image.url)) cellImageNumber.set(image.url, cellImageNumber.size + 1);
  }))));

  return (
    <main className="programPage programDetailPage">
      <section className="uiContainer programShell">
        <nav className="communityBreadcrumb" aria-label="현재 위치">
          <Link href="/">홈</Link><span aria-hidden="true">/</span>
          <Link href="/programs">프로그램 게시판</Link><span aria-hidden="true">/</span>
          <span>상세 정보</span>
        </nav>

        <article className="programDetailArticle">
          <header className="programDetailHeader">
            <div className="programDetailBadges">
              <span>{program.targetGroup ?? '대상 미정'}</span>
              <span>{program.libraryName ?? '도서관 확인 필요'}</span>
            </div>
            <h1>{program.title}</h1>
            <p>{program.targetDetail ?? program.targetGroup ?? '대상 정보 확인 필요'}</p>
          </header>

          {hasCapacityConflict ? (
            <aside className="programDataNotice">
              <strong>모집인원 정보를 확인해 주세요.</strong>
              <p>공공예약 기본정보와 본문 안내의 인원이 달라 원사이트 내용을 함께 확인해야 합니다.</p>
            </aside>
          ) : null}

          <section className="programInfoPanel" aria-labelledby="program-info-title">
            <h2 id="program-info-title">프로그램 기본 정보</h2>
            <dl>
              <div><dt>운영 도서관</dt><dd>{program.libraryName ?? '확인 필요'}</dd></div>
              <div><dt>대상</dt><dd>{program.targetDetail ?? program.targetGroup ?? '확인 필요'}</dd></div>
              <div><dt>강사</dt><dd>{program.instructor ?? '확인 필요'}</dd></div>
              <div><dt>모집인원</dt><dd>{programCapacityLabel(program)}</dd></div>
              <div><dt>교육기간</dt><dd>{formatProgramPeriod(program.programStartDate, program.programEndDate)}</dd></div>
              <div><dt>신청기간</dt><dd>{formatProgramPeriod(program.applyStartDate, program.applyEndDate)}</dd></div>
              <div className="isWide"><dt>교육시간</dt><dd>{program.scheduleText ?? '확인 필요'}</dd></div>
              <div className="isWide"><dt>온라인 접수 여부</dt><dd>{program.onlineApplicationStatus ?? '원사이트에서 확인'}</dd></div>
              <div className="isWide"><dt>비용</dt><dd>{programFeeLabel(program)}</dd></div>
            </dl>
          </section>

          <section className="programDescription" aria-labelledby="program-description-title">
            <h2 id="program-description-title">프로그램 내용</h2>

            {tables.length ? (
              <div className="programTableScroll">
                {tables.map((table, tableIndex) => (
                  <table className="programCurriculumTable" key={tableIndex}>
                    <tbody>{table.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>{row.cells.map((cell, cellIndex) => {
                        const Cell = cell.header ? 'th' : 'td';
                        return (
                          <Cell colSpan={cell.colSpan} rowSpan={cell.rowSpan} key={cellIndex}>
                            {cell.text}
                            {cell.images.map((image) => (
                              <a className="programCellImageRef" href={`#program-image-${cellImageNumber.get(image.url)}`} key={image.url}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={image.url} alt={image.alt || '표 안 이미지'} />
                                <span>안내 이미지 {cellImageNumber.get(image.url)}</span>
                              </a>
                            ))}
                          </Cell>
                        );
                      })}</tr>
                    ))}</tbody>
                  </table>
                ))}
              </div>
            ) : null}

            {program.board.sections.length || program.board.intro.length ? (
              <div className="programTextSections">
                {/* 라벨 없는 자유문은 '프로그램 소개' 구획 안에 함께 넣는다.
                    따로 그리면 같은 제목이 두 번 나온다. */}
                {contentSection || program.board.intro.length ? (
                  <section className="programTextSection is-content">
                    <h3>{contentSection?.title ?? '프로그램 소개'}</h3>
                    {contentSection ? (
                      <dl>{contentSection.items.map((item, index) => (
                        <div key={`${item.label}-${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                      ))}</dl>
                    ) : null}
                    {program.board.intro.length ? (
                      <div className="programStructuredContent">
                        {program.board.intro.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
                      </div>
                    ) : null}
                  </section>
                ) : null}
                {otherSections.map((section) => (
                  <section key={section.id} className={`programTextSection is-${section.id}`}>
                    <h3>{section.title}</h3>
                    <dl>{section.items.map((item, index) => (
                      <div key={`${item.label}-${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                    ))}</dl>
                  </section>
                ))}
              </div>
            ) : null}

            {program.programContent.images.length ? (
              <section className="programTextSection is-content programMediaSection">
                <h3>안내 이미지</h3>
                <div className="programPosterList">
                  {program.programContent.images.map((image, index) => (
                    <a href={image.url} id={`program-image-${cellImageNumber.get(image.url) ?? index + 1}`} key={image.url} rel="noreferrer" target="_blank">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt={image.alt || `${program.title} 안내 이미지`} />
                    </a>
                  ))}
                </div>
              </section>
            ) : null}

            {!tables.length && !program.board.sections.length && !program.board.intro.length && !program.programContent.images.length ? (
              <p className="programEmptyText">
                {program.attachments.length
                  ? '프로그램 내용이 첨부파일로 제공되었습니다. 아래 첨부파일을 확인해 주세요.'
                  : '등록된 프로그램 내용이 없습니다. 원사이트를 확인해 주세요.'}
              </p>
            ) : null}
          </section>

          {program.board.notices.length ? (
            <section className="programNoticeGroups" aria-labelledby="program-notice-title">
              <h2 id="program-notice-title">이용 안내</h2>
              <div className="programNoticeGrid">
                {program.board.notices.map((group) => (
                  <section key={group.id} className={`programNoticeGroup is-${group.id}`}>
                    <h3>{group.title}</h3>
                    <ul>{group.lines.map((notice, index) => <li key={`${index}-${notice}`}>{notice}</li>)}</ul>
                  </section>
                ))}
              </div>
            </section>
          ) : null}

          {occurrences.length ? (
            <section className="programOperationalDetails" aria-labelledby="program-series-title">
              <h2 id="program-series-title">같은 프로그램의 다른 회차 {occurrences.length}건</h2>
              <ul className="programSeriesList">
                {occurrences.map((item) => (
                  <li key={item.sourceId}>
                    <Link href={`/programs/${item.sourceId}`}>
                      {item.occurrenceLabel ?? formatProgramPeriod(item.programStartDate, item.programEndDate)}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="programAttachments" aria-labelledby="program-attachments-title">
            <h2 id="program-attachments-title">첨부파일</h2>
            {program.attachments.length ? (
              <ul>{program.attachments.map((attachment) => <li key={attachment.url}><a href={attachment.url} rel="noreferrer" target="_blank">{attachment.name}</a></li>)}</ul>
            ) : <p className="programEmptyText">첨부파일이 없습니다.</p>}
          </section>

          {program.description ? (
            <details className="programRawDescription">
              <summary>공공예약 본문 원문 전체 보기</summary>
              <p>{program.description}</p>
            </details>
          ) : null}

          <div className="programDetailActions">
            <Link className="uiButton uiButtonSecondary" href="/programs">목록으로</Link>
            <div className="programApplyAction">
              <span>공공예약 서비스에서 로그인 후 신청할 수 있습니다.</span>
              <a className="uiButton uiButtonPrimary" href={program.sourceUrl} rel="noreferrer" target="_blank">신청하기</a>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
