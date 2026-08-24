import bcrypt from "bcryptjs";
import { prisma } from "./db.js";
import { config } from "./config.js";
import { PERMISSIONS, SUPER_ADMIN_ROLE } from "./permissions.js";

export async function bootstrapAdmin() {
  const now = new Date();
  const role = await prisma.adminRole.upsert({
    where: { name: SUPER_ADMIN_ROLE },
    create: {
      name: SUPER_ADMIN_ROLE,
      description: "Full access",
      systemRole: true,
      updatedAt: now,
      permissions: {
        create: PERMISSIONS.map((permission) => ({ permission })),
      },
    },
    update: { systemRole: true, updatedAt: now },
  });

  const existingPerms = await prisma.adminRolePermission.findMany({ where: { roleId: role.id } });
  const held = new Set(existingPerms.map((p) => p.permission));
  const missing = PERMISSIONS.filter((p) => !held.has(p));
  if (missing.length) {
    await prisma.adminRolePermission.createMany({
      data: missing.map((permission) => ({ roleId: role.id, permission })),
    });
  }

  if (!config.bootstrap.enabled || !config.bootstrap.email || !config.bootstrap.password) {
    return;
  }

  const email = config.bootstrap.email.trim().toLowerCase();
  const password = await bcrypt.hash(config.bootstrap.password, 10);
  const existing = await prisma.adminUser.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });

  if (existing) {
    await prisma.adminUser.update({
      where: { id: existing.id },
      data: {
        firstName: config.bootstrap.firstName.trim(),
        lastName: config.bootstrap.lastName.trim(),
        password,
        status: "ACTIVE",
      },
    });
    await prisma.adminUserRole.upsert({
      where: { userId_roleId: { userId: existing.id, roleId: role.id } },
      create: { userId: existing.id, roleId: role.id },
      update: {},
    });
    return;
  }

  await prisma.adminUser.create({
    data: {
      email,
      firstName: config.bootstrap.firstName.trim(),
      lastName: config.bootstrap.lastName.trim(),
      password,
      status: "ACTIVE",
      userRoles: { create: { roleId: role.id } },
    },
  });
}
