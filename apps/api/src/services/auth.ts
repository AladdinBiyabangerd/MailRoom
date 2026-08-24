import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { DEFAULT_SIGNUP_ROLE } from "../permissions.js";
import { Codes, Msg, bad, forbidden, notFound, unauthorized } from "../errors.js";
import { mintAccessToken, newRefreshTokenValue } from "../auth.js";
import { loadSmtpSettings, sendHtmlEmail, fallbackFrom } from "../mail/sender.js";

const passwordResetAttempts = new Map<string, { failed: number; blockedUntil?: Date }>();

export function normalizeEmail(email: string | undefined | null): string {
  return (email ?? "").trim().toLowerCase();
}

function displayName(first: string, last: string) {
  return `${first.trim()} ${last.trim()}`;
}

async function permissionsAndRoles(userId: number) {
  const user = await prisma.adminUser.findUniqueOrThrow({
    where: { id: userId },
    include: { userRoles: { include: { role: { include: { permissions: true } } } } },
  });
  const roles = user.userRoles.map((ur) => ur.role.name).sort();
  const permissions = [...new Set(user.userRoles.flatMap((ur) => ur.role.permissions.map((p) => p.permission)))].sort();
  return { user, roles, permissions };
}

async function createRefreshToken(userId: number) {
  const token = newRefreshTokenValue();
  const expiresAt = new Date(Date.now() + config.refreshTokenValidityDays * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { token, userId, expiresAt } });
  return token;
}

async function toAuthPayload(userId: number) {
  const { user, roles, permissions } = await permissionsAndRoles(userId);
  const { token, expiresAt } = mintAccessToken({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    permissions,
    roles,
  });
  const refreshToken = await createRefreshToken(user.id);
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles,
    permissions,
    accessToken: token,
    tokenType: "Bearer",
    expiresAt: expiresAt.toISOString(),
    refreshToken,
  };
}

export async function sendOtp(email: string, recipientName: string, purpose: string) {
  const normalized = normalizeEmail(email);
  const now = new Date();
  const existing = await prisma.otpCode.findFirst({
    where: { email: normalized, purpose, used: false },
    orderBy: { createdAt: "desc" },
  });

  let code: number;
  if (existing && existing.expirationTime > now && existing.retryCount < 5) {
    await prisma.otpCode.update({
      where: { id: existing.id },
      data: { retryCount: existing.retryCount + 1, lastSentTime: now },
    });
    code = existing.code;
  } else {
    if (existing) {
      await prisma.otpCode.update({ where: { id: existing.id }, data: { used: true } });
    }
    code = 100_000 + randomInt(900_000);
    await prisma.otpCode.create({
      data: {
        email: normalized,
        code,
        purpose,
        expirationTime: new Date(now.getTime() + 5 * 60 * 1000),
        lastSentTime: now,
      },
    });
  }

  const settings = await loadSmtpSettings();
  const text = `Your Mailroom verification code is ${code}. It expires in 5 minutes.`;
  if (settings) {
    try {
      await sendHtmlEmail({
        settings,
        from: fallbackFrom(settings),
        to: [normalized],
        subject: purpose === "PASSWORD_RESET" ? "Mailroom password reset" : "Mailroom verification code",
        html: `<p>Hello ${recipientName},</p><p>${text}</p>`,
      });
    } catch (err) {
      console.warn("OTP email send failed:", err);
      if (!config.isProd) console.info(`OTP for ${normalized}: ${code}`);
    }
  } else if (!config.isProd) {
    console.info(`OTP for ${normalized} (${purpose}): ${code}`);
  }
  return String(code);
}

export async function verifyOtp(email: string, code: number, purpose: string) {
  const normalized = normalizeEmail(email);
  const otp = await prisma.otpCode.findFirst({
    where: { email: normalized, code, purpose, used: false },
  });
  if (!otp) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_OTP);
  if (otp.expirationTime < new Date()) throw bad(Codes.BAD_REQUEST, Msg.OTP_EXPIRED);
  await prisma.otpCode.update({ where: { id: otp.id }, data: { used: true } });
}

