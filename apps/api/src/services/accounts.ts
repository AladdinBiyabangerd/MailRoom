import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../db.js";
import { PERMISSIONS, SUPER_ADMIN_ROLE } from "../permissions.js";
import { Codes, Msg, bad, notFound } from "../errors.js";

function toApiRoleName(name: string | null | undefined) {
  if (!name) return null;
  return name.trim().toLowerCase().replaceAll("_", "");
}

function toApiStatus(status: string) {
  return status.toLowerCase();
}

function parseStatus(status?: string | null) {
  if (!status?.trim()) return undefined;
  return status.trim().toUpperCase();
}

async function findRoleByName(name: string) {
  const roles = await prisma.adminRole.findMany();
  const needle = name.trim();
  const found = roles.find(
    (r) =>
      r.name.toLowerCase() === needle.toLowerCase() ||
      toApiRoleName(r.name) === toApiRoleName(needle),
  );
  if (!found) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ROLE);
  return found;
}

function mapAccount(user: {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  lastActive: Date | null;
  createdAt: Date;
  userRoles: { role: { name: string; permissions: { permission: string }[] } }[];
}) {
  const roles = user.userRoles.map((ur) => ur.role.name);
  const permissions = [...new Set(user.userRoles.flatMap((ur) => ur.role.permissions.map((p) => p.permission)))].sort();
  const primary = roles.sort()[0];
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: toApiRoleName(primary),
    status: toApiStatus(user.status),
    permissions,
    lastActive: user.lastActive?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString().slice(0, 10),
  };
}

const accountInclude = {
  userRoles: { include: { role: { include: { permissions: true } } } },
} as const;

export async function listAccounts(query: {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}) {
  const page = !query.page || query.page < 1 ? 1 : query.page;
  const limit = !query.limit || query.limit < 1 ? 20 : Math.min(query.limit, 100);
  const status = parseStatus(query.status);
  const search = query.search?.trim();
  const roleNeedle = toApiRoleName(query.role);

  const users = await prisma.adminUser.findMany({
    include: accountInclude,
    orderBy: { createdAt: "desc" },
  });
  let filtered = users;
  if (status) filtered = filtered.filter((u) => u.status === status);
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (u) =>
        u.email.toLowerCase().includes(s) ||
        u.firstName.toLowerCase().includes(s) ||
        u.lastName.toLowerCase().includes(s),
    );
  }
  if (roleNeedle) {
    filtered = filtered.filter((u) => u.userRoles.some((ur) => toApiRoleName(ur.role.name) === roleNeedle));
  }
  const total = filtered.length;
  const items = filtered.slice((page - 1) * limit, page * limit).map(mapAccount);
  return { items, total, page, limit };
}

export async function getAccount(id: number) {
  const user = await prisma.adminUser.findUnique({ where: { id }, include: accountInclude });
  if (!user) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ADMIN);
  return mapAccount(user);
}

export async function createAccount(body: {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
}) {
  const email = body.email.trim().toLowerCase();
  const exists = await prisma.adminUser.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (exists) throw bad(Codes.EMAIL_ALREADY_EXISTS, Msg.EMAIL_ALREADY_EXISTS, email);
  const role = await findRoleByName(body.role);
  const status = parseStatus(body.status) ?? "PENDING";
  const user = await prisma.adminUser.create({
    data: {
      email,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      password: await bcrypt.hash(randomUUID(), 10),
      status,
      userRoles: { create: { roleId: role.id } },
    },
    include: accountInclude,
  });
  return mapAccount(user);
}

export async function updateAccount(
  id: number,
  body: { firstName: string; lastName: string; role: string; status: string },
) {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ADMIN);
  const role = await findRoleByName(body.role);
  await prisma.adminUserRole.deleteMany({ where: { userId: id } });
  const updated = await prisma.adminUser.update({
    where: { id },
    data: {
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      status: parseStatus(body.status) ?? user.status,
      userRoles: { create: { roleId: role.id } },
    },
    include: accountInclude,
  });
  return mapAccount(updated);
}

export async function assignRoles(id: number, roleIds: number[]) {
  if (!roleIds?.length) throw bad(Codes.NO_ROLES_ASSIGNED, Msg.NO_ROLES_ASSIGNED);
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ADMIN);
  const roles = await prisma.adminRole.findMany({ where: { id: { in: roleIds } } });
  if (roles.length !== roleIds.length) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ROLE);
  await prisma.adminUserRole.deleteMany({ where: { userId: id } });
  const updated = await prisma.adminUser.update({
    where: { id },
    data: { userRoles: { create: roleIds.map((roleId) => ({ roleId })) } },
    include: accountInclude,
  });
  return mapAccount(updated);
}

