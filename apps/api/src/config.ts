import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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

function env(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

function envInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
}

export function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = encodeURIComponent(env("PGUSER", "mailroom"));
  const password = encodeURIComponent(env("PGPASSWORD", "mailroom"));
  const host = env("PGHOST", "localhost");
  const port = env("PGPORT", "5432");
  const database = env("PGDATABASE", "mailroom");
  return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=public`;
}

process.env.DATABASE_URL = buildDatabaseUrl();

export const config = {
  port: envInt("PORT", 8090),
  nodeEnv: env("NODE_ENV", "development"),
  isProd: env("NODE_ENV", "development") === "production",
  databaseUrl: process.env.DATABASE_URL,
  appSecretKey: env(
    "APP_SECRET_KEY",
    "change-me-to-a-long-secret-at-least-sixty-four-bytes-long-please",
  ),
  cookieSecure: envBool("COOKIE_SECURE", false),
  cookieSameSite: (env("COOKIE_SAME_SITE", "Lax") as "Lax" | "Strict" | "None") || "Lax",
  publicBaseUrl: env("ADMIN_PUBLIC_BASE_URL", "http://localhost:8090"),
  bootstrap: {
    enabled: envBool("ADMIN_BOOTSTRAP_ENABLED", true),
    email: env("ADMIN_BOOTSTRAP_EMAIL", "admin@mailroom.local"),
    password: env("ADMIN_BOOTSTRAP_PASSWORD", "Admin123"),
    firstName: env("ADMIN_BOOTSTRAP_FIRST_NAME", "Mail"),
    lastName: env("ADMIN_BOOTSTRAP_LAST_NAME", "Room"),
  },
  mail: {
    host: env("MAIL_HOST"),
    port: envInt("MAIL_PORT", 587),
    username: env("MAIL_USERNAME"),
    password: env("MAIL_PASSWORD"),
    from: env("ADMIN_MAIL_FROM"),
  },
  accessTokenTtlMinutes: envInt("ADMIN_ACCESS_TOKEN_TTL_MINUTES", 480),
  refreshTokenValidityDays: envInt("ADMIN_REFRESH_TOKEN_VALIDITY_DAYS", 7),
  passwordResetExpirationMinutes: envInt("ADMIN_PASSWORD_RESET_EXPIRATION_MINUTES", 15),
  corsOriginPatterns: env(
    "ADMIN_CORS_ALLOWED_ORIGIN_PATTERNS",
    "http://localhost:*,http://127.0.0.1:*",
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  limits: {
    maxRecipients: 500,
    maxAttachments: 5,
    maxAttachmentBytes: 10 * 1024 * 1024,
    maxSubjectLength: 200,
    maxHtmlBodyLength: 5_000_000,
  },
};

export function originAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  return config.corsOriginPatterns.some((pattern) => {
    if (pattern.endsWith("*")) {
      return origin.startsWith(pattern.slice(0, -1));
    }
    return origin === pattern;
  });
}
