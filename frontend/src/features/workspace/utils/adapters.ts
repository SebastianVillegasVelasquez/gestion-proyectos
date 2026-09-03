import type { ApiComment, ApiDeliverable, ApiTeamMember, ApiVersion } from "../api/workspace.api";
import type { Deliverable, DeliverableVersion, FeedbackComment, WorkspaceMember } from "../types";

// Paleta determinística de avatares (mantiene los colores del diseño).
const AVATAR_COLORS = [
  "bg-violet-600",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-indigo-600",
  "bg-teal-600",
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initials(name: string, lastName: string): string {
  return ((name[0] ?? "") + (lastName[0] ?? "")).toUpperCase();
}

/** Mapea un integrante del backend al view-model de la UI (color/iniciales). */
export function mapMember(m: ApiTeamMember): WorkspaceMember {
  return {
    id: m.user_id,
    name: `${m.name} ${m.last_name}`.trim(),
    initials: initials(m.name, m.last_name),
    avatarColor: AVATAR_COLORS[hash(m.user_id) % AVATAR_COLORS.length],
    role: m.team_role,
  };
}

function mapVersion(v: ApiVersion): DeliverableVersion {
  return {
    id: v.id,
    versionNumber: v.version_number,
    type: v.type,
    url: v.url,
    fileId: v.file_id,
    fileProjectId: v.file_project_id,
    fileName: v.file_name ?? undefined,
    mimeType: v.file_content_type ?? undefined,
    fileSizeBytes: v.file_size_bytes ?? undefined,
    uploadedBy: v.uploaded_by,
    uploadedAt: v.uploaded_at,
    note: v.note ?? "",
    observations: v.observations ?? "",
  };
}

function mapComment(c: ApiComment): FeedbackComment {
  return {
    id: c.id,
    authorId: c.author_id,
    content: c.content,
    createdAt: c.created_at,
    type: c.type,
    mentions: c.mentions,
  };
}

export function mapDeliverable(d: ApiDeliverable): Deliverable {
  return {
    id: d.id,
    taskTitle: d.task_title,
    assigneeId: d.assignee_id,
    taskId: d.task_id,
    status: d.status,
    versions: d.versions.map(mapVersion),
    comments: d.comments.map(mapComment),
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}
