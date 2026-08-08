'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './styles.module.css';

type ListItem = { programCaseId: string; title: string; groupId: string | null; representative: boolean; fileTypes: string[]; sharedBinary: boolean; relationshipTypes: string[]; safetyStatuses: string[]; candidateStatuses: string[] };
type Detail = { programCaseId: string; sourceType: string; sourcePostId: string; sourceUrl: string; core: Record<string, string | null>; sessions: unknown[]; attachments: Attachment[] };
type Attachment = { attachmentId: string; fileName: string; sourceSha256: string; fileType: string; sharedProgramCaseIds: string[]; relationships: Array<Record<string, unknown>>; safetyDecisions: Array<Record<string, any>>; sections: Array<Record<string, any>>; candidates: Array<Record<string, any>>; units: Array<Record<string, any>> };
type CorpusPair = { core?: Record<string, any>; safe?: Record<string, any> };

const safetyOptions = ['', 'SAFE_FOR_CORPUS', 'CORE_ONLY', 'MANUAL_REVIEW', 'EXCLUDED', 'AMBIGUOUS', 'NO_RELIABLE_MATCH'];

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(response.status === 503 ? '백엔드 Inspector artifact를 먼저 생성해 주세요.' : '데이터를 불러오지 못했습니다.');
  return response.json() as Promise<T>;
}

export default function AiSearchDataInspectorPage() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [group, setGroup] = useState<Record<string, any> | null>(null);
  const [corpus, setCorpus] = useState<CorpusPair | null>(null);
  const [query, setQuery] = useState('');
  const [safety, setSafety] = useState('');
  const [fileType, setFileType] = useState('');
  const [shared, setShared] = useState(false);
  const [tab, setTab] = useState<'source' | 'representation' | 'group' | 'corpus' | 'json'>('source');
  const [overlay, setOverlay] = useState<'field' | 'line' | 'block' | 'section' | 'candidate'>('block');
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (safety) params.set('safety', safety);
      if (fileType) params.set('fileType', fileType);
      if (shared) params.set('shared', 'true');
      getJson<{ items: ListItem[] }>(`/api/program-case-search-inspector/program-cases?${params}`).then((value) => {
        setItems(value.items); setError('');
        if (!selectedId && value.items[0]) setSelectedId(value.items[0].programCaseId);
      }).catch((reason: Error) => setError(reason.message));
    }, 150);
    return () => clearTimeout(timer);
  }, [query, safety, fileType, shared, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    getJson<Detail>(`/api/program-case-search-inspector/program-cases/${selectedId}`).then(async (value) => {
      setDetail(value);
      const item = items.find((entry) => entry.programCaseId === selectedId);
      if (item?.groupId) {
        const [groupValue, corpusValue] = await Promise.all([
          getJson<Record<string, any>>(`/api/program-case-search-inspector/groups/${item.groupId}`),
          getJson<CorpusPair>(`/api/program-case-search-inspector/corpus/${item.groupId}`),
        ]);
        setGroup(groupValue); setCorpus(corpusValue);
      }
    }).catch((reason: Error) => setError(reason.message));
  }, [selectedId, items]);

  const selected = items.find((item) => item.programCaseId === selectedId);
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>MOIRA STUDIO · READ-ONLY</p><h1>AI Search Data Inspector</h1><p>원천 ProgramCase에서 그룹과 검색 corpus까지 provenance를 검수합니다.</p></div>
        <span className={styles.readonly}>DB WRITE 0</span>
      </header>
      {error && <div className={styles.error} role="alert">{error}</div>}
      <div className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.filters}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목 · ProgramCase ID · Group ID" aria-label="검색" />
            <div className={styles.filterRow}>
              <select value={safety} onChange={(event) => setSafety(event.target.value)} aria-label="안전 상태"><option value="">모든 안전 상태</option>{safetyOptions.slice(1).map((value) => <option key={value}>{value}</option>)}</select>
              <select value={fileType} onChange={(event) => setFileType(event.target.value)} aria-label="파일 유형"><option value="">모든 파일</option><option>PDF</option><option>PNG</option><option>JPEG</option><option>HWP</option></select>
            </div>
            <label className={styles.check}><input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} /> 공유 binary만</label>
          </div>
          <div className={styles.count}>{items.length} PROGRAM CASES</div>
          <div className={styles.list}>{items.map((item) => <button key={item.programCaseId} className={`${styles.listItem} ${item.programCaseId === selectedId ? styles.active : ''}`} onClick={() => setSelectedId(item.programCaseId)}>
            <strong>{item.title}</strong><span>{item.programCaseId.slice(0, 8)} · {item.fileTypes.join('/') || 'NO FILE'}</span><div>{item.sharedBinary && <em>SHARED</em>}{item.safetyStatuses.map((value) => <em key={value} data-status={value}>{value}</em>)}</div>
          </button>)}</div>
        </aside>
        <section className={styles.panel}>
          {!detail ? <div className={styles.empty}>ProgramCase를 선택하거나 데이터를 불러오는 중입니다.</div> : <>
            <div className={styles.titlebar}><div><p className={styles.mono}>{detail.programCaseId}</p><h2>{detail.core.title}</h2></div>{selected?.groupId && <span className={styles.groupId}>GROUP {selected.groupId.slice(0, 10)}</span>}</div>
            <nav className={styles.tabs}>{(['source', 'representation', 'group', 'corpus', 'json'] as const).map((value) => <button key={value} className={tab === value ? styles.tabActive : ''} onClick={() => setTab(value)}>{value}</button>)}</nav>
            {tab === 'source' && <SourcePanel detail={detail} />}
            {tab === 'representation' && <RepresentationPanel attachments={detail.attachments} overlay={overlay} setOverlay={setOverlay} />}
            {tab === 'group' && <GroupPanel group={group} />}
            {tab === 'corpus' && <CorpusPanel corpus={corpus} />}
            {tab === 'json' && <pre className={styles.raw}>{JSON.stringify({ detail, group, corpus }, null, 2)}</pre>}
          </>}
        </section>
      </div>
    </main>
  );
}

