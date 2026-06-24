import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminUsersApi, type AdminUser, type CreateUserPayload } from "../api/users.api";

const adminUserKeys = {
  all: ["admin", "users"] as const,
};

export function useAdminUsers() {
  return useQuery({ queryKey: adminUserKeys.all, queryFn: adminUsersApi.list });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => adminUsersApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminUserKeys.all }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      user: AdminUser;
      changes: Partial<Pick<AdminUser, "role" | "is_active">>;
    }) => adminUsersApi.update(vars.user, vars.changes),
    onSuccess: () => qc.invalidateQueries({ queryKey: adminUserKeys.all }),
  });
}

/** Reset de contraseña: devuelve la temporal para mostrarla una vez (no cachea). */
export function useResetPassword() {
  return useMutation({
    mutationFn: (userId: string) => adminUsersApi.resetPassword(userId),
  });
}
