import { useCallback, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  hasAnyPermission,
  hasPermission,
  type Permission,
} from "@/lib/permissions";

export function usePermission() {
  const { user } = useAuth();

  const can = useCallback(
    (permission: Permission) =>
      hasPermission(user?.role, permission, user?.permissions),
    [user?.role, user?.permissions],
  );

  const canAny = useCallback(
    (permissions: Permission[]) =>
      hasAnyPermission(user?.role, permissions, user?.permissions),
    [user?.role, user?.permissions],
  );

  return useMemo(
    () => ({
      can,
      canAny,
      role: user?.role,
      permissions: user?.permissions,
      user,
    }),
    [can, canAny, user],
  );
}
