// Fábrica central de claves de cache. Mantenerlas aquí evita strings mágicos
// dispersos y permite invalidaciones consistentes (ej. invalidar projectKeys.all
// refresca todas las listas y detalles de proyectos a la vez).

export const projectKeys = {
  all: ["projects"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
  tree: (id: string) => [...projectKeys.detail(id), "tree"] as const,
  nodeTypes: (id: string) => [...projectKeys.detail(id), "node-types"] as const,
  trash: (id: string) => [...projectKeys.detail(id), "trash"] as const,
  members: (id: string) => [...projectKeys.detail(id), "members"] as const,
  traceability: (id: string, teamId?: string) =>
    [...projectKeys.detail(id), "traceability", ...(teamId ? [teamId] : [])] as const,
  areas: (id: string) => [...projectKeys.detail(id), "areas"] as const,
  clientAccess: (id: string) => [...projectKeys.detail(id), "client-access"] as const,
  notes: (id: string) => [...projectKeys.detail(id), "notes"] as const,
};

export const workItemKeys = {
  all: ["work-items"] as const,
  deps: (itemId: string) => [...workItemKeys.all, itemId, "deps"] as const,
};

export const userKeys = {
  all: ["users"] as const,
  list: () => [...userKeys.all, "list"] as const,
};

export const taskKeys = {
  all: ["tasks"] as const,
  byProject: (projectId: string) => [...taskKeys.all, "project", projectId] as const,
  byWorkItem: (workItemId: string) => [...taskKeys.all, "work-item", workItemId] as const,
  dependencies: (taskId: string) => [...taskKeys.all, "deps", taskId] as const,
  effort: (taskId: string) => [...taskKeys.all, "effort", taskId] as const,
  comments: (taskId: string) => [...taskKeys.all, "comments", taskId] as const,
  projectDependencies: (projectId: string) => [...taskKeys.all, "project-deps", projectId] as const,
};

export const teamKeys = {
  all: ["teams"] as const,
  byProject: (projectId: string) => [...teamKeys.all, "project", projectId] as const,
  list: (projectId: string, params: { search?: string; page?: number; pageSize?: number }) =>
    [
      ...teamKeys.byProject(projectId),
      "list",
      params.search ?? "",
      params.page ?? 1,
      params.pageSize ?? 50,
    ] as const,
  mine: (projectId: string) => [...teamKeys.byProject(projectId), "mine"] as const,
  detail: (projectId: string, id: string) =>
    [...teamKeys.byProject(projectId), "detail", id] as const,
  members: (projectId: string, id: string) =>
    [...teamKeys.detail(projectId, id), "members"] as const,
};

export const directoryKeys = {
  all: ["directory"] as const,
  list: (position?: string) => [...directoryKeys.all, position ?? "todos"] as const,
  search: (params: { search?: string; position?: string; page?: number; pageSize?: number }) =>
    [
      ...directoryKeys.all,
      "search",
      params.search ?? "",
      params.position ?? "",
      params.page ?? 1,
      params.pageSize ?? 8,
    ] as const,
};
