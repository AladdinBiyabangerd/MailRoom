export function isFullHtmlDocument(html: string): boolean {
  const trimmed = html.trim();
  return /<!DOCTYPE\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed);
}

export function asFullHtmlDocument(html: string): string {
  const trimmed = html.trim();
  if (!trimmed) {
    return `<!DOCTYPE html>\n<html><head><meta charset="utf-8"></head><body></body></html>`;
  }
  if (isFullHtmlDocument(trimmed)) {
    return trimmed;
  }
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>${trimmed}</body>
</html>`;
}

export function shouldUseDocumentEditor(html: string): boolean {
  return isFullHtmlDocument(html) || /<img\b/i.test(html);
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
  return /<(img|table|svg|video|iframe)\b/i.test(trimmed);
}
