// ── Deliverable status ─────────────────────────────────────────────────────

export type DeliverableStatus =
  | "borrador"
  | "en_revision"
  | "aprobado"
  | "cambios_solicitados"
  | "rechazado";

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  borrador: "Borrador",
  en_revision: "En Revisión",
  aprobado: "Aprobado",
  cambios_solicitados: "Cambios Solicitados",
  rechazado: "Rechazado",
};

export const DELIVERABLE_STATUS_BADGE: Record<DeliverableStatus, string> = {
  borrador:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  // Azul, no ambar: con cinco estados el ambar queda reservado para "cambios
  // solicitados" y asi los cinco se distinguen sin leer la etiqueta.
  en_revision:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
  aprobado:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  // "Cambios solicitados" es ambar (sigue vivo, espera otra version) y
  // "rechazado" es rojo (la entrega se cerro tal como estaba): el color debe
  // distinguirlos de un vistazo en la lista de entregables.
  cambios_solicitados:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  rechazado:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
};

// ── Resource / comment types ───────────────────────────────────────────────

/**
 * Tipo de recurso entregado. Refleja las necesidades del negocio (virtualización
 * de cursos + TI): enlaces (Figma/Drive), repositorios de código, paquetes SCORM
 * para el LMS y archivos. `archivo` es un nice-to-have aún NO disponible.
 */
export type ResourceType = "enlace" | "repositorio" | "scorm" | "archivo" | "sin_adjunto";

/** Alias retrocompatible. */
export type VersionType = ResourceType;

export type CommentType = "comentario" | "solicitud_cambio" | "aprobacion" | "rechazo";

// ── Team roles ──────────────────────────────────────────────────────────────

/**
 * Rol DENTRO del equipo de trabajo (distinto del rol de sistema y del de
 * proyecto). Solo líder y supervisor pueden revisar entregables
 * (solicitar cambios / aprobar); el integrante solo entrega y comenta.
 */
export type TeamRole = "lider" | "supervisor" | "integrante";

export const TEAM_ROLE_LABELS: Record<TeamRole, string> = {
  lider: "Líder",
  supervisor: "Supervisor",
  integrante: "Integrante",
};

/** ¿Este rol de equipo puede solicitar cambios o aprobar entregables? */
export function canReviewDeliverables(role: TeamRole | undefined): boolean {
  return role === "lider" || role === "supervisor";
}

// ── Core models ────────────────────────────────────────────────────────────

export interface WorkspaceMember {
  id: string;
  name: string;
  initials: string;
  avatarColor: string;
  role: TeamRole;
}

export interface DeliverableVersion {
  id: string;
  versionNumber: number;
  type: ResourceType;
  /** Nula en las entregas "sin adjunto". */
  url: string | null;
  fileName?: string;
  mimeType?: string;
  uploadedBy: string; // WorkspaceMember.id
  uploadedAt: string; // ISO
  note: string;
  /** Instrucciones de quien entrega para el siguiente rol de la cadena.
   * Trazabilidad interna del equipo: nunca se muestra al cliente. */
  observations: string;
}

export interface FeedbackComment {
  id: string;
  authorId: string; // WorkspaceMember.id
  content: string;
  createdAt: string; // ISO
  type: CommentType;
  mentions: string[]; // WorkspaceMember.id[]
}

export interface Deliverable {
  id: string;
  taskTitle: string;
  assigneeId: string;
  // Fase 2: `taskId` (opcional) engancha el entregable a una Task real; al
  // aprobar/rechazar aquí se mueve el estado de la tarea y queda en trazabilidad.
  taskId: string | null;
  status: DeliverableStatus;
  versions: DeliverableVersion[];
  comments: FeedbackComment[];
  createdAt: string;
  updatedAt: string;
}