function SourcePanel({ detail }: { detail: Detail }) { return <div className={styles.grid}>
  <Info label="대상" value={detail.core.targetAudience} /><Info label="운영 기간" value={`${detail.core.educationStartDateText ?? '미상'} ~ ${detail.core.educationEndDateText ?? '미상'}`} /><Info label="장소" value={detail.core.location ?? '미상'} /><Info label="출처" value={`${detail.sourceType} · ${detail.sourcePostId}`} />
  <article className={styles.wide}><h3>Attachment</h3>{detail.attachments.length ? detail.attachments.map((item) => <div className={styles.attachment} key={item.attachmentId}><strong>{item.fileName}</strong><code>{item.sourceSha256}</code><span>{item.fileType} · 연결 ProgramCase {item.sharedProgramCaseIds.length}건</span></div>) : <p>Attachment 없음</p>}</article>
  <article className={styles.wide}><h3>공식 원문</h3><a href={detail.sourceUrl} target="_blank" rel="noreferrer">원문 페이지 열기 ↗</a></article>
</div>; }

function RepresentationPanel({ attachments, overlay, setOverlay }: { attachments: Attachment[]; overlay: string; setOverlay: (value: any) => void }) {
  const attachment = attachments[0];
  if (!attachment) return <div className={styles.empty}>표시할 Attachment가 없습니다.</div>;
  const blocks = attachment.units.filter((unit) => unit.kind === 'DERIVED_OCR_BLOCK' && unit.boundingPoly);
  const dimensions = blocks.reduce<{ width: number; height: number }>((size, block) => ({ width: Math.max(size.width, ...block.boundingPoly.map((point: { x: number }) => point.x)), height: Math.max(size.height, ...block.boundingPoly.map((point: { y: number }) => point.y)) }), { width: 1, height: 1 });
  return <div><div className={styles.overlayControls}>{['field', 'line', 'block', 'section', 'candidate'].map((value) => <button key={value} className={overlay === value ? styles.tabActive : ''} onClick={() => setOverlay(value)}>{value}</button>)}</div>
    <div className={styles.repGrid}><article><h3>{attachment.fileName}</h3>{['PNG', 'JPEG'].includes(attachment.fileType) ? <div className={styles.preview}><Image unoptimized width={1200} height={1600} src={`/api/program-case-search-inspector/assets/${attachment.sourceSha256}`} alt="Attachment preview" />{overlay === 'block' && blocks.map((block, index) => <Overlay key={block.recordId} block={block} index={index} dimensions={dimensions} />)}</div> : <div className={styles.fileCard}><b>{attachment.fileType}</b><p>구조 추출 결과를 우측에서 검수하세요.</p></div>}</article>
    <article><h3>구조 요약</h3><Stat label="Section" value={attachment.sections.length} /><Stat label="Candidate" value={attachment.candidates.length} /><Stat label="Units" value={attachment.units.length} />{attachment.safetyDecisions.map((decision, index) => <div className={styles.decision} key={index}><b>{decision.safetyStatus}</b><span>{decision.candidateStatus}</span><p>{(decision.reasons ?? []).join(' · ')}</p></div>)}</article></div>
  </div>;
}

