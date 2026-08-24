export interface ParsedEmailContact {
  email: string;
  name?: string;
}

export interface BulkEmailParseResult {
  contacts: ParsedEmailContact[];
  invalidTokens: string[];
  duplicates: ParsedEmailContact[];
  duplicateCount: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_EXTRACT_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const LIST_MARKER_RE = /^(?:[\s\-–—•*·►→▪▸◦‣]+|\d+[.)]\s*|[a-zA-Z][.)]\s*)/;
const HEADER_LINE_RE =
  /^(name|email|e-?mail|contact|contacts|eposta|e-?poçt|e-?poct|ad|soyad|ad soyad|fullname|full name|mail)(?:\s+(name|email|contact|mail|ad|soyad))*$/i;
const LABEL_PREFIX_RE =
  /^(?:email|e-?mail|to|cc|bcc|contact|eposta|e-?poçt|e-?poct|mail)\s*[:：]\s*/i;

export function parseBulkEmails(raw: string): BulkEmailParseResult {
  if (!raw.trim()) {
    return { contacts: [], invalidTokens: [], duplicates: [], duplicateCount: 0 };
  }

  const preprocessed = preprocessRaw(raw);
  const contacts: ParsedEmailContact[] = [];
  const duplicates: ParsedEmailContact[] = [];
  const seen = new Set<string>();
  const listedDuplicates = new Set<string>();
  const invalidTokens: string[] = [];
  let duplicateCount = 0;

  for (const segment of splitIntoSegments(preprocessed)) {
    if (isHeaderLine(segment)) {
      continue;
    }

    const parsed = parseSegment(segment);
    if (parsed.length === 0) {
      const trimmed = segment.trim();
      if (!trimmed || isHeaderLine(trimmed)) {
        continue;
      }
      if (!trimmed.includes("@") && trimmed.length > 2) {
        invalidTokens.push(truncate(trimmed));
      }
      continue;
    }

    for (const contact of parsed) {
      if (seen.has(contact.email)) {
        duplicateCount += 1;
        if (!listedDuplicates.has(contact.email)) {
          listedDuplicates.add(contact.email);
          duplicates.push(contact);
        }
        continue;
      }
      seen.add(contact.email);
      contacts.push(contact);
    }
  }

  if (contacts.length === 0 && preprocessed.includes("@")) {
    for (const contact of extractEmailsGlobally(preprocessed)) {
      if (seen.has(contact.email)) {
        duplicateCount += 1;
        if (!listedDuplicates.has(contact.email)) {
          listedDuplicates.add(contact.email);
          duplicates.push(contact);
        }
        continue;
      }
      seen.add(contact.email);
      contacts.push(contact);
    }
  }

  return { contacts, invalidTokens, duplicates, duplicateCount };
}

function extractEmailsGlobally(text: string): ParsedEmailContact[] {
  const matches = text.match(EMAIL_EXTRACT_RE) ?? [];
  const contacts: ParsedEmailContact[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const contact = toContact(match, undefined);
    if (!contact || seen.has(contact.email)) continue;
    seen.add(contact.email);
    contacts.push(contact);
  }

  return contacts;
}

function preprocessRaw(raw: string): string {
  let text = raw
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  text = text.replace(
    /<a[^>]+href=["']mailto:([^"'>\s]+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_, email, label) => {
      const cleanLabel = stripHtml(label).trim();
      if (cleanLabel && !cleanLabel.includes("@")) {
        return `${cleanLabel}\t${email}`;
      }
      return email;
    },
  );

  text = text.replace(/mailto:([^\s"'<>]+)/gi, "$1");
  text = text.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*[^>]*>/g, " ");

  return text;
}

function stripHtml(value: string): string {
  return value.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*[^>]*>/g, "").trim();
}

function splitIntoSegments(raw: string): string[] {
  const segments: string[] = [];

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim().replace(LIST_MARKER_RE, "").trim();
    if (!line) continue;

    const tabParsed = parseTabSeparatedLine(line);
    if (tabParsed.length > 0) {
      segments.push(...tabParsed.map(formatContactSegment));
      continue;
    }

    segments.push(...splitLineByDelimiters(line));
  }

  return segments;
}