export async function register(body: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirm: string;
}) {
  if (body.password !== body.passwordConfirm) throw bad(Codes.BAD_REQUEST, Msg.PASSWORD_MISMATCH);
  const email = normalizeEmail(body.email);
  const firstName = body.firstName.trim();
  const lastName = body.lastName.trim();
  const user = await prisma.adminUser.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });

  if (user) {
    await completeInvitedRegistration(user, { firstName, lastName, password: body.password });
    return;
  }

  if (config.inviteOnlyRegistration) {
    throw forbidden(Codes.REGISTRATION_NOT_INVITED, Msg.REGISTRATION_NOT_INVITED);
  }

  await createOpenRegistration({ email, firstName, lastName, password: body.password });
}

/** Kept so invite-only sign-up can be turned back on without rewriting this path. */
async function completeInvitedRegistration(
  user: { id: number; email: string; status: string },
  body: { firstName: string; lastName: string; password: string },
) {
  if (user.status === "ACTIVE") throw bad(Codes.EMAIL_ALREADY_EXISTS, Msg.EMAIL_ALREADY_EXISTS, user.email);
  if (user.status === "INACTIVE") throw forbidden(Codes.ACCOUNT_INACTIVE, Msg.ACCOUNT_INACTIVE);
  if (user.status !== "PENDING") throw forbidden(Codes.REGISTRATION_NOT_INVITED, Msg.REGISTRATION_NOT_INVITED);

  await prisma.adminUser.update({
    where: { id: user.id },
    data: {
      firstName: body.firstName,
      lastName: body.lastName,
      password: await bcrypt.hash(body.password, 10),
      status: "PENDING",
    },
  });
  await sendOtp(user.email, displayName(body.firstName, body.lastName), "ACCOUNT_ACTIVATION");
}

async function createOpenRegistration(body: {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}) {
  const role = await prisma.adminRole.findUnique({ where: { name: DEFAULT_SIGNUP_ROLE } });
  if (!role) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ROLE);

  try {
    await prisma.adminUser.create({
      data: {
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        password: await bcrypt.hash(body.password, 10),
        status: "PENDING",
        userRoles: { create: { roleId: role.id } },
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw bad(Codes.EMAIL_ALREADY_EXISTS, Msg.EMAIL_ALREADY_EXISTS, body.email);
    }
    throw error;
  }
  await sendOtp(body.email, displayName(body.firstName, body.lastName), "ACCOUNT_ACTIVATION");
}

export async function login(emailRaw: string, password: string) {
  const email = normalizeEmail(emailRaw);
  const user = await prisma.adminUser.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw unauthorized(Codes.INVALID_CREDENTIALS, Msg.INVALID_CREDENTIALS);
  }
  if (user.status === "INACTIVE") throw forbidden(Codes.ACCOUNT_INACTIVE, Msg.ACCOUNT_INACTIVE);
  if (user.status === "PENDING") {
    await sendOtp(user.email, displayName(user.firstName, user.lastName), "ACCOUNT_ACTIVATION");
    return {
      status: "REQUIRES_ACTIVATION" as const,
      email: user.email,
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }

  await prisma.adminUser.update({ where: { id: user.id }, data: { lastActive: new Date() } });
  const payload = await toAuthPayload(user.id);
  return { status: "SUCCESS" as const, ...payload };
}

export async function verifyOtpAndLogin(emailRaw: string, otpCode: number) {
  const email = normalizeEmail(emailRaw);
  const user = await prisma.adminUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status: "PENDING" },
  });
  if (!user) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ADMIN);
  await verifyOtp(email, otpCode, "ACCOUNT_ACTIVATION");
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { status: "ACTIVE", lastActive: new Date() },
  });
  return toAuthPayload(user.id);
}

export async function resendOtp(emailRaw: string, purpose: string) {
  const email = normalizeEmail(emailRaw);
  const status = purpose === "PASSWORD_RESET" ? "ACTIVE" : "PENDING";
  const user = await prisma.adminUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status },
  });
  if (!user) return;
  await sendOtp(email, displayName(user.firstName, user.lastName), purpose);
}

