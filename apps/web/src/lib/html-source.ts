export function isFullHtmlDocument(html: string): boolean {
  const trimmed = html.trim();
  return /<!DOCTYPE\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
}

export function looksLikeHtmlSource(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("<")) {
    return false;
  }
  if (isFullHtmlDocument(trimmed)) {
    return true;
  }
  return /<[a-z][^>]*>[\s\S]*<\/[a-z]+>/i.test(trimmed) || /<(img|table|div|section|span|p|h[1-6]|br|hr)\b/i.test(trimmed);
}

export function htmlHasVisibleContent(html: string): boolean {
  const trimmed = html.trim();
  if (!trimmed) {
    return false;
  }
  const doc = new DOMParser().parseFromString(trimmed, "text/html");
  const text = doc.body.textContent?.trim() ?? "";
  if (text.length > 0) {
    return true;
  }
  return /<(img|table|svg|video|iframe|html)\b/i.test(trimmed);
}
