const RICH_CONTENT_PREFIX = '<!--moira-rich-->';

export function isRichPostContent(content: string) { return content.startsWith(RICH_CONTENT_PREFIX); }
export function serializeRichPostContent(html: string) { return `${RICH_CONTENT_PREFIX}${html}`; }
export function richPostHtml(content: string) { return isRichPostContent(content) ? content.slice(RICH_CONTENT_PREFIX.length) : ''; }

export function postContentText(content: string) {
  if (!isRichPostContent(content)) return content;
  return richPostHtml(content)
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>|<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

export function postContentExcerpt(content: string) {
  const firstLine = postContentText(content).split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? '';
  return firstLine.match(/^.*?[.!?。！？](?:\s|$)/)?.[0].trim() ?? firstLine;
}

export function sanitizeRichPostHtml(html: string) {
  if (typeof window === 'undefined') return '';
  const documentNode = new DOMParser().parseFromString(html, 'text/html');
  const allowedTags = new Set(['P', 'DIV', 'BR', 'STRONG', 'B', 'SPAN', 'FONT', 'IMG', 'UL', 'OL', 'LI']);
  const allowedSizes = new Set(['1', '2', '3', '4', '5', '6', '7']);
  for (const element of Array.from(documentNode.body.querySelectorAll('*'))) {
    if (!allowedTags.has(element.tagName)) { element.replaceWith(...Array.from(element.childNodes)); continue; }
    const source = element.getAttribute('src') ?? '';
    const size = element.getAttribute('size') ?? '';
    const color = (element.getAttribute('color') ?? '').toLowerCase();
    for (const attribute of Array.from(element.attributes)) element.removeAttribute(attribute.name);
    if (element instanceof HTMLImageElement) {
      if (!/^data:image\/(png|jpeg|webp);base64,/i.test(source)) { element.remove(); continue; }
      element.setAttribute('src', source); element.setAttribute('alt', '게시글 첨부 이미지');
    }
    if (element.tagName === 'FONT') {
      if (allowedSizes.has(size)) element.setAttribute('size', size);
      if (/^#[0-9a-f]{6}$/.test(color)) element.setAttribute('color', color);
    }
  }
  return documentNode.body.innerHTML;
}