function Overlay({ block, index, dimensions }: { block: Record<string, any>; index: number; dimensions: { width: number; height: number } }) {
  const points = block.boundingPoly as Array<{ x: number; y: number }>;
  const { width, height } = dimensions;
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  const style = { left: `${Math.min(...xs) / width * 100}%`, top: `${Math.min(...ys) / height * 100}%`, width: `${(Math.max(...xs) - Math.min(...xs)) / width * 100}%`, height: `${(Math.max(...ys) - Math.min(...ys)) / height * 100}%` };
  return <span className={styles.overlayBox} style={style}>{index + 1}</span>;
}

function GroupPanel({ group }: { group: Record<string, any> | null }) { if (!group) return <div className={styles.empty}>그룹 정보를 불러오는 중입니다.</div>; return <div className={styles.grid}><Info label="대표 제목" value={group.canonicalTitle} /><Info label="Confidence" value={group.groupConfidence} /><Info label="대표 ProgramCase" value={group.representativeProgramCaseId} /><Info label="Member 수" value={String(group.memberProgramCaseIds.length)} /><article className={styles.wide}><h3>Grouping evidence</h3><TagList values={[...group.groupReasons, ...group.relationshipTypes]} /></article><article className={styles.wide}><h3>Members</h3>{group.memberProgramCaseIds.map((id: string) => <code className={styles.member} key={id}>{id}</code>)}</article></div>; }

function CorpusPanel({ corpus }: { corpus: CorpusPair | null }) { if (!corpus) return <div className={styles.empty}>Corpus 정보를 불러오는 중입니다.</div>; return <div className={styles.corpusGrid}>{(['core', 'safe'] as const).map((mode) => <article key={mode}><div className={styles.corpusHead}><h3>{mode === 'core' ? 'Core-only' : 'Core + Safe Attachment'}</h3><span>{corpus[mode]?.contentHash?.slice(0, 10)}</span></div><h4>Lexical text</h4><pre>{corpus[mode]?.lexicalText}</pre><h4>Dense text</h4><p>{corpus[mode]?.denseText}</p><details><summary>Metadata</summary><pre>{JSON.stringify(corpus[mode]?.metadata, null, 2)}</pre></details></article>)}</div>; }
function Info({ label, value }: { label: string; value: string | null | undefined }) { return <article className={styles.info}><span>{label}</span><strong>{value || '미상'}</strong></article>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className={styles.stat}><span>{label}</span><b>{value}</b></div>; }
function TagList({ values }: { values: string[] }) { return <div className={styles.tags}>{values.map((value) => <span key={value}>{value}</span>)}</div>; }
