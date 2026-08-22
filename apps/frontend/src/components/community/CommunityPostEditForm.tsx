'use client';

import Link from 'next/link';
import { ChangeEvent, CSSProperties, FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isRichPostContent, postContentText, richPostHtml, sanitizeRichPostHtml, serializeRichPostContent } from '@/lib/rich-post-content';

type EditablePost = { id: string; boardSlug: string; type: string; title: string; content: string; tags: string[]; isOwner: boolean };
const categories = ['공지', '모집', '행사', '프로그램'] as const;
const colors = ['#1f2937', '#136f63', '#b45309', '#b42318', '#6d5cae'] as const;

async function fetchEditablePost(postId: string) {
  const response = await fetch(`/api/posts/${encodeURIComponent(postId)}`, { cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '게시글을 불러오지 못했습니다.');
  return data.post as EditablePost;
}

export default function CommunityPostEditForm({ postId }: { postId: string }) {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [post, setPost] = useState<EditablePost | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [category, setCategory] = useState<(typeof categories)[number]>('모집');
  const [tags, setTags] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEditablePost(postId).then((data) => {
      setPost(data); setTitle(data.title);
      const selectedCategory = data.type === 'notice' ? '공지' : categories.find((item) => data.tags.includes(item)) ?? '모집';
      setCategory(selectedCategory);
      setTags(data.tags.filter((tag) => !categories.includes(tag as typeof categories[number])).join(', '));
      const editorContent = isRichPostContent(data.content) ? richPostHtml(data.content) : escapeHtml(data.content).replace(/\n/g, '<br>');
      setContent(editorContent); setInitialContent(editorContent);
    }).catch((error) => setMessage(error.message));
  }, [postId]);

  useEffect(() => {
    if (post?.boardSlug !== 'library-news' || !editorRef.current) return;
    editorRef.current.innerHTML = sanitizeRichPostHtml(initialContent);
  }, [initialContent, post?.boardSlug]);

  function applyFormat(command: string, value?: string) {
    editorRef.current?.focus(); document.execCommand(command, false, value); setContent(editorRef.current?.innerHTML ?? '');
  }

  async function attachImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setMessage('JPG, PNG, WEBP 이미지만 첨부할 수 있습니다.');
    if (file.size > 5 * 1024 * 1024) return setMessage('이미지는 5MB 이하만 첨부할 수 있습니다.');
    try { const source = await resizeImage(file); editorRef.current?.focus(); document.execCommand('insertImage', false, source); setContent(editorRef.current?.innerHTML ?? ''); setMessage(''); }
    catch { setMessage('이미지를 첨부하지 못했습니다.'); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!post) return;
    if (!post.isOwner && !password) return setMessage('작성할 때 사용한 게시글 비밀번호를 입력해 주세요.');
    setIsSubmitting(true); setMessage('');
    const isLibraryNews = post.boardSlug === 'library-news';
    const currentContent = isLibraryNews ? (editorRef.current?.innerHTML ?? content) : content;
    const response = await fetch(`/api/posts/${encodeURIComponent(postId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), content: isLibraryNews ? serializeRichPostContent(sanitizeRichPostHtml(currentContent)) : currentContent.trim(), type: isLibraryNews ? (category === '공지' ? 'notice' : 'normal') : undefined, tags: isLibraryNews ? [category, ...tags.split(',').map((tag) => tag.trim()).filter(Boolean)] : undefined, password: post.isOwner ? undefined : password }),
    });
    const data = await response.json();
    if (!response.ok) { setMessage(response.status === 403 ? '게시글 비밀번호가 올바르지 않습니다.' : data.error || '게시글을 수정하지 못했습니다.'); setIsSubmitting(false); return; }
    router.push(`/community/posts/${encodeURIComponent(postId)}`); router.refresh();
  }

  if (!post) return <main className="communityDetailPage"><p className="communityDetailState">{message || '게시글을 불러오는 중입니다.'}</p></main>;
  if (post.boardSlug !== 'library-news') return <LegacyEditForm post={post} title={title} content={content} password={password} message={message} isSubmitting={isSubmitting} setTitle={setTitle} setContent={setContent} setPassword={setPassword} submit={submit} />;

  const textLength = postContentText(serializeRichPostContent(content)).length;
  return <main className="libraryNewsWritePage"><div className="libraryNewsWriteShell">
    <nav className="libraryNewsWriteBreadcrumb" aria-label="현재 위치"><Link href="/">홈</Link><span>›</span><Link href="/community/library-news">도서관 소식</Link><span>›</span><strong>게시글 수정</strong></nav>
    <header className="libraryNewsWriteHeader"><div><p>LIBRARY NEWS</p><h1 id="post-edit-title">소식 수정</h1><span>등록한 소식의 내용을 확인하고 필요한 부분을 수정하세요.</span></div></header>
    <form className="libraryNewsComposer" onSubmit={submit} aria-labelledby="post-edit-title">
      <section className="libraryNewsComposerSection libraryNewsComposerBasics">
        <div className="libraryNewsComposerField isCategory"><label htmlFor="edit-post-category">분류 <em>필수</em></label><select id="edit-post-category" value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="libraryNewsComposerField"><label htmlFor="edit-post-title-input">제목 <em>필수</em></label><div className="libraryNewsTitleInput"><input id="edit-post-title-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required /><small>{title.length}/100</small></div></div>
      </section>
      <section className="libraryNewsComposerSection">
        <div className="libraryNewsComposerHeading"><div><label htmlFor="edit-post-content">본문 <em>필수</em></label><p>내용을 선택한 뒤 서식 도구를 적용할 수 있습니다.</p></div><span>{textLength.toLocaleString()}자</span></div>
        <div className="libraryNewsEditorFrame"><div className="libraryNewsEditorToolbar" role="toolbar" aria-label="본문 서식 도구">
          <div className="libraryNewsToolbarGroup"><select defaultValue="3" onChange={(event) => applyFormat('fontSize', event.target.value)} aria-label="글씨 크기"><option value="2">작게</option><option value="3">본문</option><option value="4">큰 본문</option><option value="5">제목</option></select><button className="isBold" type="button" onClick={() => applyFormat('bold')} aria-label="굵게">B</button></div>
          <span className="libraryNewsToolbarDivider" aria-hidden="true" />
          <div className="libraryNewsColorPalette" aria-label="글씨 색상">{colors.map((color, index) => <button type="button" key={color} style={{ '--editor-color': color } as CSSProperties} onClick={() => applyFormat('foreColor', color)} aria-label={`글씨 색상 ${index + 1}`} />)}</div>
          <button className="libraryNewsImageButton" type="button" onClick={() => imageInputRef.current?.click()}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 4"/></svg>사진 첨부</button>
          <input ref={imageInputRef} className="libraryNewsHiddenInput" type="file" accept="image/png,image/jpeg,image/webp" onChange={attachImage} />
        </div><div id="edit-post-content" key={post.id} ref={editorRef} className="libraryNewsRichEditor" contentEditable role="textbox" aria-multiline="true" onInput={(event) => setContent(event.currentTarget.innerHTML)} suppressContentEditableWarning /><footer><span>JPG, PNG, WEBP</span><span>이미지당 최대 5MB</span></footer></div>
      </section>
      <section className="libraryNewsComposerSection libraryNewsTagSection"><div className="libraryNewsComposerField"><label htmlFor="edit-post-tags">태그 <span>선택</span></label><input id="edit-post-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="예: 여름방학, 초등학생, 독서모임" /><small>쉼표로 구분하면 여러 태그를 등록할 수 있습니다.</small></div></section>
      {message ? <p className="libraryNewsComposerError" role="alert">{message}</p> : null}
      <footer className="libraryNewsComposerActions"><p><strong>수정한 내용을 다시 확인해 주세요.</strong><span>저장 후 게시글 상세 화면으로 이동합니다.</span></p><div><Link href={`/community/posts/${encodeURIComponent(postId)}`}>취소</Link><button type="submit" disabled={isSubmitting || !title.trim() || !textLength}>{isSubmitting ? '저장 중…' : '수정 완료'}</button></div></footer>
    </form>
  </div></main>;
}

function LegacyEditForm({ post, title, content, password, message, isSubmitting, setTitle, setContent, setPassword, submit }: { post: EditablePost; title: string; content: string; password: string; message: string; isSubmitting: boolean; setTitle: (value: string) => void; setContent: (value: string) => void; setPassword: (value: string) => void; submit: (event: FormEvent) => void }) {
  return <main className="communityPage communityWritePage"><section className="uiContainer communityShell"><header className="communityBoardHeader"><h1>게시글 수정</h1><p>작성한 내용을 확인하고 필요한 부분을 수정해 주세요.</p></header><form className="communityWriteForm" onSubmit={submit}><label className="communityWriteField"><span>제목</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required /></label><label className="communityWriteField"><span>내용</span><textarea value={content} onChange={(event) => setContent(event.target.value)} rows={14} required /></label>{!post.isOwner ? <label className="communityWriteField"><span>게시글 비밀번호</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label> : null}{message ? <p className="communityWriteError">{message}</p> : null}<div className="communityWriteActions"><Link href={`/community/posts/${post.id}`}>취소</Link><button disabled={isSubmitting}>수정 완료</button></div></form></section></main>;
}

function escapeHtml(value: string) { return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }
function resizeImage(file: File) { return new Promise<string>((resolve, reject) => { const image = new Image(); const source = URL.createObjectURL(file); image.onload = () => { const scale = Math.min(1, 1200 / image.width); const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(source); resolve(canvas.toDataURL('image/jpeg', .78)); }; image.onerror = () => { URL.revokeObjectURL(source); reject(new Error('이미지를 불러오지 못했습니다.')); }; image.src = source; }); }
