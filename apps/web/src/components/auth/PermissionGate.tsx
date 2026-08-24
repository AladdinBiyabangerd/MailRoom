import type { ReactNode } from "react";
import { usePermission } from "@/hooks/use-permission";
import type { Permission } from "@/lib/permissions";

interface PermissionGateProps {
  permission?: Permission;
  anyOf?: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  permission,
  anyOf,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, canAny } = usePermission();

  const allowed = permission
    ? can(permission)
    : anyOf
      ? canAny(anyOf)
      : true;

  if (!allowed) return <>{fallback}</>;
  return <>{children}</>;
}
