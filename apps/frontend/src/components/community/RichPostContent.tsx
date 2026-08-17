'use client';

import { isRichPostContent, sanitizeRichPostHtml, richPostHtml } from '@/lib/rich-post-content';

export default function RichPostContent({ content }: { content: string }) {
  if (!isRichPostContent(content)) return <div className="communityDetailContent">{content}</div>;
  const html = sanitizeRichPostHtml(richPostHtml(content));
  return <div className="communityDetailContent richPostContent" dangerouslySetInnerHTML={{ __html: html }} />;
}
