import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminUsersApi,
  type AdminUser,
  type AdminUsersParams,
  type CreateUserPayload,
  type UpdateUserChanges,
} from "../api/users.api";

const adminUserKeys = {
  all: ["admin", "users"] as const,
  list: (params: AdminUsersParams) =>
    [...adminUserKeys.all, params.search ?? "", params.page ?? 1] as const,
};

/** Lista paginada y buscable de usuarios (servidor). */
export function useAdminUsers(params: AdminUsersParams) {
  return useQuery({
    queryKey: adminUserKeys.list(params),
    queryFn: () => adminUsersApi.search(params),
    // Mantiene la página anterior visible mientras llega la nueva (sin parpadeo).
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => adminUsersApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminUserKeys.all }),
  });
}

export function useBulkCreateUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => adminUsersApi.createBulk(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminUserKeys.all }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { user: AdminUser; changes: UpdateUserChanges }) =>
      adminUsersApi.update(vars.user, vars.changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminUserKeys.all }),
  });
}

/** Reset de contraseña: devuelve la temporal para mostrarla una vez (no cachea). */
export function useResetPassword() {
  return useMutation({
    mutationFn: (userId: string) => adminUsersApi.resetPassword(userId),
  });
}
