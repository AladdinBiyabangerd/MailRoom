import { adminApi, isDemoMode } from "./client";
import type { AdminUser } from "@/lib/auth-storage";
import { PERMISSIONS } from "@/lib/permissions";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordConfirm: string;
}

export interface OtpRequest {
  email: string;
  otpCode: number;
}

export type OtpPurpose = "ACCOUNT_ACTIVATION" | "PASSWORD_RESET";

export interface ResendOtpRequest {
  email: string;
  purpose: OtpPurpose;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}

export interface ResetPasswordRequest {
  email: string;
  newPassword: string;
  retryPassword: string;
}

export interface AdminAuthResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  accessToken: string;
  tokenType?: string;
  expiresAt?: string;
  /** Refresh token is HttpOnly cookie — not in JSON body. */
}

export interface AdminLoginResponse {
  status: "SUCCESS" | "REQUIRES_ACTIVATION";
  accessToken?: string;
  tokenType?: string;
  expiresAt?: string;
  id?: number;
  email?: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  permissions?: string[];
}

export type LoginResult =
  | { type: "SUCCESS"; accessToken: string; user: AdminUser }
  | { type: "REQUIRES_ACTIVATION"; email: string };

export const DEMO_CREDENTIALS = {
  email: "admin@stayboard.az",
  password: "Admin123",
};

const DEMO_USER: AdminUser = {
  id: 1,
  firstName: "Super",
  lastName: "Admin",
  email: DEMO_CREDENTIALS.email,
  role: "superadmin",
  roles: ["SUPER_ADMIN"],
  permissions: [...PERMISSIONS],
  avatarColor: "#2f6aa8",
};

const AVATAR_COLORS = [
  "#2f6aa8",
  "#0d9488",
  "#7c3aed",
  "#c2410c",
  "#be123c",
  "#0369a1",
];

function pickAvatarColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function normalizeRole(roles?: string[]): string {
  if (!roles?.length) return "admin";
  if (roles.some((r) => r.toUpperCase() === "SUPER_ADMIN")) return "superadmin";
  return roles[0].toLowerCase().replace(/_/g, "");
}

export function mapToAdminUser(data: {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  roles?: string[];
  permissions?: string[];
}): AdminUser {
  return {
    id: data.id,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    role: normalizeRole(data.roles),
    roles: data.roles,
    permissions: data.permissions,
    avatarColor: pickAvatarColor(data.email),
  };
}

export async function loginRequest(payload: LoginRequest): Promise<LoginResult> {
  if (isDemoMode) {
    await new Promise((r) => setTimeout(r, 500));
    if (
      payload.email.trim().toLowerCase() === DEMO_CREDENTIALS.email &&
      payload.password === DEMO_CREDENTIALS.password
    ) {
      return {
        type: "SUCCESS",
        accessToken: "demo-token",
        user: DEMO_USER,
      };
    }
    throw new Error("INVALID_CREDENTIALS");
  }

  const { data } = await adminApi.post<AdminLoginResponse>(
    "/auth/sign-in",
    payload,
  );

  if (data.status === "REQUIRES_ACTIVATION" && data.email) {
    return { type: "REQUIRES_ACTIVATION", email: data.email };
  }

  if (
    data.status === "SUCCESS" &&
    data.accessToken &&
    data.id &&
    data.email &&
    data.firstName &&
    data.lastName
  ) {
    return {
      type: "SUCCESS",
      accessToken: data.accessToken,
      user: mapToAdminUser({
        id: data.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        roles: data.roles,
        permissions: data.permissions,
      }),
    };
  }

  throw new Error("UNEXPECTED_LOGIN_STATE");
}

export async function registerRequest(payload: RegisterRequest): Promise<void> {
  if (isDemoMode) return;
  await adminApi.post("/auth/sign-up", payload);
}

export async function verifyOtpRequest(payload: OtpRequest): Promise<AdminAuthResponse> {
  if (isDemoMode) {
    return {
      id: DEMO_USER.id,
      email: DEMO_USER.email,
      firstName: DEMO_USER.firstName,
      lastName: DEMO_USER.lastName,
      roles: DEMO_USER.roles ?? ["SUPER_ADMIN"],
      permissions: [...PERMISSIONS],
      accessToken: "demo-token",
    };
  }
  const { data } = await adminApi.post<AdminAuthResponse>("/auth/verify-otp", payload);
  return data;
}

export async function resendOtpRequest(payload: ResendOtpRequest): Promise<void> {
  if (isDemoMode) return;
  await adminApi.post("/auth/resend-otp", payload);
}

/** Refresh access token; refresh token is sent as HttpOnly cookie by the browser. */
export async function refreshTokenRequest(): Promise<AdminAuthResponse> {
  if (isDemoMode) {
    return {
      id: DEMO_USER.id,
      email: DEMO_USER.email,
      firstName: DEMO_USER.firstName,
      lastName: DEMO_USER.lastName,
      roles: DEMO_USER.roles ?? ["SUPER_ADMIN"],
      permissions: [...PERMISSIONS],
      accessToken: "demo-token",
    };
  }
  const { data } = await adminApi.post<AdminAuthResponse>("/auth/refresh");
  return data;
}

export async function logoutRequest(): Promise<void> {
  if (isDemoMode) return;
  try {
    await adminApi.post("/auth/sign-out");
  } catch {
    // Local session is cleared regardless.
  }
}

export async function forgotPasswordRequest(email: string): Promise<void> {
  if (isDemoMode) return;
  await adminApi.post(`/auth/forgot-password?email=${encodeURIComponent(email)}`);
}

export async function verifyResetCodeRequest(
  payload: VerifyCodeRequest,
): Promise<void> {
  if (isDemoMode) return;
  await adminApi.post("/auth/verify-code", payload);
}

export async function resetPasswordRequest(
  payload: ResetPasswordRequest,
): Promise<void> {
  if (isDemoMode) return;
  await adminApi.patch("/auth/reset-password", payload);
}

export async function getCurrentAdminRequest(): Promise<AdminUser> {
  if (isDemoMode) return DEMO_USER;
  const { data } = await adminApi.get<{
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    roles: string[];
    permissions: string[];
  }>("/auth/me");
  return mapToAdminUser(data);
}
