import { Role, roleRank } from "@/features/auth/types";
import { readViewAsTeamRole } from "./view-as-team-role";

const KEY = "view_as_role";

/** Mensaje que ve quien intenta cambiar algo mientras previsualiza otro rol. */
export const PREVIEW_READ_ONLY_MESSAGE =
  "Estás en vista previa de otro rol: las acciones están desactivadas. Vuelve a tu vista para actuar.";

/** Roles que `real` puede previsualizar: los de rango INFERIOR al suyo. Nadie
 *  puede «verse» con más poder del que tiene, y un usuario sin roles por debajo
 *  no tiene nada que previsualizar. */
export function previewableRoles(real: Role | null | undefined): Role[] {
  if (!real) {
    return [];
  }
  return [Role.SUPER_ADMIN, Role.ADMIN, Role.USER].filter((r) => roleRank(r) < roleRank(real));
}

/** Rol guardado para esta pestaña (sessionStorage: se descarta al cerrarla, así
 *  una vista previa olvidada no sobrevive a la sesión de trabajo). */
export function readViewAsRole(): Role | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return (Object.values(Role) as string[]).includes(raw ?? "") ? (raw as Role) : null;
  } catch {
    return null;
  }
}

export function writeViewAsRole(role: Role | null): void {
  try {
    if (role) {
      sessionStorage.setItem(KEY, role);
    } else {
      sessionStorage.removeItem(KEY);
    }
  } catch {
    // Sin sessionStorage (modo privado estricto) la vista previa dura lo que
    // dure el estado en memoria: no es motivo para romper nada.
  }
}

/** ¿Hay una vista previa activa? Lo consulta el cliente HTTP para impedir
 *  escrituras: previsualizar es mirar, no actuar con otro sombrero. */
export function isPreviewing(): boolean {
  return readViewAsRole() !== null || readViewAsTeamRole() !== null;
}
