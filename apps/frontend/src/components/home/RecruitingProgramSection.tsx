import Link from 'next/link';
import SectionHeading from './SectionHeading';
import {
  formatProgramPeriod,
  getProgramSummaries,
  programRecruitLabel,
  programRecruitStatus,
} from '@/lib/program-prototype';

export default async function RecruitingProgramSection() {
  const today = new Date();
  const recruitingPrograms = (await getProgramSummaries())
    .filter((program) => programRecruitStatus(program, today) === 'open')
    .slice(0, 3);

  return (
    <section className="homeSection recruitingSection" id="recruiting-programs">
      <div className="uiContainer">
        <SectionHeading
          eyebrow="OPEN PROGRAMS"
          title="모집 중인 작은도서관 프로그램"
          description="일정이 확정되어 지금 참여할 수 있는 우리 동네 프로그램입니다."
          action={
            <Link className="uiTextLink" href="/programs?status=open">
              프로그램 둘러보기 <span aria-hidden="true">→</span>
            </Link>
          }
        />
        {recruitingPrograms.length ? <div className="recruitingList">
          {recruitingPrograms.map((program, index) => (
            <article className="recruitingCard" key={program.sourceId}>
              <span className="recruitingNumber">0{index + 1}</span>
              <div className="recruitingContent">
                <div>
                  <span className="uiTag uiTagRecruiting">
                    {programRecruitLabel[programRecruitStatus(program, today)]}
                  </span>
                  <span className="recruitingLibrary">{program.libraryName ?? '운영 도서관 확인 필요'}</span>
                </div>
                <h3>{program.title}</h3>
                <p>
                  {program.targetGroup ?? '대상 확인 필요'} <i /> {formatProgramPeriod(program.programStartDate, program.programEndDate)}
                </p>
              </div>
              <a className="uiButton uiButtonSecondary" href={program.sourceUrl} rel="noreferrer" target="_blank">
                상세 보기
                <span className="uiSrOnly"> 새 탭에서 열립니다</span>
              </a>
            </article>
          ))}
        </div> : <p className="homeSectionEmpty">현재 모집 중인 작은도서관 프로그램이 없습니다.</p>}
      </div>
    </section>
  );
}
