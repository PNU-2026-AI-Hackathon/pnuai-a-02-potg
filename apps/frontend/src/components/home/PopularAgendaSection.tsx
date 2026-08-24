import Link from 'next/link';
import SectionHeading from './SectionHeading';
import { getPopularIdeaPosts } from '@/lib/community-boards';

function summarize(content: string) {
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plainText.length > 100 ? `${plainText.slice(0, 100).trim()}…` : plainText;
}

export default async function PopularAgendaSection() {
  const popularAgendas = await getPopularIdeaPosts(3);

  return (
    <section className="homeSection popularAgendaSection" id="neighborhood-stories">
      <div className="uiContainer">
        <SectionHeading
          eyebrow="NEIGHBORHOOD VOICES"
          title="우리 동네 인기 의제"
          description="최근 주민들의 공감을 많이 받은 지역 의제를 살펴보세요."
          action={
            <Link className="uiTextLink" href="/community/ideas">
              우리동네 아이디어 보기 <span aria-hidden="true">→</span>
            </Link>
          }
        />
        {popularAgendas.length ? <div className="agendaGrid">
          {popularAgendas.map((agenda, index) => (
            <article className="agendaItem" key={agenda.id}>
              <div className="agendaItemTop">
                <span className="agendaIndex">0{index + 1}</span>
                <span className="uiTag">{agenda.tags[0] || '아이디어'}</span>
              </div>
              <h3><Link href="/community/ideas">{agenda.title}</Link></h3>
              <p>{summarize(agenda.content)}</p>
              <div className="agendaLocation">
                <span aria-hidden="true">⌖</span> {agenda.author}
              </div>
              <div className="agendaMeta">
                <span>♥ 공감 {agenda.likeCount}</span>
                <span>◯ 댓글 {agenda.commentCount}</span>
              </div>
            </article>
          ))}
        </div> : <p className="homeSectionEmpty">아직 등록된 우리동네 아이디어가 없습니다.</p>}
        <div className="homeCenteredAction">
          <Link className="uiButton uiButtonPrimary" href="/community/ideas">
            우리동네 아이디어 남기기 <span aria-hidden="true">＋</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