function formatContactSegment(contact: ParsedEmailContact): string {
  if (contact.name) {
    return `${contact.name} <${contact.email}>`;
  }
  return contact.email;
}

function parseTabSeparatedLine(line: string): ParsedEmailContact[] {
  if (!line.includes("\t")) {
    return [];
  }

  const cols = line.split("\t").map((c) => c.trim()).filter(Boolean);
  if (cols.length < 2) {
    return [];
  }

  const emailColIndex = cols.findIndex((col) => EMAIL_EXTRACT_RE.test(col));
  if (emailColIndex === -1) {
    return [];
  }

  const emailMatch = cols[emailColIndex].match(EMAIL_EXTRACT_RE)?.[0];
  if (!emailMatch) {
    return [];
  }

  const contact = toContact(emailMatch, findNameColumn(cols, emailColIndex));
  return contact ? [contact] : [];
}

function findNameColumn(cols: string[], emailColIndex: number): string | undefined {
  for (let i = 0; i < cols.length; i += 1) {
    if (i === emailColIndex) continue;
    const col = cols[i];
    if (!col || col.includes("@")) continue;
    const cleaned = cleanName(col);
    if (cleaned) return cleaned;
  }
  return undefined;
}

function splitLineByDelimiters(line: string): string[] {
  const emailCount = (line.match(/@/g) ?? []).length;
  if (emailCount <= 1) {
    return [line];
  }

  const delimiterPatterns = [
    /\s*[,;|\t/&\\]+\s*/,
    /\s+(?:and|və|ve|und|et|и|й|или)\s+/iu,
    /\s+[–—-]\s+(?=[^@]*@)/,
    /\s{2,}(?=[^@]*@)/,
  ];

  for (const pattern of delimiterPatterns) {
    const parts = line.split(pattern).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1 && parts.some((p) => p.includes("@"))) {
      return parts;
    }
  }

  const bySpace = line.split(/\s+/).filter((p) => p.includes("@"));
  if (bySpace.length > 1) {
    return bySpace;
  }

  return [line];
}

