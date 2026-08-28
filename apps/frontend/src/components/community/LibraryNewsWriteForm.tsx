'use client';

import Link from 'next/link';
import { ChangeEvent, CSSProperties, FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { postContentText, sanitizeRichPostHtml, serializeRichPostContent } from '@/lib/rich-post-content';

const categories = ['공지', '모집', '행사', '프로그램'] as const;
const colors = ['#1f2937', '#136f63', '#b45309', '#b42318', '#6d5cae'] as const;

export default function LibraryNewsWriteForm() {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<(typeof categories)[number]>('모집');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function applyFormat(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setContent(editorRef.current?.innerHTML ?? '');
  }

  async function attachImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setMessage('JPG, PNG, WEBP 이미지만 첨부할 수 있습니다.');
    if (file.size > 5 * 1024 * 1024) return setMessage('이미지는 5MB 이하만 첨부할 수 있습니다.');
    try {
      const source = await resizeImage(file); editorRef.current?.focus(); document.execCommand('insertImage', false, source);
      setContent(editorRef.current?.innerHTML ?? ''); setMessage('');
    } catch { setMessage('이미지를 첨부하지 못했습니다.'); }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(''); setIsSubmitting(true);
    try {
      const currentContent = editorRef.current?.innerHTML ?? content;
      const response = await fetch('/api/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boardSlug: 'library-news', type: category === '공지' ? 'notice' : 'normal', title: title.trim(), content: serializeRichPostContent(sanitizeRichPostHtml(currentContent)), tags: [category, ...tags.split(',').map((tag) => tag.trim()).filter(Boolean)] }) });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 401 ? '로그인 후 작성해 주세요.' : data.error || '게시글을 등록하지 못했습니다.');
      router.push(`/community/posts/${encodeURIComponent(data.post.id)}`); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : '게시글을 등록하지 못했습니다.'); setIsSubmitting(false); }
  }

  const textLength = postContentText(serializeRichPostContent(content)).length;
  return (
    <form className="libraryNewsComposer" onSubmit={handleSubmit} aria-labelledby="library-news-write-title">
      <section className="libraryNewsComposerSection libraryNewsComposerBasics">
        <div className="libraryNewsComposerField isCategory"><label htmlFor="library-news-category">분류 <em>필수</em></label><select id="library-news-category" value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>{categories.map((item) => <option key={item}>{item}</option>)}</select></div>
        <div className="libraryNewsComposerField"><label htmlFor="library-news-title">제목 <em>필수</em></label><div className="libraryNewsTitleInput"><input id="library-news-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} placeholder="소식의 핵심 내용을 입력해 주세요" required autoFocus /><small>{title.length}/100</small></div></div>
      </section>

      <section className="libraryNewsComposerSection">
        <div className="libraryNewsComposerHeading"><div><label htmlFor="library-news-content">본문 <em>필수</em></label><p>내용을 선택한 뒤 서식 도구를 적용할 수 있습니다.</p></div><span>{textLength.toLocaleString()}자</span></div>
        <div className="libraryNewsEditorFrame">
          <div className="libraryNewsEditorToolbar" role="toolbar" aria-label="본문 서식 도구">
            <div className="libraryNewsToolbarGroup"><select defaultValue="3" onChange={(event) => applyFormat('fontSize', event.target.value)} aria-label="글씨 크기"><option value="2">작게</option><option value="3">본문</option><option value="4">큰 본문</option><option value="5">제목</option></select><button className="isBold" type="button" onClick={() => applyFormat('bold')} aria-label="굵게">B</button></div>
            <span className="libraryNewsToolbarDivider" aria-hidden="true" />
            <div className="libraryNewsColorPalette" aria-label="글씨 색상">{colors.map((color, index) => <button type="button" key={color} style={{ '--editor-color': color } as CSSProperties} onClick={() => applyFormat('foreColor', color)} aria-label={`글씨 색상 ${index + 1}`} />)}</div>
            <button className="libraryNewsImageButton" type="button" onClick={() => imageInputRef.current?.click()}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 4"/></svg>사진 첨부</button>
            <input ref={imageInputRef} className="libraryNewsHiddenInput" type="file" accept="image/png,image/jpeg,image/webp" onChange={attachImage} />
          </div>
          <div id="library-news-content" ref={editorRef} className="libraryNewsRichEditor" contentEditable role="textbox" aria-multiline="true" data-placeholder={'내용을 입력해 주세요.\n\n행사 일시, 장소, 참여 방법처럼 주민에게 필요한 정보를 포함하면 좋습니다.'} onInput={(event) => setContent(event.currentTarget.innerHTML)} suppressContentEditableWarning />
          <footer><span>JPG, PNG, WEBP</span><span>이미지당 최대 5MB</span></footer>
        </div>
      </section>

      <section className="libraryNewsComposerSection libraryNewsTagSection"><div className="libraryNewsComposerField"><label htmlFor="library-news-tags">태그 <span>선택</span></label><input id="library-news-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="예: 여름방학, 초등학생, 독서모임" /><small>쉼표로 구분하면 여러 태그를 등록할 수 있습니다.</small></div></section>
      {message ? <p className="libraryNewsComposerError" role="alert">{message}</p> : null}
      <footer className="libraryNewsComposerActions"><p><strong>게시 전 내용을 다시 확인해 주세요.</strong><span>등록 후 게시글 상세 화면에서 확인할 수 있습니다.</span></p><div><Link href="/community/library-news">취소</Link><button type="submit" disabled={isSubmitting || !title.trim() || !textLength}>{isSubmitting ? '등록 중…' : '소식 등록하기'}</button></div></footer>
    </form>
  );
}

function resizeImage(file: File) {
  return new Promise<string>((resolve, reject) => { const image = new Image(); const source = URL.createObjectURL(file); image.onload = () => { const scale = Math.min(1, 1200 / image.width); const canvas = document.createElement('canvas'); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale); canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(source); resolve(canvas.toDataURL('image/jpeg', .78)); }; image.onerror = () => { URL.revokeObjectURL(source); reject(new Error('이미지를 불러오지 못했습니다.')); }; image.src = source; });
}
