// ── Deliverable status ─────────────────────────────────────────────────────

export type DeliverableStatus = "borrador" | "en_revision" | "aprobado" | "cambios_solicitados";

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  borrador: "Borrador",
  en_revision: "En Revisión",
  aprobado: "Aprobado",
  cambios_solicitados: "Cambios Solicitados",
};

export const DELIVERABLE_STATUS_BADGE: Record<DeliverableStatus, string> = {
  borrador:
    "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  en_revision:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  aprobado:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
  cambios_solicitados:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
};

// ── Resource / comment types ───────────────────────────────────────────────

/**
 * Tipo de recurso entregado. Refleja las necesidades del negocio (virtualización
 * de cursos + TI): enlaces (Figma/Drive), repositorios de código, paquetes SCORM
 * para el LMS y archivos. `archivo` es un nice-to-have aún NO disponible.
 */
export type ResourceType = "enlace" | "repositorio" | "scorm" | "archivo";

/** Alias retrocompatible. */
export type VersionType = ResourceType;

export type CommentType = "comentario" | "solicitud_cambio" | "aprobacion";

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
  url: string;
  fileName?: string;
  mimeType?: string;
  uploadedBy: string; // WorkspaceMember.id
  uploadedAt: string; // ISO
  note: string;
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
  status: DeliverableStatus;
  versions: DeliverableVersion[];
  comments: FeedbackComment[];
  createdAt: string;
  updatedAt: string;
}

export interface GroupTask {
  id: string;
  title: string;
  assigneeId: string;
  status: "por_hacer" | "en_progreso" | "completado";
  priority: "baja" | "media" | "alta";
}

export const GROUP_TASK_STATUS_LABELS: Record<GroupTask["status"], string> = {
  por_hacer: "Por hacer",
  en_progreso: "En progreso",
  completado: "Completado",
};

export const GROUP_TASK_PRIORITY_COLOR: Record<GroupTask["priority"], string> = {
  baja: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  media: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  alta: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

export interface WorkspaceGroup {
  id: string;
  name: string;
  description: string;
  leaderId: string;
  members: WorkspaceMember[];
  tasks: GroupTask[];
  deliverables: Deliverable[];
  createdAt: string;
}
