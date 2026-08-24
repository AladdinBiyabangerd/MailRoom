/** Resolve a display name suitable for "Salam {name}," — ignore blank or email-as-label. */
export function resolveGreetingName(
  name: string | null | undefined,
  email?: string | null,
): string | null {
  const trimmed = name?.trim();
  if (!trimmed) return null;
  if (email && trimmed.toLowerCase() === email.trim().toLowerCase()) return null;
  return trimmed;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Prepend personalized Salam greeting — mirrors API mail/html.ts. */
export function withPersonalizedGreeting(
  htmlBody: string,
  name: string | null | undefined,
): string {
  if (!htmlBody) return htmlBody;
  const greeting = name?.trim()
    ? `<p>Salam ${escapeHtml(name.trim())},</p>`
    : `<p>Salam,</p>`;

  const bodyOpen = htmlBody.match(/<body\b[^>]*>/i);
  if (bodyOpen && bodyOpen.index != null) {
    const insertAt = bodyOpen.index + bodyOpen[0].length;
    return htmlBody.slice(0, insertAt) + greeting + htmlBody.slice(insertAt);
  }
  return greeting + htmlBody;
}

export function buildRecipientNames(
  recipients: { email: string; label?: string }[],
): Record<string, string> {
  const names: Record<string, string> = {};
  for (const r of recipients) {
    const email = r.email.trim().toLowerCase();
    const name = resolveGreetingName(r.label, email);
    if (name) names[email] = name;
  }
  return names;
}
