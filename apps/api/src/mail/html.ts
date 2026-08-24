export function isPubliclyReachableBaseUrl(publicBaseUrl: string | undefined): boolean {
  if (!publicBaseUrl?.trim()) return false;
  try {
    const host = new URL(publicBaseUrl.trim()).hostname.toLowerCase();
    if (!host) return false;
    return (
      host !== "localhost" &&
      host !== "127.0.0.1" &&
      host !== "[::1]" &&
      host !== "::1" &&
      !host.endsWith(".local")
    );
  } catch {
    return false;
  }
}

function stripSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Treat blank or email-as-label as no display name. */
export function resolveGreetingName(
  name: string | null | undefined,
  email?: string | null,
): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  if (email && trimmed.toLowerCase() === email.trim().toLowerCase()) return null;
  return trimmed;
}

export const SALAM_PLACEHOLDER = "{{salam}}";

/** Same bold greeting markup everywhere (preview + outbound mail). */
export function buildGreetingHtml(name: string | null | undefined): string {
  const text = name?.trim() ? `Salam ${escapeHtml(name.trim())},` : "Salam,";
  return `<b style="font-weight:700;font-family:Arial,Helvetica,sans-serif;">${text}</b>`;
}

/**
 * Replace user-placed {{salam}} tokens. When greeting is off, remove the tokens.
 * Placement is entirely controlled by where the user put the placeholder.
 */
export function applyPersonalizedGreeting(
  htmlBody: string,
  name: string | null | undefined,
  enabled = true,
): string {
  if (!htmlBody || !htmlBody.includes(SALAM_PLACEHOLDER)) return htmlBody;
  if (!enabled) {
    return htmlBody.split(SALAM_PLACEHOLDER).join("");
  }
  return htmlBody.split(SALAM_PLACEHOLDER).join(buildGreetingHtml(name));
}

/** @deprecated Use applyPersonalizedGreeting — kept for older call sites during transition. */
export function withPersonalizedGreeting(
  htmlBody: string,
  name: string | null | undefined,
  _insideHtml = true,
): string {
  return applyPersonalizedGreeting(htmlBody, name, true);
}

export function withTrackingPixel(htmlBody: string, trackingToken: string, publicBaseUrl: string): string {
  if (!isPubliclyReachableBaseUrl(publicBaseUrl) || !htmlBody || !trackingToken) return htmlBody;
  const base = stripSlash(publicBaseUrl);
  const pixel = `<img src="${base}/public/v1/emails/open/${trackingToken}" width="1" height="1" alt="" style="display:none!important;max-height:1px;max-width:1px;border:0;" />`;
  const lower = htmlBody.toLowerCase();
  const bodyClose = lower.lastIndexOf("</body>");
  if (bodyClose >= 0) return htmlBody.slice(0, bodyClose) + pixel + htmlBody.slice(bodyClose);
  return htmlBody + pixel;
}

export function withUnsubscribeFooter(htmlBody: string, unsubscribeToken: string, publicBaseUrl: string): string {
  if (!isPubliclyReachableBaseUrl(publicBaseUrl) || !htmlBody || !unsubscribeToken) return htmlBody;
  const url = unsubscribeUrl(unsubscribeToken, publicBaseUrl);
  const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:center;"><p>If you no longer wish to receive these emails, <a href="${url}">unsubscribe here</a>.</p></div>`;
  const lower = htmlBody.toLowerCase();
  const bodyClose = lower.lastIndexOf("</body>");
  if (bodyClose >= 0) return htmlBody.slice(0, bodyClose) + footer + htmlBody.slice(bodyClose);
  return htmlBody + footer;
}

export function unsubscribeUrl(unsubscribeToken: string, publicBaseUrl: string): string | null {
  if (!isPubliclyReachableBaseUrl(publicBaseUrl) || !unsubscribeToken) return null;
  return `${stripSlash(publicBaseUrl)}/public/v1/emails/unsubscribe/${unsubscribeToken}`;
}

export interface InlineImage {
  contentId: string;
  contentType: string;
  content: Buffer;
}

const DATA_IMG =
  /(<img\b[^>]*?\bsrc\s*=\s*)(["'])(data:image\/([a-z0-9.+-]+);base64,([^"']+))\2/gi;

export function embedInlineImages(html: string): { html: string; images: InlineImage[] } {
  if (!html?.includes("data:image/")) return { html, images: [] };
  const images: InlineImage[] = [];
  let index = 1;
  const rewritten = html.replace(DATA_IMG, (full, prefix: string, quote: string, _data, subtype: string, b64: string) => {
    if (subtype.toLowerCase().includes("svg")) return full;
    try {
      const bytes = Buffer.from(b64.replace(/\s+/g, ""), "base64");
      if (!bytes.length) return full;
      const contentId = `inline-img-${index++}`;
      images.push({ contentId, contentType: `image/${subtype.toLowerCase()}`, content: bytes });
      return `${prefix}${quote}cid:${contentId}${quote}`;
    } catch {
      return full;
    }
  });
  return { html: rewritten, images };
}

export function formatFromLabel(displayName: string | null | undefined, email: string): string {
  if (displayName?.trim()) return `${displayName.trim()} <${email}>`;
  return email;
}
