export const PERMISSIONS = [
  "emails:read",
  "emails:write",
  "panel-users:read",
  "panel-users:write",
  "settings:read",
  "settings:write",
  "mail-config:read",
  "mail-config:write",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const SUPER_ADMIN_ROLE = "SUPER_ADMIN";
/** Default role for self-registered users while invite-only signup is disabled. */
export const DEFAULT_SIGNUP_ROLE = "USER";
export const SIGNUP_PERMISSIONS = ["emails:read", "emails:write"] as const;

export function hasAnyPermission(held: string[], needed: string[]): boolean {
  if (needed.length === 0) return true;
  return needed.some((p) => held.includes(p));
}
