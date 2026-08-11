import type { ProjectMember } from "@/features/projects/types/api.types";
import { positionLabel } from "@/features/projects/types/labels";

/**
 * Filtra integrantes por nombre completo, correo o cargo (texto libre).
 * La búsqueda no distingue mayúsculas y compara también el cargo crudo
 * (ej. "experto_tematico") y su etiqueta legible (ej. "Experto temático").
 */
export function filterMembers<T extends ProjectMember>(members: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return members;
  }
  return members.filter((m) => {
    const fullName = `${m.name} ${m.last_name}`.toLowerCase();
    const email = m.email.toLowerCase();
    const rawPosition = m.position.toLowerCase();
    const label = positionLabel(m.position).toLowerCase();
    return (
      fullName.includes(q) || email.includes(q) || rawPosition.includes(q) || label.includes(q)
    );
  });
}
