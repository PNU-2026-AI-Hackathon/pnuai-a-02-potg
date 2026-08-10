import Link from 'next/link';
import SectionHeading from './SectionHeading';
import { popularAgendas } from './home-data';

export default function PopularAgendaSection() {
  return (
    <section className="homeSection popularAgendaSection">
      <div className="uiContainer">
        <SectionHeading
          eyebrow="NEIGHBORHOOD VOICES"
          title="우리 동네 인기 의제"
          description="최근 주민들의 공감을 많이 받은 지역 의제를 살펴보세요."
          action={
            <Link className="uiTextLink" href="/community/free">
              동네 이야기 보기 <span aria-hidden="true">→</span>
            </Link>
          }
        />
        <div className="agendaGrid">
          {popularAgendas.map((agenda, index) => (
            <article className="agendaItem" key={agenda.id}>
              <div className="agendaItemTop">
                <span className="agendaIndex">0{index + 1}</span>
                <span className="uiTag">{agenda.category}</span>
              </div>
              <h3>{agenda.title}</h3>
              <p>{agenda.description}</p>
              <div className="agendaLocation">
                <span aria-hidden="true">⌖</span> {agenda.location}
              </div>
              <div className="agendaMeta">
                <span>♥ 공감 {agenda.likes}</span>
                <span>◯ 댓글 {agenda.comments}</span>
              </div>
            </article>
          ))}
        </div>
        <div className="homeCenteredAction">
          <Link className="uiButton uiButtonPrimary" href="/community/free">
            동네 이야기 남기기 <span aria-hidden="true">＋</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
