"use client";

import { hasPermission } from "../../lib/permissions-catalog";
import { useERP } from "../../context/ERPContext";

export function usePermission(permission) {
  const { sessao } = useERP();
  return hasPermission(sessao, permission);
}

export default function PermissionGate({ permission, fallback = null, children }) {
  const allowed = usePermission(permission);
  return allowed ? children : fallback;
}

