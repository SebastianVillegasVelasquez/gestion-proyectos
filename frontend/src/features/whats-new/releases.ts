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

/** Predicado: ¿esta novedad le concierne a un usuario según si es de rol elevado? */
export function isRelevant(release: ReleaseNote, isElevated: boolean): boolean {
  if (release.audience === "all") {
    return true;
  }
  return release.audience === "elevated" ? isElevated : !isElevated;
}

/** Novedades que le conciernen a un usuario según su rol (todas, vistas o no). */
export function relevantReleases(isElevated: boolean): ReleaseNote[] {
  return RELEASES.filter((r) => isRelevant(r, isElevated));
}

/** De las relevantes, las que aún no están en el set de vistas (persistido). */
export function unseenReleases(seenIds: string[], isElevated: boolean): ReleaseNote[] {
  const seen = new Set(seenIds);
  return relevantReleases(isElevated).filter((r) => !seen.has(r.id));
}