export async function refreshAccessToken(refreshTokenValue: string) {
  const entity = await prisma.refreshToken.findUnique({
    where: { token: refreshTokenValue },
    include: { user: true },
  });
  if (!entity) throw unauthorized(Codes.REFRESH_TOKEN_EXPIRED, Msg.REFRESH_TOKEN_NOT_FOUND);
  if (entity.revoked) {
    await prisma.refreshToken.updateMany({ where: { userId: entity.userId }, data: { revoked: true } });
    throw unauthorized(Codes.REFRESH_TOKEN_EXPIRED, Msg.REFRESH_TOKEN_REUSE);
  }
  if (entity.expiresAt < new Date()) {
    await prisma.refreshToken.update({ where: { id: entity.id }, data: { revoked: true } });
    throw unauthorized(Codes.REFRESH_TOKEN_EXPIRED, Msg.REFRESH_TOKEN_EXPIRED);
  }
  await prisma.refreshToken.update({ where: { id: entity.id }, data: { revoked: true } });
  if (entity.user.status !== "ACTIVE") {
    throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ADMIN);
  }
  return toAuthPayload(entity.userId);
}

export async function logout(refreshTokenValue: string | undefined) {
  if (!refreshTokenValue) return;
  await prisma.refreshToken.updateMany({ where: { token: refreshTokenValue }, data: { revoked: true } });
}

export async function requestPasswordReset(emailRaw: string) {
  const email = normalizeEmail(emailRaw);
  const user = await prisma.adminUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status: "ACTIVE" },
  });
  if (!user) return;
  const code = await sendOtp(email, displayName(user.firstName, user.lastName), "PASSWORD_RESET");
  await prisma.passwordResetToken.create({
    data: {
      email,
      code,
      expirationTime: new Date(Date.now() + config.passwordResetExpirationMinutes * 60 * 1000),
    },
  });
}

function ensureResetNotBlocked(email: string) {
  const state = passwordResetAttempts.get(email);
  if (state?.blockedUntil && state.blockedUntil > new Date()) {
    throw unauthorized(Codes.PASSWORD_RESET_BLOCKED, Msg.PASSWORD_RESET_BLOCKED);
  }
  if (state?.blockedUntil) passwordResetAttempts.delete(email);
}

export async function verifyResetCode(emailRaw: string, code: string) {
  const email = normalizeEmail(emailRaw);
  ensureResetNotBlocked(email);
  const token = await prisma.passwordResetToken.findFirst({
    where: { email, code, expirationTime: { gt: new Date() } },
  });
  if (!token) {
    const prev = passwordResetAttempts.get(email) ?? { failed: 0 };
    const next = prev.failed + 1;
    if (next >= 5) {
      passwordResetAttempts.set(email, {
        failed: 0,
        blockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      });
    } else {
      passwordResetAttempts.set(email, { failed: next });
    }
    throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_PASSWORD_RESET_TOKEN);
  }
  await prisma.passwordResetToken.update({ where: { id: token.id }, data: { verified: true } });
  passwordResetAttempts.delete(email);
  return { verified: true };
}

export async function resetPassword(emailRaw: string, newPassword: string, retryPassword: string) {
  const email = normalizeEmail(emailRaw);
  if (newPassword !== retryPassword) throw bad(Codes.BAD_REQUEST, Msg.PASSWORD_MISMATCH);
  const token = await prisma.passwordResetToken.findFirst({
    where: { email, verified: true, expirationTime: { gt: new Date() } },
  });
  if (!token) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_PASSWORD_RESET_TOKEN);
  const user = await prisma.adminUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, status: "ACTIVE" },
  });
  if (!user) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ADMIN);
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { password: await bcrypt.hash(newPassword, 10) },
  });
  await prisma.passwordResetToken.deleteMany({ where: { email } });
}

export async function currentAdmin(userId: number) {
  const { user, roles, permissions } = await permissionsAndRoles(userId);
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles,
    permissions,
  };
}

export async function cleanupExpiredRefreshTokens() {
  await prisma.refreshToken.deleteMany({
    where: { OR: [{ revoked: true }, { expiresAt: { lt: new Date() } }] },
  });
}
