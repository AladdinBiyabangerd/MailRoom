/**
 * One-off import of legacy notifications_ms contacts into Mailroom address book.
 *
 * Maps email + name + labels (company is intentionally ignored).
 *
 * Usage (from apps/api):
 *   npx tsx scripts/import-legacy-contacts.ts /path/to/mysql-backup.sql
 *   npx tsx scripts/import-legacy-contacts.ts /path/to/mysql-backup.sql --commit
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

function loadDotEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const raw of readFileSync(file, "utf8").split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadDotEnv();

/** Keep Railway public proxy from dropping long import runs. */
function withProxyFriendlyDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "60");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "60");
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "1");
    return u.toString();
  } catch {
    return url;
  }
}

process.env.DATABASE_URL = withProxyFriendlyDatabaseUrl(process.env.DATABASE_URL);

const prisma = new PrismaClient({
  datasources: process.env.DATABASE_URL
    ? { db: { url: process.env.DATABASE_URL } }
    : undefined,
});

const BATCH = 100;

function splitSqlValues(s: string): string[][] {
  const rows: string[][] = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    while (i < n && " \n\r\t,".includes(s[i]!)) i += 1;
    if (i >= n || s[i] !== "(") break;
    i += 1;
    const fields: string[] = [];
    let cur = "";
    let inStr = false;
    let esc = false;
    let depth = 0;
    while (i < n) {
      const ch = s[i]!;
      if (inStr) {
        cur += ch;
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === "'") {
          if (i + 1 < n && s[i + 1] === "'") {
            cur += s[i + 1];
            i += 2;
            continue;
          }
          inStr = false;
        }
        i += 1;
        continue;
      }
      if (ch === "'") {
        inStr = true;
        cur += ch;
        i += 1;
        continue;
      }
      if (ch === "(") {
        depth += 1;
        cur += ch;
        i += 1;
        continue;
      }
      if (ch === ")" && depth) {
        depth -= 1;
        cur += ch;
        i += 1;
        continue;
      }
      if (ch === "," && depth === 0) {
        fields.push(cur.trim());
        cur = "";
        i += 1;
        continue;
      }
      if (ch === ")" && depth === 0) {
        fields.push(cur.trim());
        i += 1;
        break;
      }
      cur += ch;
      i += 1;
    }
    rows.push(fields);
  }
  return rows;
}

function unquote(v: string | undefined): string | null {
  if (v == null) return null;
  const s = v.trim();
  if (!s || s.toUpperCase() === "NULL") return null;
  if (s.startsWith("'") && s.endsWith("'")) {
    return s
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/''/g, "'");
  }
  return s;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function extractSection(sql: string, dbName: string): string {
  const start = sql.indexOf(`USE \`${dbName}\``);
  if (start < 0) throw new Error(`Database ${dbName} not found in dump`);
  const rest = sql.slice(start);
  const next = rest.slice(10).search(/\nUSE `/);
  return next < 0 ? rest : rest.slice(0, next + 10);
}

function extractInsertValues(section: string, table: string): string {
  const re = new RegExp(`INSERT INTO \`${table}\`[^;]*VALUES\\s*([\\s\\S]*?);`, "i");
  const m = section.match(re);
  if (!m?.[1]) throw new Error(`No INSERT for ${table}`);
  return m[1];
}

