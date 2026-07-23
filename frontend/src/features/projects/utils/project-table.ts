import type { Project } from "../types/api.types";

/**
 * Utilidades puras de la tabla de proyectos. Separadas de la vista para poder
 * testearlas sin montar React (misma razón que filter-teams / gantt/timeline).
 */

/** Identificador corto y legible: primer bloque del UUID en mayúsculas. */
export function shortId(id: string): string {
  return id.split("-")[0].toUpperCase();
}

/** Monograma de la "marca" del proyecto: iniciales de las 2 primeras palabras. */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

// Paleta de tonos para el monograma. Determinista por nombre: el mismo
// proyecto siempre luce igual, sin necesidad de guardar un color en el backend.
export const MONOGRAM_TONES = [
  "bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold",
  "bg-brand-teal/15 text-brand-teal-dark dark:text-brand-teal",
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
] as const;

export function monogramTone(name: string): string {
  let hash = 0;
  for (const ch of name) {
    hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  }
  return MONOGRAM_TONES[hash % MONOGRAM_TONES.length];
}

/** Filtra por nombre, cliente o identificador corto (insensible a mayúsculas). */
export function filterProjects(projects: Project[], query: string): Project[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return projects;
  }
  return projects.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.client_name?.toLowerCase().includes(q) ?? false) ||
      shortId(p.id).toLowerCase().includes(q),
  );
}
