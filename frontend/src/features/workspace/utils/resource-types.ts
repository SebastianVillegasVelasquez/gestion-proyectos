import {
  Ban,
  File,
  GitBranch,
  GraduationCap,
  Link as LinkIcon,
  type LucideIcon,
} from "lucide-react";
import type { ResourceType } from "../types";

export interface ResourceMeta {
  label: string;
  Icon: LucideIcon;
  /** color del icono (mantiene la paleta del workspace) */
  color: string;
  /** clases del chip (bg + texto + borde) */
  chip: string;
  /** ¿se puede subir hoy? (archivo es nice-to-have, aún no) */
  available: boolean;
  placeholder: string;
  hint: string;
}

/**
 * Catálogo de tipos de recurso entregable, cada uno con su icono e identidad
 * visual. Pensado para una empresa de virtualización de cursos que crece a TI.
 */
export const RESOURCE_META: Record<ResourceType, ResourceMeta> = {
  enlace: {
    label: "Enlace",
    Icon: LinkIcon,
    color: "text-sky-500",
    chip: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800",
    available: true,
    placeholder: "https://figma.com/proto/…   ·   https://drive.google.com/…",
    hint: "Figma, Google Drive, Notion o documento publicado.",
  },
  repositorio: {
    label: "Repositorio",
    Icon: GitBranch,
    color: "text-violet-500",
    chip: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800",
    available: true,
    placeholder: "https://github.com/org/repo/pull/12",
    hint: "GitHub, GitLab o Bitbucket (PR, rama o commit).",
  },
  scorm: {
    label: "SCORM",
    Icon: GraduationCap,
    color: "text-amber-500",
    chip: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    available: true,
    placeholder: "https://lms.obj.com/scorm/curso-modulo1.zip",
    hint: "Paquete SCORM publicado en el LMS (URL del paquete).",
  },
  archivo: {
    label: "Archivo",
    Icon: File,
    color: "text-rose-500",
    chip: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
    available: false, // nice-to-have: subida de archivos aún no disponible
    placeholder: "",
    hint: "Subida de archivos — próximamente.",
  },
  sin_adjunto: {
    label: "Sin adjunto",
    Icon: Ban,
    color: "text-slate-400",
    chip: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    // No se elige en el formulario de subida: se genera al "entregar sin adjunto".
    available: false,
    placeholder: "",
    hint: "La persona confirmó que el trabajo está hecho; no hay recurso que abrir.",
  },
};

/** Tipos que el usuario puede entregar ahora mismo (excluye archivo). */
export const UPLOADABLE_RESOURCE_TYPES: ResourceType[] = ["enlace", "repositorio", "scorm"];

/** Heurística para sugerir el tipo de recurso a partir de la URL. */
export function detectResourceType(url: string): ResourceType {
  const u = url.toLowerCase();
  if (/(github\.com|gitlab\.com|bitbucket\.org)/.test(u)) {
    return "repositorio";
  }
  if (u.includes("scorm") || u.endsWith(".zip")) {
    return "scorm";
  }
  return "enlace";
}

/** Etiqueta legible del servicio de un enlace (Figma, Drive, GitHub…). */
export function detectService(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("figma.com")) {
    return "Figma";
  }
  if (u.includes("github.com")) {
    return "GitHub";
  }
  if (u.includes("gitlab.com")) {
    return "GitLab";
  }
  if (u.includes("drive.google")) {
    return "Google Drive";
  }
  if (u.includes("notion.so")) {
    return "Notion";
  }
  return "Enlace externo";
}

/** Nombre a mostrar para una entrega (servicio del enlace o nombre de archivo). */
export function resourceDisplayName(
  type: ResourceType,
  url: string | null,
  fileName?: string,
): string {
  if (type === "sin_adjunto") {
    return "Sin adjunto";
  }
  if (type === "archivo") {
    return fileName ?? "Archivo";
  }
  if (type === "enlace") {
    return detectService(url ?? "");
  }
  return RESOURCE_META[type].label;
}
