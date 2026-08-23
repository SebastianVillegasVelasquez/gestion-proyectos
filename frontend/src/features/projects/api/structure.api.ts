import http from "@/lib/http";
import type {
  CloneWorkItemPayload,
  CreateTipoNodoPayload,
  CreateWorkItemPayload,
  MoveWorkItemPayload,
  ShiftWorkItemSubtreePayload,
  TipoNodo,
  UpdateTipoNodoPayload,
  UpdateWorkItemPayload,
  WorkItem,
  WorkItemDependency,
  WorkItemTree,
} from "@/features/projects/types/api.types";

export const structureApi = {
  // ── Tipos de nodo (catálogo configurable por proyecto) ──────────────────────
  listTypes: (projectId: string) =>
    http.get<TipoNodo[]>(`/projects/${projectId}/node-types`).then((r) => r.data),

  createType: (projectId: string, payload: CreateTipoNodoPayload) =>
    http.post<TipoNodo>(`/projects/${projectId}/node-types`, payload).then((r) => r.data),

  updateType: (typeId: string, payload: UpdateTipoNodoPayload) =>
    http.patch<TipoNodo>(`/node-types/${typeId}`, payload).then((r) => r.data),

  deleteType: (typeId: string) => http.delete(`/node-types/${typeId}`).then(() => undefined),

  // ── Nodos del árbol de trabajo ──────────────────────────────────────────────
  tree: (projectId: string) =>
    http.get<WorkItemTree[]>(`/projects/${projectId}/work-items`).then((r) => r.data),

  create: (projectId: string, payload: CreateWorkItemPayload) =>
    http.post<WorkItem>(`/projects/${projectId}/work-items`, payload).then((r) => r.data),

  update: (itemId: string, payload: UpdateWorkItemPayload) =>
    http.patch<WorkItem>(`/work-items/${itemId}`, payload).then((r) => r.data),

  remove: (itemId: string) => http.delete(`/work-items/${itemId}`).then(() => undefined),

  /** Recoloca un elemento (drag & drop del árbol): nuevo padre y/o orden. */
  move: (itemId: string, payload: MoveWorkItemPayload) =>
    http.post<WorkItem>(`/work-items/${itemId}/move`, payload).then((r) => r.data),

  /** Desplaza en el tiempo el subárbol completo (drag de la barra del nodo). */
  shift: (itemId: string, payload: ShiftWorkItemSubtreePayload) =>
    http.post<WorkItem>(`/work-items/${itemId}/shift`, payload).then((r) => r.data),

  /** Duplica un elemento con todo su contenido bajo el destino (spec §9). */
  clone: (itemId: string, payload: CloneWorkItemPayload) =>
    http.post<WorkItem>(`/work-items/${itemId}/clone`, payload).then((r) => r.data),

  // ── Dependencias Finish-to-Start entre nodos ────────────────────────────────
  addDependency: (itemId: string, dependsOnId: string) =>
    http
      .post<WorkItemDependency>(`/work-items/${itemId}/dependencies`, {
        depends_on_id: dependsOnId,
      })
      .then((r) => r.data),

  listDependencies: (itemId: string) =>
    http.get<WorkItemDependency[]>(`/work-items/${itemId}/dependencies`).then((r) => r.data),

  removeDependency: (itemId: string, dependsOnId: string) =>
    http.delete(`/work-items/${itemId}/dependencies/${dependsOnId}`).then(() => undefined),
};
