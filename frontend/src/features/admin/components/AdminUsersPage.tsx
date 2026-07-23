import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  KeyRound,
  Pencil,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import { Role } from "@/features/auth/types";
import { useDebouncedValue } from "@/features/projects/utils/use-debounced-value";
import { USER_POSITION_LABELS, USER_POSITIONS } from "@/features/projects/types/labels";
import {
  useAdminUsers,
  useCreateUser,
  useResetPassword,
  useUpdateUser,
} from "../hooks/use-admin-users";
import type { AdminUser } from "../api/users.api";

const PAGE_SIZE = 20;

// Roles que un admin puede asignar desde la UI (developer/super_admin se omiten).
const ASSIGNABLE_ROLES: { value: Role; label: string }[] = [
  { value: Role.USER, label: "Usuario" },
  { value: Role.ADMIN, label: "Administrador" },
  { value: Role.CLIENT, label: "Cliente" },
];

const ROLE_LABEL: Record<string, string> = {
  developer: "Developer",
  super_admin: "Super admin",
  admin: "Administrador",
  user: "Usuario",
  client: "Cliente",
};

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

// ── Modal: credenciales generadas (crear / reset) ───────────────────────────
function CredentialsModal({
  title,
  email,
  password,
  onClose,
}: {
  title: string;
  email: string;
  password: string;
  onClose: () => void;
}) {
  const text = `Usuario: ${email}\nContraseña temporal: ${password}`;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Cópialas y entrégaselas al usuario. No se volverán a mostrar.
        </p>
        <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm text-foreground">
          {text}
        </pre>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(text)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition hover:bg-accent"
          >
            <Copy className="size-4" /> Copiar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: crear usuario ────────────────────────────────────────────────────
function CreateUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (email: string, password: string) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    last_name: "",
    email: "",
    password: "",
    role: Role.USER as Role,
  });
  const createUser = useCreateUser();

  const canSubmit =
    form.name.trim() &&
    form.last_name.trim() &&
    form.email.trim() &&
    form.password.length >= 8 &&
    !createUser.isPending;

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
    };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    createUser.mutate(
      { ...form, email: form.email.trim() },
      {
        onSuccess: () => {
          onCreated(form.email.trim(), form.password);
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crear usuario"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <UserPlus className="size-4 text-brand-gold" /> Nuevo usuario
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              className={inputCls}
              placeholder="Nombre"
              aria-label="Nombre"
              value={form.name}
              onChange={set("name")}
            />
            <input
              className={inputCls}
              placeholder="Apellido"
              aria-label="Apellido"
              value={form.last_name}
              onChange={set("last_name")}
            />
          </div>
          <input
            className={inputCls}
            type="email"
            placeholder="Correo"
            aria-label="Correo"
            value={form.email}
            onChange={set("email")}
          />
          <input
            className={inputCls}
            type="text"
            placeholder="Contraseña inicial (mín. 8, con número)"
            aria-label="Contraseña inicial"
            value={form.password}
            onChange={set("password")}
          />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Rol</span>
            <select className={inputCls} value={form.role} onChange={set("role")} aria-label="Rol">
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {createUser.isError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {getErrorMessage(createUser.error, "No se pudo crear el usuario")}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:opacity-60"
          >
            {createUser.isPending ? "Creando…" : "Crear usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: editar datos del usuario ─────────────────────────────────────────
function EditUserModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [form, setForm] = useState({
    name: user.name,
    last_name: user.last_name,
    email: user.email,
    position: user.position,
  });
  const updateUser = useUpdateUser();

  const canSubmit =
    form.name.trim().length >= 2 &&
    form.last_name.trim().length >= 2 &&
    form.email.trim().length > 0 &&
    !updateUser.isPending;

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [k]: e.target.value }));
    };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    updateUser.mutate(
      {
        user,
        changes: {
          name: form.name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          position: form.position,
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Editar ${user.name} ${user.last_name}`}
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Pencil className="size-4 text-brand-gold" /> Editar usuario
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Nombre</span>
              <input
                className={inputCls}
                placeholder="Nombre"
                aria-label="Nombre"
                value={form.name}
                onChange={set("name")}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Apellido</span>
              <input
                className={inputCls}
                placeholder="Apellido"
                aria-label="Apellido"
                value={form.last_name}
                onChange={set("last_name")}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Correo</span>
            <input
              className={inputCls}
              type="email"
              placeholder="Correo"
              aria-label="Correo"
              value={form.email}
              onChange={set("email")}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Cargo en la empresa</span>
            <select
              className={inputCls}
              value={form.position}
              onChange={set("position")}
              aria-label="Cargo"
            >
              {USER_POSITIONS.map((pos) => (
                <option key={pos} value={pos}>
                  {USER_POSITION_LABELS[pos]}
                </option>
              ))}
            </select>
          </label>
          {updateUser.isError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {getErrorMessage(updateUser.error, "No se pudo actualizar el usuario")}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:opacity-60"
          >
            {updateUser.isPending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fila de la tabla ──────────────────────────────────────────────────────────
function UserRow({
  user,
  onCredentials,
}: {
  user: AdminUser;
  onCredentials: (email: string, pwd: string) => void;
}) {
  const updateUser = useUpdateUser();
  const resetPassword = useResetPassword();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  // El developer/super_admin no se editan desde esta UI (evita pisar privilegios).
  const locked = user.role === "developer" || user.role === "super_admin";

  return (
    <>
      <tr className={cn("border-b border-border", !user.is_active && "opacity-60")}>
        <td className="px-3 py-2.5">
          <p className="text-sm font-medium text-foreground">
            {user.name} {user.last_name}
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </td>
        <td className="px-3 py-2.5">
          {locked ? (
            <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-foreground">
              {ROLE_LABEL[user.role] ?? user.role}
            </span>
          ) : (
            <select
              value={user.role}
              disabled={updateUser.isPending}
              aria-label={`Rol de ${user.name}`}
              onChange={(e) => {
                updateUser.mutate({ user, changes: { role: e.target.value as Role } });
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-brand-gold disabled:opacity-50"
            >
              {ASSIGNABLE_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
        </td>
        <td className="px-3 py-2.5">
          <button
            type="button"
            disabled={locked || updateUser.isPending}
            onClick={() => {
              setConfirmToggle(true);
            }}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition disabled:opacity-40",
              user.is_active
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300",
            )}
          >
            {user.is_active ? "Activo" : "Inactivo"}
          </button>
        </td>
        <td className="px-3 py-2.5 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {!locked && (
              <button
                type="button"
                onClick={() => {
                  setShowEdit(true);
                }}
                aria-label={`Editar ${user.name} ${user.last_name}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition hover:bg-accent"
              >
                <Pencil className="size-3" /> Editar
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setConfirmReset(true);
              }}
              aria-label={`Restablecer contraseña de ${user.name}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-foreground transition hover:bg-accent"
            >
              <KeyRound className="size-3" /> Contraseña
            </button>
          </div>
        </td>
      </tr>

      {confirmToggle && (
        <ConfirmDialog
          title={user.is_active ? "Desactivar usuario" : "Activar usuario"}
          message={
            user.is_active
              ? `${user.name} ${user.last_name} no podrá iniciar sesión mientras esté inactivo. ¿Continuar?`
              : `${user.name} ${user.last_name} volverá a poder iniciar sesión. ¿Continuar?`
          }
          confirmLabel={user.is_active ? "Desactivar" : "Activar"}
          loading={updateUser.isPending}
          errorMessage={
            updateUser.isError
              ? getErrorMessage(updateUser.error, "No se pudo actualizar el estado")
              : null
          }
          onConfirm={() => {
            updateUser.mutate(
              { user, changes: { is_active: !user.is_active } },
              {
                onSuccess: () => {
                  setConfirmToggle(false);
                },
              },
            );
          }}
          onCancel={() => {
            setConfirmToggle(false);
          }}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Restablecer contraseña"
          message={`Se generará una contraseña temporal para ${user.name} ${user.last_name} y la actual dejará de funcionar. ¿Continuar?`}
          confirmLabel="Restablecer"
          loading={resetPassword.isPending}
          errorMessage={
            resetPassword.isError
              ? getErrorMessage(resetPassword.error, "No se pudo restablecer la contraseña")
              : null
          }
          onConfirm={() => {
            resetPassword.mutate(user.id, {
              onSuccess: (res) => {
                setConfirmReset(false);
                onCredentials(user.email, res.temporary_password);
              },
            });
          }}
          onCancel={() => {
            setConfirmReset(false);
          }}
        />
      )}

      {showEdit && (
        <EditUserModal
          user={user}
          onClose={() => {
            setShowEdit(false);
          }}
        />
      )}
    </>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  // Al cambiar la búsqueda, volvemos a la página 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const query = useAdminUsers({ search: debouncedSearch, page, pageSize: PAGE_SIZE });
  const [showCreate, setShowCreate] = useState(false);
  const [creds, setCreds] = useState<{ title: string; email: string; password: string } | null>(
    null,
  );

  const total = query.data?.total ?? 0;
  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const users = query.data?.items ?? [];

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden p-4 sm:p-6">
      <PageHeader
        title="Usuarios"
        description="Crea cuentas, asigna roles, activa/desactiva y restablece contraseñas."
        actions={
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark"
          >
            <UserPlus className="size-4" /> Nuevo usuario
          </button>
        }
      />

      {/* Búsqueda (servidor, con debounce) */}
      <div className="relative mb-3 shrink-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          placeholder="Buscar por nombre o correo…"
          aria-label="Buscar usuario"
          className={`${inputCls} pl-9`}
        />
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
          hint={debouncedSearch ? `Nada coincide con «${debouncedSearch}».` : "No hay usuarios."}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Usuario</th>
                <th className="px-15 py-2">Rol</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-0 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
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
          onClose={() => {
            setShowCreate(false);
          }}
          onCreated={(email, password) => {
            setShowCreate(false);
            setCreds({ title: "Usuario creado", email, password });
          }}
        />
      )}

      {creds && (
        <CredentialsModal
          title={creds.title}
          email={creds.email}
          password={creds.password}
          onClose={() => {
            setCreds(null);
          }}
        />
      )}
    </div>
  );
}

export default AdminUsersPage;
