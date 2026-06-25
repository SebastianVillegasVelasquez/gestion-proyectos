import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { directoryApi, membersApi, usersApi } from "@/features/projects/api/members.api";
import { directoryKeys, projectKeys, userKeys } from "./query-keys";
import type {
  DirectorySearchParams,
  ProjectRole,
  UserPosition,
} from "@/features/projects/types/api.types";

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: projectKeys.members(projectId ?? ""),
    queryFn: () => membersApi.list(projectId!),
    enabled: Boolean(projectId),
  });
}

export function useAddMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; role: ProjectRole }) =>
      membersApi.add({
        user_id: input.userId,
        project_id: projectId,
        project_role: input.role,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.members(projectId) }),
  });
}

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: userKeys.list(),
    queryFn: usersApi.list,
    enabled,
    staleTime: 60_000,
  });
}

/** Directorio de usuarios asignables, opcionalmente filtrado por cargo. */
export function useDirectory(position?: UserPosition) {
  return useQuery({
    queryKey: directoryKeys.list(position),
    queryFn: () => directoryApi.list(position),
    staleTime: 60_000,
  });
}

/** Búsqueda paginada de usuarios (nombre/correo/cargo) para selectores grandes. */
export function useDirectorySearch(params: DirectorySearchParams) {
  return useQuery({
    queryKey: directoryKeys.search(params),
    queryFn: () => directoryApi.search(params),
    // Mantiene la página anterior visible mientras carga la nueva (sin parpadeo).
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
