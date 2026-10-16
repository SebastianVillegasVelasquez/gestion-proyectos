import { useSyncExternalStore } from "react";
import type { TeamRole } from "@/features/workspace/types";
import type { ApiWorkspaceAccess } from "@/features/workspace/api/workspace.api";

/**
 * Segunda dimensión de la vista previa: además del rol de SISTEMA (ver
 * `view-as.ts`), quien administra puede ver un equipo «como» líder, supervisor
 * o integrante. Es un almacén aparte porque no depende de la sesión: es solo
 * una elección de esta pestaña, y así `AuthContext` no crece por cada dimensión.
 */
const KEY = "view_as_team_role";

export const PREVIEWABLE_TEAM_ROLES: TeamRole[] = ["lider", "supervisor", "integrante"];

const listeners = new Set<() => void>();

export function readViewAsTeamRole(): TeamRole | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return PREVIEWABLE_TEAM_ROLES.find((r) => r === raw) ?? null;
  } catch {
    return null;
  }
}

export function writeViewAsTeamRole(role: TeamRole | null): void {
  try {
    if (role) {
      sessionStorage.setItem(KEY, role);
    } else {
      sessionStorage.removeItem(KEY);
    }
  } catch {
    // Sin sessionStorage la vista previa simplemente no se recuerda.
  }
  listeners.forEach((notify) => {
    notify();
  });
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

/** Rol de equipo previsualizado (o `null`), reactivo a los cambios. */
export function useViewAsTeamRole(): TeamRole | null {
  return useSyncExternalStore(subscribe, readViewAsTeamRole, () => null);
}

/**
 * Permisos que tendría quien ocupa `role` en el equipo. Espeja la regla del
 * backend: solo líder y supervisor revisan; todos los miembros ven y entregan.
 */
export function accessForTeamRole(role: TeamRole): ApiWorkspaceAccess {
  return {
    team_role: role,
    can_view: true,
    can_deliver: true,
    can_review: role === "lider" || role === "supervisor",
  };
}

/** Sustituye el acceso real por el del rol previsualizado, si lo hay. */
export function applyTeamRolePreview(
  access: ApiWorkspaceAccess,
  role: TeamRole | null,
): ApiWorkspaceAccess {
  return role ? accessForTeamRole(role) : access;
}
