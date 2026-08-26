import http from "@/lib/http";
import type { Role } from "@/features/auth/types";
import type { DocumentType } from "@/features/projects/types/api.types";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  last_name: string;
  role: Role;
  position: string;
  is_active: boolean;
  document_type: DocumentType | null;
  document_number: string | null;
  /** Ingreso al sistema: alta de la cuenta (ISO 8601), tal como la sirve el backend. */
  created_at: string | null;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  last_name: string;
  role: Role;
  position?: string;
  // Documento de identidad opcional (tipo + número).
  document_type?: DocumentType | null;
  document_number?: string | null;
}

export interface BulkUserRowError {
  row: number;
  email: string | null;
  error: string;
}

export interface BulkCreatedUser {
  id: string;
  email: string;
  name: string;
  last_name: string;
  temporary_password: string | null;
}

export interface BulkCreateUsersResult {
  created: BulkCreatedUser[];
  failed: BulkUserRowError[];
  total_rows: number;
}

export type UpdateUserChanges = Partial<
  Pick<
    AdminUser,
    | "role"
    | "is_active"
    | "name"
    | "last_name"
    | "email"
    | "position"
    | "document_type"
    | "document_number"
  >
>;

export interface PaginatedUsers {
  items: AdminUser[];
  total: number;
  page: number;
  page_size: number;
}

/** Columnas por las que el backend sabe ordenar la tabla de administración. */
export type AdminUserSortField = "name" | "email" | "role" | "position" | "status" | "created_at";

export type SortDirection = "asc" | "desc";

export interface AdminUsersParams {
  search?: string;
  page?: number;
  pageSize?: number;
  /** Falso oculta los usuarios desactivados (por defecto la tabla los oculta). */
  includeInactive?: boolean;
  sortBy?: AdminUserSortField;
  sortDir?: SortDirection;
}

// Cliente HTTP de administración de usuarios. Solo traduce a la API.
export const adminUsersApi = {
  // Paginado en el servidor: no traemos toda la tabla (puede haber miles).
  // El orden y el filtro de inactivos también van al servidor: ordenar en el
  // cliente solo reordenaría la página ya recibida, no el total.
  search: ({
    search,
    page = 1,
    pageSize = 20,
    includeInactive = true,
    sortBy = "name",
    sortDir = "asc",
  }: AdminUsersParams = {}) => {
    const params: Record<string, string | number | boolean> = {
      page,
      page_size: pageSize,
      include_inactive: includeInactive,
      sort_by: sortBy,
      sort_dir: sortDir,
    };
    if (search) {
      params.search = search;
    }
    return http.get<PaginatedUsers>("/identity/users/manage", { params }).then((r) => r.data);
  },

  create: (payload: CreateUserPayload) =>
    http.post<AdminUser>("/identity/users", payload).then((r) => r.data),

  // Carga masiva desde CSV (primera vez usando la plataforma: alta de muchos
  // usuarios de una sola vez).
  createBulk: (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return http
      .post<BulkCreateUsersResult>("/identity/users/bulk", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },

  // PATCH requiere los datos base; reenviamos los actuales + el cambio.
  update: (user: AdminUser, changes: UpdateUserChanges) =>
    http
      .patch<AdminUser>(`/identity/users/${user.id}`, {
        email: changes.email ?? user.email,
        name: changes.name ?? user.name,
        last_name: changes.last_name ?? user.last_name,
        role: changes.role ?? user.role,
        is_active: changes.is_active ?? user.is_active,
        position: changes.position ?? user.position,
        document_type: changes.document_type ?? user.document_type,
        document_number: changes.document_number ?? user.document_number,
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
