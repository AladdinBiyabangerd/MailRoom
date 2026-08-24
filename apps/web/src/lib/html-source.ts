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

const DATA_IMAGE_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\r\n]+/g;
const PLACEHOLDER_RE = /^https:\/\/embedded\.invalid\/image-(\d+)\.jpg$/;

export function placeholderForEmbeddedImage(id: number): string {
  return `https://embedded.invalid/image-${id}.jpg`;
}

function nextEmbeddedImageId(map: Map<string, string>): number {
  let max = 0;
  for (const key of map.keys()) {
    const match = key.match(PLACEHOLDER_RE);
    if (match) {
      max = Math.max(max, Number(match[1]));
    }
  }
  return max + 1;
}

/** Show short fake URLs in the HTML tab instead of multi-kilobyte base64 payloads. */
export function collapseEmbeddedImages(
  html: string,
  existing: Map<string, string> = new Map(),
): { collapsed: string; map: Map<string, string> } {
  const map = new Map(existing);
  const inverse = new Map<string, string>();
  for (const [placeholder, dataUrl] of map) {
    inverse.set(dataUrl, placeholder);
  }

  DATA_IMAGE_RE.lastIndex = 0;
  let nextId = nextEmbeddedImageId(map);
  const collapsed = html.replace(DATA_IMAGE_RE, (dataUrl) => {
    const compact = dataUrl.replace(/[\r\n]+/g, "");
    const known = inverse.get(dataUrl) ?? inverse.get(compact);
    if (known) {
      return known;
    }
    const placeholder = placeholderForEmbeddedImage(nextId);
    nextId += 1;
    map.set(placeholder, compact);
    inverse.set(compact, placeholder);
    inverse.set(dataUrl, placeholder);
    return placeholder;
  });
  return { collapsed, map };
}

export function expandEmbeddedImages(html: string, map: Map<string, string>): string {
  let result = html;
  const placeholders = [...map.keys()].sort((a, b) => b.length - a.length);
  for (const placeholder of placeholders) {
    if (!result.includes(placeholder)) {
      continue;
    }
    result = result.split(placeholder).join(map.get(placeholder) ?? placeholder);
  }
  return result;
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
