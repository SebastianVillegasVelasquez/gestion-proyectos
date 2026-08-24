// Novedades ("qué hay de nuevo") que se muestran UNA vez por usuario al iniciar
// sesión. Cada release declara a qué audiencia le concierne (todos, roles
// elevados o usuarios normales) y se recuerda como vista en el backend (por
// usuario), para no volver a mostrarla.

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
    id: "2026-08-24-estructura-tipos-elevated",
    date: "2026-08-24",
    title: "Estructura y tipos más claros",
    audience: "elevated",
    items: [
      "Desde la Estructura ya puedes saltar al Cronograma con un botón, junto a «Añadir elemento».",
      "Se quitó la vista de lista de la Estructura para dejar solo el árbol.",
      "Los chips de tipo se comportan mejor: un click muestra editar/eliminar y otro los oculta, sin dejar la página atenuada.",
      "Al eliminar un tipo, sus elementos ya no quedan sueltos: pasan a un tipo «Elemento» real que puedes editar y filtrar (también en el Cronograma).",
    ],
  },
  {
    id: "2026-08-11-integrantes-pago-elevated",
    date: "2026-08-11",
    title: "Avance de pago por integrante",
    audience: "elevated",
    items: [
      "La vista de Integrantes ahora es una tabla con nombre, correo, cargo y rol, con orden por columna y paginación para proyectos con muchas personas.",
      "Cada integrante muestra su % de avance en ESE proyecto (nunca mezclado con otros proyectos donde también participe): pondera cada tarea según qué tan profundo está su nodo en la estructura, no solo cuántas tareas tiene completadas.",
      "Al llegar al 100% se marca «Listo para pago».",
    ],
  },
  {
    id: "2026-08-11-tareas-flujo-elevated",
    date: "2026-08-11",
    title: "Se arregló aprobar tareas",
    audience: "elevated",
    items: [
      "Aprobar una entrega (pasarla a completada) ya no fallaba en silencio — el bug de fondo era una notificación mal configurada, no un problema de permisos.",
      "La tabla de tareas ahora solo ofrece los cambios de estado que en verdad puedes hacer según tu rol, con orden por columna y paginación.",
    ],
  },
  {
    id: "2026-08-11-detalle-proyecto-metricas-elevated",
    date: "2026-08-11",
    title: "Detalle de proyecto con métricas",
    audience: "elevated",
    items: [
      "Nueva franja de estado con el progreso, tareas restantes/atrasadas y días para el cierre, de un vistazo.",
      "Un solo panel de gráficos para alternar entre tareas por estado y desempeño de entregas en el tiempo.",
      "Próximos vencimientos, actividad reciente y notas del proyecto, todo reorganizado en el mismo lugar.",
    ],
  },
  {
    id: "2026-08-11-feedback-configuracion-all",
    date: "2026-08-11",
    title: "El feedback se mudó",
    audience: "all",
    items: [
      "El botón flotante de feedback ya no está sobre toda la app: ahora vive en Configuración, junto a tu perfil.",
    ],
  },
  {
    id: "2026-08-detalle-proyecto-elevated",
    date: "2026-08-09",
    title: "Detalle del proyecto más limpio",
    audience: "elevated",
    items: [
      "Compartir el enlace del cliente ahora es un botón compacto en el encabezado.",
      "El progreso general y las secciones quedan alineados y ocupan todo el ancho.",
      "La actividad reciente del panel principal ya muestra eventos reales (creación, entrega, aprobación…).",
    ],
  },
  {
    id: "2026-08-portal-cronograma-elevated",
    date: "2026-08-09",
    title: "Portal del cliente con cronograma detallado",
    audience: "elevated",
    items: [
      "El cronograma que ve el cliente ahora incluye las tareas de cada componente, no solo la estructura.",
      "Se muestra más grande y con los mismos filtros; nunca expone responsables ni equipos.",
    ],
  },
  {
    id: "2026-08-lectura-comoda-all",
    date: "2026-08-09",
    title: "Se lee más cómodo",
    audience: "all",
    items: [
      "Subimos un punto el tamaño de la letra en toda la aplicación.",
      "Barra de desplazamiento más moderna y discreta.",
    ],
  },
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
