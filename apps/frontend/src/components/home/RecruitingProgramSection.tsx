import Link from 'next/link';
import SectionHeading from './SectionHeading';
import { recruitingPrograms } from './home-data';

export default function RecruitingProgramSection() {
  return (
    <section className="homeSection recruitingSection">
      <div className="uiContainer">
        <SectionHeading
          eyebrow="OPEN PROGRAMS"
          title="모집 중인 작은도서관 프로그램"
          description="일정이 확정되어 지금 참여할 수 있는 우리 동네 프로그램입니다."
          action={
            <Link className="uiTextLink" href="/community/library-news">
              전체 프로그램 보기 <span aria-hidden="true">→</span>
            </Link>
          }
        />
        <div className="recruitingList">
          {recruitingPrograms.map((program, index) => (
            <article className="recruitingCard" key={program.id}>
              <span className="recruitingNumber">0{index + 1}</span>
              <div className="recruitingContent">
                <div>
                  <span
                    className={`uiTag ${
                      program.status === '접수 예정' ? '' : 'uiTagRecruiting'
                    }`}
                  >
                    {program.status}
                  </span>
                  <span className="recruitingLibrary">{program.library}</span>
                </div>
                <h3>{program.title}</h3>
                <p>
                  {program.audience} <i /> {program.schedule}
                </p>
              </div>
              <Link className="uiButton uiButtonSecondary" href="/community/library-news">
                상세 보기
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
