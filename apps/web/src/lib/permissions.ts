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

export type PanelAdminRole =
  | "superadmin"
  | "admin"
  | "operator"
  | "support"
  | "viewer";

export interface PermissionGroup {
  key: string;
  permissions: Permission[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  { key: "emails", permissions: ["emails:read", "emails:write"] },
  {
    key: "panelUsers",
    permissions: ["panel-users:read", "panel-users:write"],
  },
  { key: "settings", permissions: ["settings:read", "settings:write"] },
  { key: "mailConfig", permissions: ["mail-config:read", "mail-config:write"] },
];

const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

const MAIL_CONFIG_PERMISSIONS: Permission[] = ["mail-config:read", "mail-config:write"];

const ROLE_PERMISSIONS: Record<PanelAdminRole, Permission[]> = {
  superadmin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS.filter(
    (p) => p !== "panel-users:write" && !MAIL_CONFIG_PERMISSIONS.includes(p),
  ),
  operator: ["emails:read", "emails:write"],
  support: ["emails:read"],
  viewer: ALL_PERMISSIONS.filter(
    (p) => p.endsWith(":read") && !MAIL_CONFIG_PERMISSIONS.includes(p),
  ),
};

export function permissionsForRole(role: PanelAdminRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

const VALID_PERMISSIONS = new Set<string>(PERMISSIONS);

export function parsePermissions(permissions?: string[]): Permission[] {
  if (!permissions?.length) return [];
  return permissions.filter((p): p is Permission => VALID_PERMISSIONS.has(p));
}

export function hasPermission(
  role: string | undefined,
  permission: Permission,
  userPermissions?: string[],
): boolean {
  const resolved = parsePermissions(userPermissions);
  if (resolved.length > 0) {
    return resolved.includes(permission);
  }
  if (!role) return false;
  const normalized = role as PanelAdminRole;
  if (!(normalized in ROLE_PERMISSIONS)) return false;
  return ROLE_PERMISSIONS[normalized].includes(permission);
}

export function hasAnyPermission(
  role: string | undefined,
  permissions: Permission[],
  userPermissions?: string[],
): boolean {
  return permissions.some((p) => hasPermission(role, p, userPermissions));
}

export function countActivePermissions(permissions: Permission[]): number {
  return permissions.length;
}

export function permissionsMatchRole(
  role: PanelAdminRole,
  permissions: Permission[],
): boolean {
  const defaults = permissionsForRole(role);
  if (defaults.length !== permissions.length) return false;
  return defaults.every((p) => permissions.includes(p));
}

export function isSuperadminRole(role: PanelAdminRole): boolean {
  return role === "superadmin";
}
