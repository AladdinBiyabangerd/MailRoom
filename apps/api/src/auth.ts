import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";
import { AppError, Codes, Msg, forbidden, unauthorized } from "./errors.js";
import { hasAnyPermission } from "./permissions.js";
import { prisma } from "./db.js";

export interface AuthUser {
  userId: number;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

const REFRESH_COOKIE = "refresh_token";
const COOKIE_PATH = "/admin/v1/auth";

function jwtSecret(): jwt.Secret {
  try {
    const decoded = Buffer.from(config.appSecretKey, "base64");
    if (decoded.length >= 64) return decoded;
  } catch {
    // fall through
  }
  const raw = Buffer.from(config.appSecretKey, "utf8");
  if (raw.length < 64) {
    throw new AppError(500, Codes.INTERNAL_ERROR, Msg.JWT_SECRET_TOO_SHORT);
  }
  return raw;
}

export function mintAccessToken(user: {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  permissions: string[];
  roles: string[];
}): { token: string; expiresAt: Date } {
  const ttlSeconds = config.accessTokenTtlMinutes * 60;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const token = jwt.sign(
    {
      token_type: "access",
      user_id: user.id,
      first_name: user.firstName,
      last_name: user.lastName,
      authorities: user.permissions,
      roles: user.roles,
    },
    jwtSecret(),
    { algorithm: "HS512", subject: user.email, expiresIn: ttlSeconds },
  );
  return { token, expiresAt };
}

export function verifyAccessToken(token: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, jwtSecret(), { algorithms: ["HS512"] }) as jwt.JwtPayload;
    if (payload.token_type && payload.token_type !== "access") return null;
    const email = payload.sub;
    if (!email) return null;
    const permissions = Array.isArray(payload.authorities)
      ? payload.authorities.map(String)
      : [];
    const roles = Array.isArray(payload.roles) ? payload.roles.map(String) : [];
    return {
      userId: Number(payload.user_id),
      email,
      firstName: String(payload.first_name ?? ""),
      lastName: String(payload.last_name ?? ""),
      roles,
      permissions,
    };
  } catch {
    return null;
  }
}

export function setRefreshCookie(reply: FastifyReply, token: string) {
  const maxAge = config.refreshTokenValidityDays * 24 * 60 * 60;
  reply.setCookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite.toLowerCase() as "lax" | "strict" | "none",
    path: COOKIE_PATH,
    maxAge,
  });
}

export function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: config.cookieSameSite.toLowerCase() as "lax" | "strict" | "none",
    path: COOKIE_PATH,
  });
}

export function readRefreshCookie(request: FastifyRequest): string | undefined {
  const value = request.cookies[REFRESH_COOKIE];
  return value && value.trim() ? value : undefined;
}

export function newRefreshTokenValue(): string {
  return randomUUID();
}

export async function requireAuth(request: FastifyRequest): Promise<AuthUser> {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    throw unauthorized(Codes.INVALID_CREDENTIALS, Msg.UNAUTHORIZED);
  }
  const parsed = verifyAccessToken(token);
  if (!parsed || !parsed.userId) {
    throw unauthorized(Codes.INVALID_CREDENTIALS, Msg.UNAUTHORIZED);
  }
  const user = await prisma.adminUser.findUnique({
    where: { id: parsed.userId },
    include: { userRoles: { include: { role: { include: { permissions: true } } } } },
  });
  if (!user || user.status !== "ACTIVE") {
    throw unauthorized(Codes.INVALID_CREDENTIALS, Msg.UNAUTHORIZED);
  }
  const roles = user.userRoles.map((ur) => ur.role.name);
  const permissions = [...new Set(user.userRoles.flatMap((ur) => ur.role.permissions.map((p) => p.permission)))];
  const authUser: AuthUser = {
    userId: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    roles,
    permissions,
  };
  request.authUser = authUser;
  return authUser;
}

export function requirePermissions(needed: string[]) {
  return async (request: FastifyRequest) => {
    const user = request.authUser ?? (await requireAuth(request));
    if (!hasAnyPermission(user.permissions, needed)) {
      throw forbidden(Codes.ACCESS_DENIED, Msg.ACCESS_DENIED);
    }
  };
}

export function requireUser() {
  return async (request: FastifyRequest) => {
    await requireAuth(request);
  };
}
