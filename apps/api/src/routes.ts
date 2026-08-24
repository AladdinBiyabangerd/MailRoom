import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { clearRefreshCookie, readRefreshCookie, requirePermissions, requireUser, setRefreshCookie } from "./auth.js";
import { Codes, Msg, unauthorized } from "./errors.js";
import * as auth from "./services/auth.js";
import * as accounts from "./services/accounts.js";
import * as catalog from "./services/catalog.js";
import * as campaigns from "./services/campaigns.js";
import * as mailConfig from "./services/mail-config.js";
import * as emails from "./services/emails.js";

function idParam(request: FastifyRequest, name = "id") {
  return Number((request.params as Record<string, string>)[name]);
}

function q(request: FastifyRequest) {
  return request.query as Record<string, string | undefined>;
}

function noContent(reply: FastifyReply) {
  return reply.code(204).send();
}

const P = {
  emailsRead: ["emails:read"],
  emailsWrite: ["emails:write"],
  usersRead: ["panel-users:read"],
  usersWrite: ["panel-users:write"],
  mailRead: ["mail-config:read"],
  mailWrite: ["mail-config:write"],
};

export async function registerRoutes(app: FastifyInstance) {
  app.get("/actuator/health", async () => ({ status: "UP" }));
  app.get("/actuator/health/:rest", async () => ({ status: "UP" }));

  app.post("/admin/v1/auth/login", login);
  app.post("/admin/v1/auth/sign-in", login);
  app.post("/admin/v1/auth/sign-up", async (request, reply) => {
    await auth.register(request.body as never);
    return noContent(reply);
  });
  app.post("/admin/v1/auth/verify-otp", async (request, reply) => {
    const body = request.body as { email: string; otpCode: number };
    const result = await auth.verifyOtpAndLogin(body.email, Number(body.otpCode));
    setRefreshCookie(reply, result.refreshToken);
    const { refreshToken: _, ...rest } = result;
    return rest;
  });
  app.post("/admin/v1/auth/resend-otp", async (request, reply) => {
    const body = request.body as { email: string; purpose: string };
    await auth.resendOtp(body.email, body.purpose);
    return noContent(reply);
  });
  app.post("/admin/v1/auth/refresh", async (request, reply) => {
    const token = readRefreshCookie(request);
    if (!token) throw unauthorized(Codes.REFRESH_TOKEN_EXPIRED, Msg.REFRESH_TOKEN_MISSING);
    const result = await auth.refreshAccessToken(token);
    setRefreshCookie(reply, result.refreshToken);
    const { refreshToken: _, ...rest } = result;
    return rest;
  });
  app.post("/admin/v1/auth/sign-out", logout);
  app.post("/admin/v1/auth/logout", logout);
  app.get("/admin/v1/auth/me", { preHandler: requireUser() }, async (request) => {
    return auth.currentAdmin(request.authUser!.userId);
  });
  app.post("/admin/v1/auth/forgot-password", async (request, reply) => {
    const email = q(request).email;
    if (email) await auth.requestPasswordReset(email);
    return noContent(reply);
  });
  app.post("/admin/v1/auth/verify-code", async (request) => {
    const body = request.body as { email: string; code: string };
    return auth.verifyResetCode(body.email, body.code);
  });
  app.patch("/admin/v1/auth/reset-password", async (request, reply) => {
    const body = request.body as { email: string; newPassword: string; retryPassword: string };
    await auth.resetPassword(body.email, body.newPassword, body.retryPassword);
    return noContent(reply);
  });

  app.get("/admin/v1/accounts", { preHandler: requirePermissions(P.usersRead) }, async (request) => {
    const query = q(request);
    return accounts.listAccounts({
      search: query.search,
      role: query.role,
      status: query.status,
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
    });
  });
  app.get("/admin/v1/accounts/:id", { preHandler: requirePermissions(P.usersRead) }, async (request) => {
    return accounts.getAccount(idParam(request));
  });
  app.post("/admin/v1/accounts", { preHandler: requirePermissions(P.usersWrite) }, async (request, reply) => {
    const created = await accounts.createAccount(request.body as never);
    return reply.code(201).send(created);
  });
  app.put("/admin/v1/accounts/:id", { preHandler: requirePermissions(P.usersWrite) }, async (request) => {
    return accounts.updateAccount(idParam(request), request.body as never);
  });
  app.put("/admin/v1/accounts/:id/roles", { preHandler: requirePermissions(P.usersWrite) }, async (request) => {
    const body = request.body as { roleIds: number[] };
    return accounts.assignRoles(idParam(request), body.roleIds);
  });
  app.patch("/admin/v1/accounts/:id/activate", { preHandler: requirePermissions(P.usersWrite) }, async (request) => {
    return accounts.activateAccount(idParam(request));
  });
  app.patch("/admin/v1/accounts/:id/deactivate", { preHandler: requirePermissions(P.usersWrite) }, async (request) => {
    return accounts.deactivateAccount(idParam(request), request.authUser!.userId);
  });
  app.delete("/admin/v1/accounts/:id", { preHandler: requirePermissions(P.usersWrite) }, async (request, reply) => {
    await accounts.deleteAccount(idParam(request), request.authUser!.userId);
    return noContent(reply);
  });

  app.get("/admin/v1/permissions", { preHandler: requirePermissions(P.usersRead) }, async () => {
    return accounts.listPermissions();
  });
  app.get("/admin/v1/roles", { preHandler: requirePermissions(P.usersRead) }, async () => accounts.listRoles());
  app.get("/admin/v1/roles/:id", { preHandler: requirePermissions(P.usersRead) }, async (request) => {
    return accounts.getRole(idParam(request));
  });
  app.post("/admin/v1/roles", { preHandler: requirePermissions(P.usersWrite) }, async (request, reply) => {
    return reply.code(201).send(await accounts.createRole(request.body as never));
  });
  app.put("/admin/v1/roles/:id", { preHandler: requirePermissions(P.usersWrite) }, async (request) => {
    return accounts.updateRole(idParam(request), request.body as never);
  });
  app.delete("/admin/v1/roles/:id", { preHandler: requirePermissions(P.usersWrite) }, async (request, reply) => {
    await accounts.deleteRole(idParam(request));
    return noContent(reply);
  });

  app.get("/admin/v1/email-templates", { preHandler: requirePermissions(P.emailsRead) }, async (request) => {
    const query = q(request);
    return catalog.searchTemplates(query.search, Number(query.page) || 1, Number(query.limit) || 20);
  });
  app.get("/admin/v1/email-templates/:id", { preHandler: requirePermissions(P.emailsRead) }, async (request) => {
    return catalog.getTemplate(idParam(request));
  });
  app.post("/admin/v1/email-templates", { preHandler: requirePermissions(P.emailsWrite) }, async (request, reply) => {
    return reply.code(201).send(await catalog.createTemplate(request.body as never));
  });
  app.put("/admin/v1/email-templates/:id", { preHandler: requirePermissions(P.emailsWrite) }, async (request) => {
    return catalog.updateTemplate(idParam(request), request.body as never);
  });
  app.delete("/admin/v1/email-templates/:id", { preHandler: requirePermissions(P.emailsWrite) }, async (request, reply) => {
    await catalog.deleteTemplate(idParam(request));
    return noContent(reply);
  });

  app.get("/admin/v1/email-contacts", { preHandler: requirePermissions(P.emailsRead) }, async (request) => {
    const query = q(request);
    return catalog.searchContacts(query.search, Number(query.page) || 1, Number(query.limit) || 20);
  });
  app.get("/admin/v1/email-contacts/:id", { preHandler: requirePermissions(P.emailsRead) }, async (request) => {
    return catalog.getContact(idParam(request));
  });
  app.post("/admin/v1/email-contacts", { preHandler: requirePermissions(P.emailsWrite) }, async (request, reply) => {
    return reply.code(201).send(await catalog.createContact(request.body as never));
  });
  app.put("/admin/v1/email-contacts/:id", { preHandler: requirePermissions(P.emailsWrite) }, async (request) => {
    return catalog.updateContact(idParam(request), request.body as never);
  });
  app.delete("/admin/v1/email-contacts/:id", { preHandler: requirePermissions(P.emailsWrite) }, async (request, reply) => {
    await catalog.deleteContact(idParam(request));
    return noContent(reply);
  });

  app.get("/admin/v1/email-drafts/current", { preHandler: requirePermissions(P.emailsRead) }, async (request, reply) => {
    const draft = await catalog.getCurrentDraft(request.authUser!.userId);
    if (!draft) return noContent(reply);
    return draft;
  });
  app.put("/admin/v1/email-drafts/current", { preHandler: requirePermissions(P.emailsWrite) }, async (request, reply) => {
    const draft = await catalog.saveCurrentDraft(request.authUser!.userId, request.body as never);
    if (!draft) return noContent(reply);
    return draft;
  });
  app.delete("/admin/v1/email-drafts/current", { preHandler: requirePermissions(P.emailsWrite) }, async (request, reply) => {
    await catalog.deleteCurrentDraft(request.authUser!.userId);
    return noContent(reply);
  });

  app.get("/admin/v1/campaigns", { preHandler: requirePermissions(P.emailsRead) }, async (request) => {
    const query = q(request);
    return campaigns.searchCampaigns(query.search, Number(query.page) || 1, Number(query.limit) || 20);
  });
  app.get("/admin/v1/campaigns/:id", { preHandler: requirePermissions(P.emailsRead) }, async (request) => {
    return campaigns.getCampaign(idParam(request));
  });
  app.post("/admin/v1/campaigns", { preHandler: requirePermissions(P.emailsWrite) }, async (request, reply) => {
    return reply.code(201).send(await campaigns.createCampaign(request.body as never));
  });
  app.put("/admin/v1/campaigns/:id", { preHandler: requirePermissions(P.emailsWrite) }, async (request) => {
    return campaigns.updateCampaign(idParam(request), request.body as never);
  });
  app.delete("/admin/v1/campaigns/:id", { preHandler: requirePermissions(P.emailsWrite) }, async (request, reply) => {
    await campaigns.deleteCampaign(idParam(request));
    return noContent(reply);
  });
  app.post("/admin/v1/campaigns/:id/send", { preHandler: requirePermissions(P.emailsWrite) }, async (request, reply) => {
    const result = await campaigns.sendCampaign(idParam(request), request.authUser!, request.body as never);
    return reply.code(202).send(result);
  });

  app.get("/admin/v1/email-sender-identities", { preHandler: requirePermissions(P.emailsRead) }, async () => {
    return catalog.listActiveSenders();
  });
  app.get("/admin/v1/email-sender-identities/all", { preHandler: requirePermissions(P.mailWrite) }, async () => {
    return catalog.listAllSenders();
  });
  app.post("/admin/v1/email-sender-identities", { preHandler: requirePermissions(P.mailWrite) }, async (request, reply) => {
    return reply.code(201).send(await catalog.createSender(request.body as never));
  });
  app.put("/admin/v1/email-sender-identities/:id", { preHandler: requirePermissions(P.mailWrite) }, async (request) => {
    return catalog.updateSender(idParam(request), request.body as never);
  });
  app.delete("/admin/v1/email-sender-identities/:id", { preHandler: requirePermissions(P.mailWrite) }, async (request, reply) => {
    await catalog.deleteSender(idParam(request));
    return noContent(reply);
  });

  app.get("/admin/v1/settings/mail-config", { preHandler: requirePermissions(P.mailRead) }, async () => {
    return mailConfig.getMailConfig();
  });
  app.post("/admin/v1/settings/mail-config", { preHandler: requirePermissions(P.mailWrite) }, async (request, reply) => {
    return reply.code(201).send(await mailConfig.createMailConfig(request.body as never));
  });
  app.put("/admin/v1/settings/mail-config", { preHandler: requirePermissions(P.mailWrite) }, async (request) => {
    return mailConfig.updateMailConfig(request.body as never);
  });
  app.post("/admin/v1/settings/mail-config/test-email", { preHandler: requirePermissions(P.mailWrite) }, async (request, reply) => {
    const body = request.body as { email: string };
    await mailConfig.sendTestEmail(body.email);
    return noContent(reply);
  });

  app.post("/admin/v1/emails/send", { preHandler: requirePermissions(P.emailsWrite) }, async (request, reply) => {
    return reply.code(202).send(await emails.sendAdminEmail(request.authUser!, request.body as never));
  });
  app.post("/admin/v1/emails/:id/resend", { preHandler: requirePermissions(P.emailsWrite) }, async (request, reply) => {
    const body = (request.body ?? {}) as { mode?: string };
    return reply.code(202).send(await emails.resendEmail(idParam(request), request.authUser!, body.mode));
  });
  app.get("/admin/v1/emails/history", { preHandler: requirePermissions(P.emailsRead) }, async () => emails.history());
  app.patch("/admin/v1/emails/:id/schedule", { preHandler: requirePermissions(P.emailsWrite) }, async (request) => {
    const body = request.body as { scheduledAt: string };
    return emails.updateSchedule(idParam(request), body.scheduledAt);
  });
  app.get("/admin/v1/emails/analytics", { preHandler: requirePermissions(P.emailsRead) }, async (request) => {
    const query = q(request);
    return emails.getAnalytics(query.from, query.to, query.campaignId ? Number(query.campaignId) : undefined);
  });

  app.get("/admin/v1/email-suppressions", { preHandler: requirePermissions(P.emailsRead) }, async (request) => {
    const query = q(request);
    return emails.listSuppressions(query.search, Number(query.page) || 1, Number(query.limit) || 20);
  });
  app.delete("/admin/v1/email-suppressions/:id", { preHandler: requirePermissions(P.emailsWrite) }, async (request, reply) => {
    await emails.deleteSuppression(idParam(request));
    return noContent(reply);
  });

  const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  app.get("/public/v1/emails/open/:token", async (request, reply) => {
    const token = (request.params as { token: string }).token;
    await emails.recordOpen(token);
    return reply
      .header("Cache-Control", "no-store")
      .type("image/gif")
      .send(gif);
  });
  app.get("/public/v1/emails/unsubscribe/:token", async (request, reply) => {
    const token = (request.params as { token: string }).token;
    const success = await emails.unsubscribe(token);
    return reply.type("text/html").send(unsubscribePage(success));
  });
  app.post("/public/v1/emails/unsubscribe/:token", async (request, reply) => {
    const token = (request.params as { token: string }).token;
    await emails.unsubscribe(token);
    return reply.code(200).send();
  });
}

async function login(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as { email: string; password: string };
  const result = await auth.login(body.email, body.password);
  if (result.status === "SUCCESS" && "refreshToken" in result && result.refreshToken) {
    setRefreshCookie(reply, result.refreshToken);
    const { refreshToken: _, ...rest } = result;
    return rest;
  }
  return result;
}

async function logout(request: FastifyRequest, reply: FastifyReply) {
  await auth.logout(readRefreshCookie(request));
  clearRefreshCookie(reply);
  return noContent(reply);
}

function unsubscribePage(success: boolean) {
  if (success) {
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Unsubscribed</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:4rem auto;padding:0 1rem;color:#111}h1{font-size:1.25rem}p{color:#555;line-height:1.5}</style></head>
<body><h1>You have been unsubscribed</h1><p>You will no longer receive marketing emails from us at this address.</p></body></html>`;
  }
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Link expired</title>
<style>body{font-family:system-ui,sans-serif;max-width:480px;margin:4rem auto;padding:0 1rem;color:#111}h1{font-size:1.25rem}p{color:#555;line-height:1.5}</style></head>
<body><h1>This unsubscribe link is invalid or has expired</h1><p>If you still receive unwanted emails, please contact support.</p></body></html>`;
}
