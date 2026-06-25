import http from "@/lib/http";
import type {
  CommentType,
  DeliverableStatus,
  ResourceType,
  TeamRole,
} from "@/features/workspace/types";

// ── Shapes del backend (snake_case) ─────────────────────────────────────────

export interface ApiMyTeam {
  id: string;
  name: string;
  description: string | null;
}

export interface ApiTeamMember {
  user_id: string;
  name: string;
  last_name: string;
  position: string;
  team_role: TeamRole;
}

export interface ApiWorkspaceAccess {
  team_role: TeamRole | null;
  can_view: boolean;
  can_deliver: boolean;
  can_review: boolean;
}

export interface ApiVersion {
  id: string;
  version_number: number;
  type: ResourceType;
  url: string;
  note: string | null;
  uploaded_by: string;
  uploaded_at: string;
}

export interface ApiComment {
  id: string;
  author_id: string;
  content: string;
  type: CommentType;
  mentions: string[];
  created_at: string;
}

export interface ApiDeliverable {
  id: string;
  team_id: string;
  task_title: string;
  assignee_id: string;
  status: DeliverableStatus;
  versions: ApiVersion[];
  comments: ApiComment[];
  created_at: string;
  updated_at: string;
}

export interface NewVersionBody {
  type: ResourceType;
  url: string;
  note?: string;
}

export interface NewCommentBody {
  content: string;
  type: CommentType;
  mentions: string[];
}

const base = (teamId: string) => `/teams/${teamId}`;

export const workspaceApi = {
  myTeams: () => http.get<ApiMyTeam[]>("/teams/mine").then((r) => r.data),

  members: (teamId: string) =>
    http.get<ApiTeamMember[]>(`${base(teamId)}/members`).then((r) => r.data),

  access: (teamId: string) =>
    http.get<ApiWorkspaceAccess>(`${base(teamId)}/workspace/access`).then((r) => r.data),

  deliverables: (teamId: string) =>
    http.get<ApiDeliverable[]>(`${base(teamId)}/deliverables`).then((r) => r.data),

  createDeliverable: (teamId: string, body: { task_title: string; assignee_id: string }) =>
    http.post<ApiDeliverable>(`${base(teamId)}/deliverables`, body).then((r) => r.data),

  addVersion: (teamId: string, deliverableId: string, body: NewVersionBody) =>
    http
      .post<ApiDeliverable>(`${base(teamId)}/deliverables/${deliverableId}/versions`, body)
      .then((r) => r.data),

  addComment: (teamId: string, deliverableId: string, body: NewCommentBody) =>
    http
      .post<ApiDeliverable>(`${base(teamId)}/deliverables/${deliverableId}/comments`, body)
      .then((r) => r.data),
};
