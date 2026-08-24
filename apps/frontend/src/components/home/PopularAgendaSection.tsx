import Link from 'next/link';
import { popularAgendas } from './home-data';

export default function PopularAgendaSection() {
  return (
    <section className="homeSection popularAgendaSection" id="neighborhood-stories">
      <div className="uiContainer">
        <div className="homeSectionHeading popularAgendaHeading">
          <p className="uiEyebrow">NEIGHBORHOOD VOICES</p>
          <h2>우리 동네 인기 아이디어</h2>
          <p className="homeSectionDescription">
            주민들의 공감을 많이 받은 도서관 프로그램 아이디어를 살펴보세요.
          </p>
        </div>
        <div className="popularAgendaListAction">
          <Link className="uiButton uiButtonSecondary popularAgendaListButton" href="/community/ideas">
            전체 아이디어 보기 <span aria-hidden="true">→</span>
          </Link>
        </div>
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
          <Link className="uiButton uiButtonPrimary" href="/community/ideas">
            우리동네 아이디어 남기기 <span aria-hidden="true">＋</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
