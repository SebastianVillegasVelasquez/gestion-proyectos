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
    id: "2026-09-07-manual-usuario-all",
    date: "2026-09-07",
    title: "Ya hay manual de usuario",
    audience: "all",
    items: [
      "Nueva opción [Manual de usuario] en el menú lateral: una guía con el índice de temas a la izquierda y buscador, para aprender a usar la aplicación sin preguntarle a nadie.",
      "Está partido por rol: una guía para el integrante (encontrar tu trabajo, comenzarlo, entregarlo y responder a las revisiones) y otra para quien lidera (repartir el trabajo, revisar entregas y hacer seguimiento).",
      "Cubre lo importante paso a paso: cómo entregar con o sin adjunto, qué significa cada estado, por qué una tarea sale «Bloqueada», y cómo funcionan los entregables y sus versiones.",
      "Dentro de la aplicación verás enlaces de ayuda (?) junto a los controles: te llevan directo al tema del manual que los explica.",
      "Incluye un apartado para el video de recorrido guiado, que se publicará ahí mismo.",
    ],
  },
  {
    id: "2026-09-06-entrega-un-paso-all",
    date: "2026-09-06",
    title: "Entregar es un solo paso, con o sin adjunto",
    audience: "all",
    items: [
      "Al pulsar «Comenzar» en una tarea tuya ya aparecen dos botones: «Entregar» (adjuntas una URL o un archivo y se crea el entregable en el mismo paso) y «Entregar sin adjunto».",
      "«Entregar sin adjunto» da la tarea por hecha directamente: pasa al 100%, avisa a quien coordina y no crea ningún entregable ni pasa por revisión.",
      "Antes, tras «Comenzar» no había forma de entregar una tarea suelta y se quedaba «en progreso» sin salida. Ya no.",
      "Para una tarea con subtareas, los dos botones aparecen en la tarea principal cuando todas sus subtareas están hechas; cada subtarea tiene también sus dos botones al comenzarla. Si la tarea depende de otra que no está lista, sigue mostrándose «Bloqueada».",
      "Este mismo flujo funciona igual en el espacio de trabajo del equipo y en «Mis tareas».",
    ],
  },
  {
    id: "2026-09-06-archivos-explorador-all",
    date: "2026-09-06",
    title: "Archivos con vista de explorador",
    audience: "all",
    items: [
      "El archivador del proyecto se navega ahora carpeta por carpeta, con una ruta de migas para volver — como en Google Drive.",
      "Puedes alternar entre lista y cuadrícula, buscar dentro de la carpeta abierta y arrastrar un archivo directamente sobre ella para subirlo.",
      "Cada archivo muestra su icono según el tipo, quién lo subió, la fecha y el tamaño.",
      "Crear una carpeta y borrar usan ahora un diálogo propio, sin las ventanitas del navegador.",
    ],
  },
  {
    id: "2026-09-06-feedback-administracion-elevated",
    date: "2026-09-06",
    title: "Bandeja de feedback para administración",
    audience: "elevated",
    items: [
      "«Feedback» aparece ahora en el menú lateral también para admin y super administrador, no solo para el rol técnico.",
      "Desde ahí se ve todo el feedback que envían los usuarios y se le cambia el estado (realizado, imposible, etc.).",
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
