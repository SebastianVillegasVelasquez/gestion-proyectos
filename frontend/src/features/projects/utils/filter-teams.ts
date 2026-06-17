import type { Team } from "@/features/projects/types/api.types";

/**
 * Filtra equipos por nombre o descripción (texto libre, sin distinguir
 * mayúsculas). Es una función pura: misma entrada → misma salida, fácil de
 * testear y reutilizar fuera de React.
 */
export function filterTeams(teams: Team[], query: string): Team[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return teams;
  }
  return teams.filter((team) => {
    const name = team.name.toLowerCase();
    const description = (team.description ?? "").toLowerCase();
    return name.includes(q) || description.includes(q);
  });
}

/** Iniciales de un equipo para el avatar (ej. "Equipo de Desarrollo" → "ED"). */
export function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? (words[words.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
