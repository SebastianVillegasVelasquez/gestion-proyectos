import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Search,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { Role } from "@/features/auth/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDebouncedValue } from "@/features/projects/utils/use-debounced-value";
import { useAdminUsers } from "../hooks/use-admin-users";
import type { AdminUserSortField, SortDirection } from "../api/users.api";
import { BulkUploadModal } from "./users/BulkUploadModal";
import { CreateUserModal } from "./users/CreateUserModal";
import { CredentialsModal } from "./users/CredentialsModal";
import { SortableHeader } from "./users/SortableHeader";
import { UserRow } from "./users/UserRow";
import { getAssignableRoles, inputCls } from "./users/users-ui";

const PAGE_SIZE = 20;

// ── Página ────────────────────────────────────────────────────────────────────
export function AdminUsersPage() {
  const { user: authUser } = useAuth();
  const actorRole = authUser?.role ?? Role.USER;
  const assignableRoles = useMemo(() => getAssignableRoles(actorRole), [actorRole]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // Por defecto la tabla muestra solo cuentas activas: las desactivadas son
  // ruido en el día a día y se piden con el interruptor de abajo.
  const [showInactive, setShowInactive] = useState(false);
  const [sort, setSort] = useState<{ by: AdminUserSortField; dir: SortDirection }>({
    by: "name",
    dir: "asc",
  });
  const debouncedSearch = useDebouncedValue(search);

  // Cualquier cambio que altere el conjunto de resultados nos devuelve a la
  // página 1: quedarse en la 3 de una lista que ahora tiene 1 página deja la
  // tabla vacía sin explicación.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, showInactive, sort]);

  const query = useAdminUsers({
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
    includeInactive: showInactive,
    sortBy: sort.by,
    sortDir: sort.dir,
  });
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [creds, setCreds] = useState<{
    title: string;
    email: string;
    password?: string;
    activationUrl?: string | null;
  } | null>(null);

  const total = query.data?.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const users = query.data?.items ?? [];

  // Click en la misma columna invierte el sentido; en otra, empieza ascendente.
  const handleSort = (field: AdminUserSortField) => {
    setSort((s) =>
      s.by === field
        ? { by: field, dir: s.dir === "asc" ? "desc" : "asc" }
        : { by: field, dir: "asc" },
    );
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden p-4 sm:p-6">
      <PageHeader
        title="Usuarios"
        description="Crea cuentas, asigna roles, activa/desactiva y restablece contraseñas."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowBulkUpload(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              <Upload className="size-4" /> Cargar CSV
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(true);
              }}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark"
            >
              <UserPlus className="size-4" /> Nuevo usuario
            </button>
          </div>
        }
      />

      {/* Barra de filtros: búsqueda (servidor, con debounce) + inactivos */}
      <div className="mb-3 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            placeholder="Buscar por nombre, correo o documento…"
            aria-label="Buscar usuario"
            className={`${inputCls} pl-9`}
          />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={showInactive}
          onClick={() => {
            setShowInactive((v) => !v);
          }}
          className={cn(
            "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition",
            showInactive
              ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
              : "border-border text-muted-foreground hover:bg-accent",
          )}
        >
          {showInactive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          Mostrar inactivos
        </button>
      </div>

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <ErrorState
          title="No se pudieron cargar los usuarios"
          onRetry={() => void query.refetch()}
        />
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Sin resultados"
          hint={
            debouncedSearch
              ? `Nada coincide con «${debouncedSearch}».`
              : showInactive
                ? "No hay usuarios."
                : "No hay usuarios activos. Activa «Mostrar inactivos» para ver las cuentas desactivadas."
          }
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-card">
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <SortableHeader
                  field="name"
                  label="Usuario"
                  sort={sort}
                  onSort={handleSort}
                  align="left"
                />
                <SortableHeader field="role" label="Rol" sort={sort} onSort={handleSort} />
                <SortableHeader field="status" label="Estado" sort={sort} onSort={handleSort} />
                <SortableHeader
                  field="created_at"
                  label="Ingreso al sistema"
                  sort={sort}
                  onSort={handleSort}
                />
                <th scope="col" className="px-5 py-2.5 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  actorRole={actorRole}
                  onCredentials={(email, password) => {
                    setCreds({ title: "Contraseña restablecida", email, password });
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {!query.isError && (
        <div className="mt-3 flex shrink-0 items-center justify-between text-xs text-muted-foreground">
          <span>
            {total} usuario{total !== 1 ? "s" : ""}
            {!showInactive && " activo"}
            {!showInactive && total !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              aria-label="Página anterior"
              onClick={() => {
                setPage((p) => p - 1);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              aria-label="Página siguiente"
              onClick={() => {
                setPage((p) => p + 1);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateUserModal
          assignableRoles={assignableRoles}
          onClose={() => {
            setShowCreate(false);
          }}
          onCreated={(email, _password, activationUrl) => {
            setShowCreate(false);
            setCreds({ title: "Usuario creado", email, activationUrl });
          }}
        />
      )}

      {creds && (
        <CredentialsModal
          title={creds.title}
          email={creds.email}
          password={creds.password}
          activationUrl={creds.activationUrl}
          onClose={() => {
            setCreds(null);
          }}
        />
      )}

      {showBulkUpload && (
        <BulkUploadModal
          onClose={() => {
            setShowBulkUpload(false);
          }}
        />
      )}
    </div>
  );
}

export default AdminUsersPage;
