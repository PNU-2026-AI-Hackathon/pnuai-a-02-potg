'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type VotingDocument = { id: string; title: string; content: string; voteCount: number };

export default function StudioVotingDetail({ documentId }: { documentId: string }) {
  const [document, setDocument] = useState<VotingDocument | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`/api/studio/votes/${documentId}`, { cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((data) => setDocument(data.document))
      .catch(() => setFailed(true));
  }, [documentId]);

  if (failed) return <main className="studioVotingPage"><section className="uiContainer studioVotingDetail"><p className="studioVotingNotice">기획서를 불러오지 못했거나 투표가 종료되었습니다.</p><Link href="/survey">투표 목록으로 돌아가기</Link></section></main>;
  if (!document) return <main className="studioVotingPage"><p className="studioVotingNotice">기획서를 불러오는 중입니다.</p></main>;

  return <main className="studioVotingPage"><article className="uiContainer studioVotingDetail">
    <Link className="studioVotingBack" href="/survey">← 투표 목록</Link>
    <header><span>수요조사 중 · {document.voteCount}명 참여</span><h1>{document.title}</h1></header>
    <div className="studioVotingFullContent">{document.content}</div>
    <div className="studioVotingDetailActions"><Link className="uiButton uiButtonPrimary" href="/survey">이 기획서에 투표하기</Link></div>
  </article></main>;
}