function parseSegment(segment: string): ParsedEmailContact[] {
  let trimmed = segment.trim().replace(LABEL_PREFIX_RE, "").trim();
  if (!trimmed) return [];

  trimmed = trimmed.replace(/^["']|["']$/g, "");

  const structured = parseStructuredSegment(trimmed);
  if (structured.length > 0) {
    return structured;
  }

  const emails = trimmed.match(EMAIL_EXTRACT_RE) ?? [];
  if (emails.length === 0) {
    return [];
  }

  return emails
    .map((match) => {
      const email = normalizeEmail(match);
      const name = extractName(trimmed, email, match);
      return toContact(email, name);
    })
    .filter((contact): contact is ParsedEmailContact => contact !== null);
}

function parseStructuredSegment(segment: string): ParsedEmailContact[] {
  const attempts: Array<ParsedEmailContact | null> = [
    parseNamedAngle(segment),
    parseNameColonEmail(segment),
    parseEmailParenName(segment),
    parseParenNameEmail(segment),
    parsePipeSeparated(segment),
    parseBracketedEmail(segment),
  ];

  return attempts.filter((contact): contact is ParsedEmailContact => contact !== null);
}

function parseNamedAngle(segment: string): ParsedEmailContact | null {
  const match = segment.match(/^["']?(.+?)["']?\s*<([^>]+)>$/);
  if (!match) return null;
  return toContact(match[2], cleanName(match[1]));
}

function parseNameColonEmail(segment: string): ParsedEmailContact | null {
  const match = segment.match(/^(.+?)\s*[:：]\s*(.+)$/);
  if (!match) return null;

  const left = match[1].trim();
  const right = match[2].trim();
  const rightEmail = right.match(EMAIL_EXTRACT_RE)?.[0];

  if (rightEmail && !left.includes("@")) {
    return toContact(rightEmail, cleanName(left));
  }

  const leftEmail = left.match(EMAIL_EXTRACT_RE)?.[0];
  if (leftEmail && !right.includes("@")) {
    return toContact(leftEmail, cleanName(right));
  }

  return null;
}

function parseEmailParenName(segment: string): ParsedEmailContact | null {
  const match = segment.match(/^<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?\s*[(（]([^)）]+)[)）]$/);
  if (!match) return null;
  return toContact(match[1], cleanName(match[2]));
}

function parseParenNameEmail(segment: string): ParsedEmailContact | null {
  const match = segment.match(/^[(（]([^)）]+)[)）]\s*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?$/);
  if (!match) return null;
  return toContact(match[2], cleanName(match[1]));
}

function parsePipeSeparated(segment: string): ParsedEmailContact | null {
  if (!segment.includes("|")) return null;

  const parts = segment.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 2) return null;

  const firstEmail = parts[0].match(EMAIL_EXTRACT_RE)?.[0];
  const secondEmail = parts[1].match(EMAIL_EXTRACT_RE)?.[0];

  if (firstEmail && !parts[1].includes("@")) {
    return toContact(firstEmail, cleanName(parts[1]));
  }
  if (secondEmail && !parts[0].includes("@")) {
    return toContact(secondEmail, cleanName(parts[0]));
  }

  return null;
}

function parseBracketedEmail(segment: string): ParsedEmailContact | null {
  const match = segment.match(/^[\[\(<?]([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})[\]\)>]?$/);
  if (!match) return null;
  return toContact(match[1], undefined);
}

function toContact(email: string, name?: string): ParsedEmailContact | null {
  const normalized = normalizeEmail(email);
  if (!EMAIL_RE.test(normalized)) {
    return null;
  }
  return { email: normalized, name: name || undefined };
}

function normalizeEmail(email: string): string {
  return stripEmailPunctuation(email.trim().toLowerCase()).replace(/^<|>$/g, "");
}

function stripEmailPunctuation(value: string): string {
  let cleaned = value.replace(/^["'[(<]+/, "").replace(/[)"'>,;:!?]+$/, "");
  if (cleaned.endsWith(".") && cleaned.lastIndexOf("@") < cleaned.length - 2) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned;
}

function cleanName(value: string): string | undefined {
  const cleaned = value
    .replace(/^["'[(<]+|[)"'>\].,;:!?]+$/g, "")
    .trim();
  if (!cleaned || cleaned.includes("@") || HEADER_LINE_RE.test(cleaned)) {
    return undefined;
  }
  return cleaned;
}

function extractName(segment: string, email: string, matchedEmail: string): string | undefined {
  const emailIndex = segment.toLowerCase().indexOf(matchedEmail.toLowerCase());
  if (emailIndex === -1) {
    return undefined;
  }

  const before = segment
    .slice(0, emailIndex)
    .replace(/[<(",\-–—|:;\s]+$/u, "")
    .trim();
  const after = segment
    .slice(emailIndex + matchedEmail.length)
    .replace(/^[>"',\-–—|:;\s()（）]+/u, "")
    .replace(/^[(（]([^)）]+)[)）]$/u, "$1")
    .trim();

  return cleanName(before) ?? cleanName(after);
}

function isHeaderLine(segment: string): boolean {
  const trimmed = segment.trim().toLowerCase();
  if (
    /^(e-mail|email|name|contact|contacts|mail|ad|soyad|eposta|e-poçt|e-poct)$/.test(trimmed)
  ) {
    return true;
  }

  const normalized = segment
    .replace(/[\t|,/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return HEADER_LINE_RE.test(normalized);
}

function truncate(value: string, max = 80): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

export function formatInvalidToken(token: string, emptyLabel: string): string {
  if (!token) return emptyLabel;
  if (!token.trim()) return emptyLabel;
  if (!/\S/.test(token)) return `${emptyLabel} (${token.length})`;
  return token;
}
