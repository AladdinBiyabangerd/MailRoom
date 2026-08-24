import nodemailer from "nodemailer";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { embedInlineImages } from "./html.js";

export interface SmtpSettings {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface FromAddress {
  email: string;
  displayName?: string | null;
}

function isCompleteSmtp(host?: string | null, username?: string | null, password?: string | null) {
  return Boolean(host?.trim() && username?.trim() && password);
}

let smtpSettingsOverride: SmtpSettings | null | undefined;

export function setSmtpSettingsForTests(settings: SmtpSettings | null | undefined) {
  smtpSettingsOverride = settings;
}

export async function loadSmtpSettings(): Promise<SmtpSettings | null> {
  if (smtpSettingsOverride !== undefined) return smtpSettingsOverride;
  const dbConfig = await prisma.adminMailConfig.findFirst({ orderBy: { id: "asc" } });
  if (dbConfig && isCompleteSmtp(dbConfig.host, dbConfig.username, dbConfig.password)) {
    return {
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.username,
      password: dbConfig.password,
    };
  }
  if (isCompleteSmtp(config.mail.host, config.mail.username, config.mail.password)) {
    return {
      host: config.mail.host,
      port: config.mail.port,
      username: config.mail.username,
      password: config.mail.password,
    };
  }
  return null;
}

export type MailTransport = {
  sendMail: (mail: Record<string, unknown>) => Promise<unknown>;
};

type TransportFactory = (settings: SmtpSettings) => MailTransport;

const defaultTransportFactory: TransportFactory = (settings) =>
  nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: { user: settings.username, pass: settings.password },
  });

let transportFactory: TransportFactory = defaultTransportFactory;

export function setTransportFactoryForTests(factory: TransportFactory | null) {
  transportFactory = factory ?? defaultTransportFactory;
}

export function createTransport(settings: SmtpSettings) {
  return transportFactory(settings) as ReturnType<typeof nodemailer.createTransport>;
}

export async function sendHtmlEmail(options: {
  settings: SmtpSettings;
  from: FromAddress;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  attachments?: { filename: string; contentType: string; content: Buffer }[];
  listUnsubscribeUrl?: string | null;
}) {
  const transport = createTransport(options.settings);
  const inlined = embedInlineImages(options.html);
  const from = options.from.displayName
    ? `"${options.from.displayName}" <${options.from.email}>`
    : options.from.email;

  await transport.sendMail({
    from,
    to: options.to,
    cc: options.cc?.length ? options.cc : undefined,
    bcc: options.bcc?.length ? options.bcc : undefined,
    subject: options.subject,
    html: inlined.html,
    headers: options.listUnsubscribeUrl
      ? {
          "List-Unsubscribe": `<${options.listUnsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        }
      : undefined,
    attachments: [
      ...(options.attachments ?? []).map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        content: a.content,
      })),
      ...inlined.images.map((img) => ({
        filename: img.contentId,
        contentType: img.contentType,
        content: img.content,
        cid: img.contentId,
      })),
    ],
  });
}

export function fallbackFrom(settings: SmtpSettings): FromAddress {
  return { email: config.mail.from || settings.username };
}
