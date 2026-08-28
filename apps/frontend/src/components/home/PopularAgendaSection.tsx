import Link from 'next/link';

import { getPopularIdeaPosts } from '@/lib/community-boards';

function AgendaMetaIcon({ name }: { name: 'user' | 'heart' | 'message' }) {
  const paths = {
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5a5.5 5.5 0 0 0 1.1-8.9Z" />,
    message: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
  };

  return (
    <svg className="agendaMetaIcon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function summarize(content: string) {
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plainText.length > 100 ? `${plainText.slice(0, 100).trim()}…` : plainText;
}

export default async function PopularAgendaSection() {
  const popularAgendas = await getPopularIdeaPosts(3);

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
          <Link
            className="uiButton uiButtonSecondary popularAgendaListButton"
            href="/community/ideas"
          >
            전체 아이디어 보기 <span aria-hidden="true">→</span>
          </Link>
        </div>

        {popularAgendas.length ? (
          <div className="agendaGrid">
            {popularAgendas.map((agenda, index) => (
              <article className="agendaItem" key={agenda.id}>
                <div className="agendaItemTop">
                  <span className="agendaIndex">0{index + 1}</span>
                  <span className="uiTag">{agenda.tags[0] || '아이디어'}</span>
                </div>

                <h3>
                  <Link href="/community/ideas">{agenda.title}</Link>
                </h3>

                <p>{summarize(agenda.content)}</p>

                <div className="agendaLocation">
                  <AgendaMetaIcon name="user" />
                  <span>{agenda.author}</span>
                </div>

                <div className="agendaMeta">
                  <span><AgendaMetaIcon name="heart" />공감 {agenda.likeCount}</span>
                  <span><AgendaMetaIcon name="message" />댓글 {agenda.commentCount}</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="homeSectionEmpty">
            아직 등록된 우리동네 아이디어가 없습니다.
          </p>
        )}

        <div className="homeCenteredAction">
          <Link className="uiButton uiButtonPrimary" href="/community/ideas">
            우리동네 아이디어 남기기 <span aria-hidden="true">＋</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
