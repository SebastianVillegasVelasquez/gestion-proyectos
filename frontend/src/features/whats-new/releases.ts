// Novedades ("qué hay de nuevo") que se muestran UNA vez por usuario al iniciar
// sesión. Cada release declara a qué audiencia le concierne (todos, roles
// elevados o usuarios normales) y se recuerda como vista en localStorage por
// usuario, para no volver a mostrarla.

export type ReleaseAudience = "all" | "elevated" | "normal";

export interface ReleaseNote {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  audience: ReleaseAudience;
  items: string[];
}

// De la más reciente a la más antigua.
export const RELEASES: ReleaseNote[] = [
  {
    id: "2026-08-cronograma-elevated",
    date: "2026-08-09",
    title: "Cronograma más potente",
    audience: "elevated",
    items: [
      "Arrastra y estira las barras para reprogramar tareas sin abrir el panel.",
      "Flechas de dependencia (finish-to-start) entre tareas.",
      "Avance ponderado por duración y KPIs calculados sobre trabajo real.",
      "Filtros con «Limpiar» y botón para colapsar/expandir todo; scroll más limpio.",
    ],
  },
  {
    id: "2026-08-tabla-tareas-elevated",
    date: "2026-08-09",
    title: "Tabla de tareas renovada",
    audience: "elevated",
    items: [
      "Los títulos largos ya no tapan el estado ni el resto de columnas.",
      "La asignación se muestra de solo lectura; se reasigna desde la edición.",
      "Botón «Asignar» con modal para las tareas que aún no tienen responsable.",
    ],
  },
  {
    id: "2026-08-notas-all",
    date: "2026-08-09",
    title: "Notas en los proyectos",
    audience: "all",
    items: [
      "En el detalle del proyecto, debajo del progreso, ya puedes agregar notas con fecha.",
      "Úsalas para dejar claro un problema, una anomalía o algo que recordar.",
    ],
  },
];

const storageKey = (userId: string) => `whatsnew-seen:${userId}`;

export function readSeen(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function markSeen(userId: string, ids: string[]): void {
  try {
    const next = readSeen(userId);
    ids.forEach((id) => next.add(id));
    localStorage.setItem(storageKey(userId), JSON.stringify([...next]));
  } catch {
    // Sin persistencia si el almacenamiento no está disponible; no es crítico.
  }
}

/** Predicado: ¿esta novedad le concierne a un usuario según si es de rol elevado? */
export function isRelevant(release: ReleaseNote, isElevated: boolean): boolean {
  if (release.audience === "all") {
    return true;
  }
  return release.audience === "elevated" ? isElevated : !isElevated;
}

/** Novedades que el usuario aún no ha visto y que le conciernen por su rol. */
export function unseenReleases(userId: string, isElevated: boolean): ReleaseNote[] {
  const seen = readSeen(userId);
  return RELEASES.filter((r) => isRelevant(r, isElevated) && !seen.has(r.id));
}
