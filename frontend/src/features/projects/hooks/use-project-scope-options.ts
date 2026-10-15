import { useMemo } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Role } from "@/features/auth/types";
import { useMyTasks } from "@/features/personal/hooks/use-personal-deliverables";
import { useMyTeams } from "@/features/workspace/hooks/use-workspace";
import { useProjects } from "./use-projects";

export interface ProjectOption {
  id: string;
  name: string;
}

/**
 * Proyectos entre los que se puede elegir como «proyecto activo». Administración
 * ve todos; el resto, solo aquellos donde tiene un equipo o una tarea (no puede
 * listar el catálogo completo, y ofrecer proyectos ajenos no tendría sentido).
 */
export function useProjectScopeOptions(): ProjectOption[] {
  const { hasRole } = useAuth();
  const isAdmin = hasRole([Role.ADMIN, Role.SUPER_ADMIN]);
  const projects = useProjects({ enabled: isAdmin });
  const teams = useMyTeams({ enabled: !isAdmin });
  const tasks = useMyTasks({ enabled: !isAdmin });

  return useMemo(() => {
    const byId = new Map<string, string>();
    if (isAdmin) {
      for (const p of projects.data ?? []) {
        byId.set(p.id, p.name);
      }
    } else {
      for (const t of teams.data ?? []) {
        if (t.project_name) {
          byId.set(t.project_id, t.project_name);
        }
      }
      for (const t of tasks.data ?? []) {
        byId.set(t.project_id, t.project_name);
      }
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [isAdmin, projects.data, teams.data, tasks.data]);
}
