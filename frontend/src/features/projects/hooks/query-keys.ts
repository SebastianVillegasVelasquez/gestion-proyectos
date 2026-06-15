// Fábrica central de claves de cache. Mantenerlas aquí evita strings mágicos
// dispersos y permite invalidaciones consistentes (ej. invalidar projectKeys.all
// refresca todas las listas y detalles de proyectos a la vez).

export const projectKeys = {
  all: ["projects"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
  phases: (id: string) => [...projectKeys.detail(id), "phases"] as const,
  nodes: (id: string) => [...projectKeys.detail(id), "nodes"] as const,
  members: (id: string) => [...projectKeys.detail(id), "members"] as const,
};

export const userKeys = {
  all: ["users"] as const,
  list: () => [...userKeys.all, "list"] as const,
};

export const taskKeys = {
  all: ["tasks"] as const,
  byProject: (projectId: string) => [...taskKeys.all, "project", projectId] as const,
  dependencies: (projectId: string, taskId: string) =>
    [...taskKeys.all, "deps", projectId, taskId] as const,
};

export const directoryKeys = {
  all: ["directory"] as const,
  list: (position?: string) => [...directoryKeys.all, position ?? "todos"] as const,
};