async function ensureNotSelf(targetId: number, actorId: number, code: string, key: string) {
  if (targetId === actorId) throw bad(code, key);
}

async function ensureNotLastActive(userId: number) {
  const active = await prisma.adminUser.count({ where: { status: "ACTIVE" } });
  const user = await prisma.adminUser.findUnique({ where: { id: userId } });
  if (user?.status === "ACTIVE" && active <= 1) throw bad(Codes.LAST_ADMIN, Msg.LAST_ADMIN);
}

export async function activateAccount(id: number) {
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ADMIN);
  const updated = await prisma.adminUser.update({
    where: { id },
    data: { status: "ACTIVE" },
    include: accountInclude,
  });
  return mapAccount(updated);
}

export async function deactivateAccount(id: number, actorId: number) {
  await ensureNotSelf(id, actorId, Codes.CANNOT_MODIFY_SELF, Msg.CANNOT_MODIFY_SELF);
  await ensureNotLastActive(id);
  const updated = await prisma.adminUser.update({
    where: { id },
    data: { status: "INACTIVE" },
    include: accountInclude,
  });
  return mapAccount(updated);
}

export async function deleteAccount(id: number, actorId: number) {
  await ensureNotSelf(id, actorId, Codes.CANNOT_DELETE_SELF, Msg.CANNOT_DELETE_SELF);
  await ensureNotLastActive(id);
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ADMIN);
  await prisma.adminUser.delete({ where: { id } });
}

function mapRole(role: {
  id: number;
  name: string;
  description: string | null;
  systemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions: { permission: string }[];
}) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    systemRole: role.systemRole,
    permissions: role.permissions.map((p) => p.permission).sort(),
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

export function listPermissions() {
  return [...PERMISSIONS];
}

export async function listRoles() {
  const roles = await prisma.adminRole.findMany({
    include: { permissions: true },
    orderBy: { name: "asc" },
  });
  return roles.map(mapRole);
}

export async function getRole(id: number) {
  const role = await prisma.adminRole.findUnique({ where: { id }, include: { permissions: true } });
  if (!role) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ROLE);
  return mapRole(role);
}

export async function createRole(body: { name: string; description?: string; permissions: string[] }) {
  const name = body.name.trim();
  const exists = await prisma.adminRole.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
  if (exists) throw bad(Codes.ROLE_NAME_EXISTS, Msg.ROLE_NAME_EXISTS, name);
  const role = await prisma.adminRole.create({
    data: {
      name,
      description: body.description?.trim() || null,
      systemRole: false,
      permissions: {
        create: [...new Set(body.permissions)].map((permission) => ({ permission })),
      },
    },
    include: { permissions: true },
  });
  return mapRole(role);
}

export async function updateRole(
  id: number,
  body: { name: string; description?: string; permissions: string[] },
) {
  const role = await prisma.adminRole.findUnique({ where: { id } });
  if (!role) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ROLE);
  if (role.systemRole || role.name === SUPER_ADMIN_ROLE) {
    throw bad(Codes.SYSTEM_ROLE_PROTECTED, Msg.SYSTEM_ROLE_PROTECTED);
  }
  const name = body.name.trim();
  const clash = await prisma.adminRole.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, NOT: { id } },
  });
  if (clash) throw bad(Codes.ROLE_NAME_EXISTS, Msg.ROLE_NAME_EXISTS, name);
  await prisma.adminRolePermission.deleteMany({ where: { roleId: id } });
  const updated = await prisma.adminRole.update({
    where: { id },
    data: {
      name,
      description: body.description?.trim() || null,
      permissions: {
        create: [...new Set(body.permissions)].map((permission) => ({ permission })),
      },
    },
    include: { permissions: true },
  });
  return mapRole(updated);
}

export async function deleteRole(id: number) {
  const role = await prisma.adminRole.findUnique({
    where: { id },
    include: { userRoles: true },
  });
  if (!role) throw notFound(Codes.NOT_FOUND, Msg.NOT_FOUND, Msg.ENTITY_ROLE);
  if (role.systemRole || role.name === SUPER_ADMIN_ROLE) {
    throw bad(Codes.SYSTEM_ROLE_PROTECTED, Msg.SYSTEM_ROLE_PROTECTED);
  }
  if (role.userRoles.length) throw bad(Codes.ROLE_IN_USE, Msg.ROLE_IN_USE);
  await prisma.adminRole.delete({ where: { id } });
}