type LegacyContact = {
  id: number;
  email: string;
  name: string | null;
  primaryLabel: string | null;
  labels: Set<string>;
};

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error(
      "Usage: npx tsx scripts/import-legacy-contacts.ts <mysql-backup.sql> [--commit]",
    );
    process.exit(1);
  }

  const sql = readFileSync(file, "utf8");
  const section = extractSection(sql, "notifications_ms");

  const contactRows = splitSqlValues(extractInsertValues(section, "contacts"));
  const contacts = new Map<number, LegacyContact>();
  for (const r of contactRows) {
    const id = Number(r[0]);
    const emailRaw = unquote(r[2]);
    if (!emailRaw || !emailRaw.includes("@")) continue;
    const first = unquote(r[3]) ?? "";
    const last = unquote(r[4]) ?? "";
    const name = `${first} ${last}`.trim() || null;
    const primaryLabel = unquote(r[7]);
    const labels = new Set<string>();
    if (primaryLabel) labels.add(primaryLabel);
    contacts.set(id, {
      id,
      email: normalizeEmail(emailRaw),
      name: name ? name.slice(0, 120) : null,
      primaryLabel,
      labels,
    });
  }

  try {
    const labelRows = splitSqlValues(extractInsertValues(section, "contact_labels"));
    for (const r of labelRows) {
      const id = Number(r[0]);
      const label = unquote(r[1]);
      const c = contacts.get(id);
      if (!c || !label) continue;
      c.labels.add(label);
    }
  } catch {
    console.warn("contact_labels INSERT not found — using primary label only");
  }

  // Deduplicate by email (keep first, merge labels)
  const byEmail = new Map<string, LegacyContact>();
  for (const c of contacts.values()) {
    const existing = byEmail.get(c.email);
    if (!existing) {
      byEmail.set(c.email, c);
      continue;
    }
    for (const l of c.labels) existing.labels.add(l);
    if (!existing.name && c.name) existing.name = c.name;
  }

  const allLabels = new Set<string>();
  for (const c of byEmail.values()) for (const l of c.labels) allLabels.add(l);

  console.log(
    `${commit ? "COMMIT" : "DRY RUN"}: ${byEmail.size} contacts, ${allLabels.size} labels`,
  );
  console.log(
    "Labels:",
    [...allLabels].sort().join(", ") || "(none)",
  );

  if (!commit) {
    console.log("Re-run with --commit to write into Mailroom DB.");
    return;
  }

  // --- labels (few rows) ---
  const labelIdByName = new Map<string, number>();
  const existingLabels = await prisma.emailLabel.findMany();
  for (const row of existingLabels) {
    labelIdByName.set(row.name.toLowerCase(), row.id);
  }
  const missingLabels = [...allLabels].filter((n) => !labelIdByName.has(n.toLowerCase()));
  if (missingLabels.length) {
    await prisma.emailLabel.createMany({
      data: missingLabels.map((name) => ({ name })),
      skipDuplicates: true,
    });
    const refreshed = await prisma.emailLabel.findMany();
    labelIdByName.clear();
    for (const row of refreshed) {
      labelIdByName.set(row.name.toLowerCase(), row.id);
    }
  }
  console.log(`Labels ready: ${labelIdByName.size}`);

  // --- contacts: prefetch, then batch-create missing ---
  const existingContacts = await prisma.emailAddressBookContact.findMany({
    select: { id: true, email: true, name: true },
  });
  const contactIdByEmail = new Map(
    existingContacts.map((c) => [c.email.toLowerCase(), { id: c.id, name: c.name }] as const),
  );

  const toCreate: { email: string; name: string | null }[] = [];
  const toRename: { id: number; name: string }[] = [];
  for (const c of byEmail.values()) {
    const existing = contactIdByEmail.get(c.email);
    if (!existing) {
      toCreate.push({ email: c.email, name: c.name });
      continue;
    }
    if (c.name && c.name !== (existing.name ?? null)) {
      toRename.push({ id: existing.id, name: c.name });
    }
  }

  for (let i = 0; i < toCreate.length; i += BATCH) {
    const chunk = toCreate.slice(i, i + BATCH);
    await prisma.emailAddressBookContact.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    console.log(`  created contacts ${Math.min(i + BATCH, toCreate.length)}/${toCreate.length}`);
  }

  for (let i = 0; i < toRename.length; i += BATCH) {
    const chunk = toRename.slice(i, i + BATCH);
    await prisma.$transaction(
      chunk.map((row) =>
        prisma.emailAddressBookContact.update({
          where: { id: row.id },
          data: { name: row.name },
        }),
      ),
    );
  }

  const allContacts = await prisma.emailAddressBookContact.findMany({
    select: { id: true, email: true },
  });
  contactIdByEmail.clear();
  for (const row of allContacts) {
    contactIdByEmail.set(row.email.toLowerCase(), { id: row.id, name: null });
  }

  // --- label links: replace in batches ---
  const linkRows: { contactId: number; labelId: number }[] = [];
  const contactIds: number[] = [];
  for (const c of byEmail.values()) {
    const contact = contactIdByEmail.get(c.email);
    if (!contact) continue;
    contactIds.push(contact.id);
    for (const name of c.labels) {
      const labelId = labelIdByName.get(name.toLowerCase());
      if (labelId == null) continue;
      linkRows.push({ contactId: contact.id, labelId });
    }
  }

  for (let i = 0; i < contactIds.length; i += BATCH) {
    const ids = contactIds.slice(i, i + BATCH);
    await prisma.emailContactLabel.deleteMany({ where: { contactId: { in: ids } } });
  }
  for (let i = 0; i < linkRows.length; i += BATCH) {
    const chunk = linkRows.slice(i, i + BATCH);
    await prisma.emailContactLabel.createMany({ data: chunk, skipDuplicates: true });
    console.log(`  label links ${Math.min(i + BATCH, linkRows.length)}/${linkRows.length}`);
  }

  console.log(
    `Done. contacts created=${toCreate.length} renamed=${toRename.length} label_links=${linkRows.length}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
