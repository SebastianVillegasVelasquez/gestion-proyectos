import { useQueries } from "@tanstack/react-query";
import { tasksApi } from "@/features/projects/api/tasks.api";
import { taskKeys } from "./query-keys";
import type { ProjectNode, Task } from "@/features/projects/types/api.types";

/**
 * Carga las tareas de todos los nodos del proyecto en paralelo (una query por
 * nodo, compartiendo la misma queryKey que useNodeTasks para reusar cache).
 */
export function useProjectTasks(projectId: string, nodes: ProjectNode[] | undefined) {
  const list = nodes ?? [];
  const results = useQueries({
    queries: list.map((node) => ({
      queryKey: taskKeys.byNode(projectId, node.id),
      queryFn: () => tasksApi.listByNode(projectId, node.id),
      enabled: Boolean(projectId && node.id),
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);
  const tasks: Task[] = results.flatMap((r) => r.data ?? []);

  return { tasks, isLoading, isError };
}
