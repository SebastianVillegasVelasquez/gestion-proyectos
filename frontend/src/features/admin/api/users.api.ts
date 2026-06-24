import http from "@/lib/http";
import type { Role } from "@/features/auth/types";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  last_name: string;
  role: Role;
  position: string;
  is_active: boolean;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  last_name: string;
  role: Role;
}

export interface PaginatedUsers {
  items: AdminUser[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminUsersParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

// Cliente HTTP de administración de usuarios. Solo traduce a la API.
export const adminUsersApi = {
  // Paginado en el servidor: no traemos toda la tabla (puede haber miles).
  search: ({ search, page = 1, pageSize = 20 }: AdminUsersParams = {}) => {
    const params: Record<string, string | number> = { page, page_size: pageSize };
    if (search) {
      params.search = search;
    }
    return http.get<PaginatedUsers>("/identity/users/manage", { params }).then((r) => r.data);
  },

  create: (payload: CreateUserPayload) =>
    http.post<AdminUser>("/identity/users", payload).then((r) => r.data),

  // PATCH requiere los datos base; reenviamos los actuales + el cambio.
  update: (user: AdminUser, changes: Partial<Pick<AdminUser, "role" | "is_active">>) =>
    http
      .patch<AdminUser>(`/identity/users/${user.id}`, {
        email: user.email,
        name: user.name,
        last_name: user.last_name,
        role: changes.role ?? user.role,
        is_active: changes.is_active ?? user.is_active,
      })
      .then((r) => r.data),

  resetPassword: (userId: string) =>
    http
      .post<{
        user_id: string;
        temporary_password: string;
      }>(`/identity/users/${userId}/reset-password`)
      .then((r) => r.data),
};
