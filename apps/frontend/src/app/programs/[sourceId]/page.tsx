import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  formatProgramPeriod,
  getProgramPrototype,
  groupNoticeLines,
  programCapacityLabel,
  programFeeLabel,
  structureProgramDescription,
  structureProgramText,
} from '@/lib/program-prototype';

type PageProps = { params: Promise<{ sourceId: string }> };

function compactComparable(value: string | null) {
  return String(value ?? '').replace(/[\s.,:()（）~-]/g, '').toLowerCase();
}

function dateParts(value: string | null) {
  const match = String(value ?? '').match(/(20\d{2})\D+(\d{1,2})\D+(\d{1,2})/);
  return match ? `${Number(match[1])}-${Number(match[2])}-${Number(match[3])}` : null;
}

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

  const hasCapacityConflict = program.warnings.includes('CAPACITY_DETAIL_AMBIGUOUS');
  const structuredNotice = structureProgramDescription(program.noticeText);
  const structuredProgramText = structureProgramText(program.programContent.text, program.title, [
    program.targetDetail,
    program.targetGroup,
    program.instructor,
    program.scheduleText,
    program.evidence.capacityText,
  ]);
  const noticeGroups = groupNoticeLines(program.noticeText).map((group) => ({
    ...group,
    lines: group.lines.filter((line) => {
      const duplicatesOperation = structuredNotice.operationalDetails.some((item) =>
        line.replace(/\s+/g, '').includes(item.value.replace(/\s+/g, '')));
      if (duplicatesOperation) return false;
      if (group.id === 'cost' && program.materialFeeAmount) {
        return /입금|계좌|환불|납부|별도|포함|준비/.test(line)
          || !line.replace(/,/g, '').includes(String(program.materialFeeAmount));
      }
      return true;
    }),
  })).filter((group) => group.lines.length > 0);
  const structuredTables = program.programContent.tables.filter((table) =>
    table.rows.length > 1 || table.rows.some((row) => row.cells.length > 1));
  const hasStructuredTable = structuredTables.length > 0;
  const structuredTextSections = structuredProgramText.sections.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (section.id === 'content' || section.id === 'contact') return true;
      const candidates = section.id === 'application'
        ? [program.applyStartDate, program.applyEndDate]
        : [program.programStartDate, program.programEndDate, program.scheduleText, program.libraryName];
      const itemDate = dateParts(item.value);
      const hasSpecificTime = /(?:오전|오후)\s*\d{1,2}시|\d{1,2}\s*:\s*\d{2}/.test(item.value);
      if (itemDate && !hasSpecificTime && candidates.some((candidate) => dateParts(candidate) === itemDate)) return false;
      const compactItem = compactComparable(item.value);
      return !candidates.filter(Boolean).some((candidate) => {
        const compactCandidate = compactComparable(candidate);
        return compactCandidate.length >= 5 && compactItem === compactCandidate;
      });
    }),
  })).filter((section) => section.items.length > 0);

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
            {hasStructuredTable ? (
              <div className="programTableScroll">
                {structuredTables.map((table, tableIndex) => (
                  <table className="programCurriculumTable" key={tableIndex}>
                    <tbody>{table.rows.map((row, rowIndex) => (
                      <tr key={rowIndex}>{row.cells.map((cell, cellIndex) => {
                        const Cell = cell.header ? 'th' : 'td';
                        return <Cell colSpan={cell.colSpan} rowSpan={cell.rowSpan} key={cellIndex}>{cell.text}</Cell>;
                      })}</tr>
                    ))}</tbody>
                  </table>
                ))}
              </div>
            ) : null}
            {program.programContent.images.length ? (
              <section className="programTextSection is-content programMediaSection">
                <h3>안내 이미지</h3>
                <div className="programPosterList">
                  {program.programContent.images.map((image) => (
                    <a href={image.url} key={image.url} rel="noreferrer" target="_blank">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.url} alt={image.alt || `${program.title} 안내 이미지`} />
                    </a>
                  ))}
                </div>
              </section>
            ) : null}
            {program.programContent.text && !hasStructuredTable && structuredProgramText.recognizedCount ? (
              <div className="programTextSections">
                {structuredTextSections.map((section) => (
                  <section key={section.id} className={`programTextSection is-${section.id}`}>
                    <h3>{section.title}</h3>
                    <dl>{section.items.map((item, index) => (
                      <div key={`${item.label}-${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                    ))}</dl>
                  </section>
                ))}
                {structuredProgramText.remainingLines.length ? (
                  <section className="programTextSection is-other">
                    <h3>프로그램 소개</h3>
                    <div className="programStructuredContent">
                      {structuredProgramText.remainingLines.map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : program.programContent.text && !hasStructuredTable ? (
              <section className="programTextSection is-content">
                <h3>프로그램 소개</h3>
                <div className="programStructuredContent">
                  {program.programContent.text.split(/\r?\n/).map((line, index) => <p key={`${index}-${line}`}>{line}</p>)}
                </div>
              </section>
            ) : null}
            {!hasStructuredTable && !program.programContent.images.length && !program.programContent.text && program.programContent.kind === 'attachment_only' ? (
              <p className="programEmptyText">프로그램 내용이 첨부파일로 제공되었습니다. 아래 첨부파일을 확인해 주세요.</p>
            ) : null}
            {!hasStructuredTable && !program.programContent.images.length && !program.programContent.text && program.programContent.kind === 'empty' ? (
              <p className="programEmptyText">등록된 프로그램 내용이 없습니다. 원사이트를 확인해 주세요.</p>
            ) : null}
          </section>

          {structuredNotice.operationalDetails.length ? (
            <section className="programOperationalDetails" aria-labelledby="program-operation-title">
              <h2 id="program-operation-title">추가 운영 정보</h2>
              <dl>
                {structuredNotice.operationalDetails.map((item, index) => (
                  <div key={`${item.label}-${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                ))}
              </dl>
            </section>
          ) : null}

          {noticeGroups.length ? (
            <section className="programNoticeGroups" aria-labelledby="program-notice-title">
              <h2 id="program-notice-title">이용 안내</h2>
              <div className="programNoticeGrid">
                {noticeGroups.map((group) => (
                  <section key={group.id} className={`programNoticeGroup is-${group.id}`}>
                    <h3>{group.title}</h3>
                    <ul>{group.lines.map((notice, index) => <li key={`${index}-${notice}`}>{notice}</li>)}</ul>
                  </section>
                ))}
              </div>
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
