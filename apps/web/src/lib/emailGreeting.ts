/** Merge tag the user places in the email body where the greeting should appear. */
export const SALAM_PLACEHOLDER = "{{salam}}";

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

/** Same bold greeting markup everywhere (composer preview + outbound mail). */
export function buildGreetingHtml(name: string | null | undefined): string {
  const text = name?.trim() ? `Salam ${escapeHtml(name.trim())},` : "Salam,";
  return `<b style="font-weight:700;font-family:Arial,Helvetica,sans-serif;">${text}</b>`;
}

/**
 * Replace user-placed {{salam}} tokens. When greeting is off, remove the tokens
 * so raw placeholders never reach the inbox.
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

export function bodyHasSalamPlaceholder(htmlBody: string): boolean {
  return htmlBody.includes(SALAM_PLACEHOLDER);
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
