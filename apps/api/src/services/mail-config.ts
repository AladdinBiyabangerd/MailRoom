import { prisma } from "../db.js";
import { Codes, Msg, bad, notFound } from "../errors.js";
import { fallbackFrom, loadSmtpSettings, sendHtmlEmail } from "../mail/sender.js";

function mapConfig(c: { host: string; port: number; username: string }) {
  return { host: c.host, port: c.port, username: c.username };
}

export async function getMailConfig() {
  const c = await prisma.adminMailConfig.findFirst({ orderBy: { id: "asc" } });
  if (!c) throw notFound(Codes.MAIL_CONFIG, Msg.NOT_FOUND, Msg.ENTITY_MAIL_CONFIG);
  return mapConfig(c);
}

export async function createMailConfig(body: {
  host: string;
  port: number;
  username: string;
  password?: string;
}) {
  if ((await prisma.adminMailConfig.count()) > 0) {
    throw bad(Codes.MAIL_CONFIG, Msg.MAIL_CONFIG_ALREADY_EXISTS);
  }
  if (!body.password?.trim()) throw bad(Codes.MAIL_CONFIG, Msg.MAIL_CONFIG_PASSWORD_REQUIRED);
  const c = await prisma.adminMailConfig.create({
    data: {
      host: body.host.trim(),
      port: body.port,
      username: body.username.trim(),
      password: body.password,
    },
  });
  return mapConfig(c);
}

export async function updateMailConfig(body: {
  host: string;
  port: number;
  username: string;
  password?: string;
}) {
  const existing = await prisma.adminMailConfig.findFirst({ orderBy: { id: "asc" } });
  if (!existing) throw notFound(Codes.MAIL_CONFIG, Msg.NOT_FOUND, Msg.ENTITY_MAIL_CONFIG);
  const c = await prisma.adminMailConfig.update({
    where: { id: existing.id },
    data: {
      host: body.host.trim(),
      port: body.port,
      username: body.username.trim(),
      ...(body.password?.trim() ? { password: body.password } : {}),
    },
  });
  return mapConfig(c);
}

export async function sendTestEmail(email: string) {
  const existing = await prisma.adminMailConfig.findFirst({ orderBy: { id: "asc" } });
  if (!existing) throw notFound(Codes.MAIL_CONFIG, Msg.NOT_FOUND, Msg.ENTITY_MAIL_CONFIG);
  const settings = await loadSmtpSettings();
  if (!settings) throw bad(Codes.MAIL_CONFIG, Msg.MAIL_CONFIG_TEST_FAILED);
  try {
    await sendHtmlEmail({
      settings,
      from: fallbackFrom(settings),
      to: [email.trim()],
      subject: "Mailroom — SMTP test email",
      html: "<p>Hello,</p><p>This is a test email from <strong>Mailroom</strong>.</p><p>The SMTP configuration is working correctly.</p>",
    });
  } catch {
    throw bad(Codes.MAIL_CONFIG, Msg.MAIL_CONFIG_TEST_FAILED);
  }
}
