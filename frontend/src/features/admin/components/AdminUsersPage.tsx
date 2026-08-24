import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import { Role, canActOnTarget } from "@/features/auth/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDebouncedValue } from "@/features/projects/utils/use-debounced-value";
import { usePositions, useCreatePosition } from "../hooks/use-positions";
import {
  useAdminUsers,
  useBulkCreateUsers,
  useCreateUser,
  useDeleteUser,
  useResetPassword,
  useUpdateUser,
} from "../hooks/use-admin-users";
import type { AdminUser, BulkCreateUsersResult } from "../api/users.api";
import type { DocumentType } from "@/features/projects/types/api.types";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@/features/projects/types/labels";
import { parseUsersCsv, type ParsedUsersCsv } from "../utils/parse-users-csv";

const PAGE_SIZE = 20;

// Roles que un admin puede asignar desde la UI. Un super_admin (o developer)
// puede además ascender a alguien a super_admin; un admin normal no.
function getAssignableRoles(actorRole: Role): { value: Role; label: string }[] {
  const base: { value: Role; label: string }[] = [
    { value: Role.USER, label: "Usuario" },
    { value: Role.ADMIN, label: "Administrador" },
  ];
  if (actorRole === Role.SUPER_ADMIN || actorRole === Role.DEVELOPER) {
    base.push({ value: Role.SUPER_ADMIN, label: "Super admin" });
  }
  return base;
}

const ROLE_LABEL: Record<string, string> = {
  developer: "Developer",
  super_admin: "Super admin",
  admin: "Administrador",
  user: "Usuario",
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

// ── Formulario inline: alta de un cargo nuevo (sin salir del modal) ─────────
function NewPositionInlineForm({
  onCreated,
  onCancel,
}: {
  onCreated: (value: string) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const createPosition = useCreatePosition();

  const canSubmit = /^[a-z][a-z0-9_]*$/.test(key) && label.trim().length >= 2;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    createPosition.mutate(
      { key, label: label.trim() },
      {
        onSuccess: (created) => {
          onCreated(created.value);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <input
          className={inputCls}
          placeholder="clave_del_cargo"
          aria-label="Clave del cargo"
          value={key}
          onChange={(e) => {
            setKey(e.target.value.toLowerCase().replace(/\s+/g, "_"));
          }}
        />
        <input
          className={inputCls}
          placeholder="Etiqueta visible"
          aria-label="Etiqueta del cargo"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
          }}
        />
      </div>
      {createPosition.isError && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {getErrorMessage(createPosition.error, "No se pudo crear el cargo")}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-accent"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || createPosition.isPending}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:opacity-60"
        >
          {createPosition.isPending ? "Creando…" : "Crear cargo"}
        </button>
      </div>
    </div>
  );
}

// ── Modal: crear usuario ────────────────────────────────────────────────────
function CreateUserModal({
  onClose,
  onCreated,
  assignableRoles,
}: {
  onClose: () => void;
  onCreated: (email: string, password: string) => void;
  assignableRoles: { value: Role; label: string }[];
}) {
  const [form, setForm] = useState({
    name: "",
    last_name: "",
    email: "",
    password: "",
    role: Role.USER as Role,
    position: "sin_cargo",
    document_type: "" as DocumentType | "",
    document_number: "",
  });
  const [addingPosition, setAddingPosition] = useState(false);
  const { data: positions, isLoading: positionsLoading } = usePositions();
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
      {
        name: form.name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        position: form.position,
        // El documento es opcional: enviamos null cuando queda vacío.
        document_type: form.document_type || null,
        document_number: form.document_number.trim() || null,
      },
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
          {/* Documento de identidad (opcional): tipo + número */}
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Tipo de documento</span>
              <select
                className={inputCls}
                value={form.document_type}
                onChange={set("document_type")}
                aria-label="Tipo de documento"
              >
                <option value="">Sin especificar</option>
                {DOCUMENT_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {DOCUMENT_TYPE_LABELS[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Documento de identidad
              </span>
              <input
                className={inputCls}
                type="text"
                placeholder="Número (opcional)"
                aria-label="Documento de identidad"
                value={form.document_number}
                onChange={set("document_number")}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Rol</span>
            <select className={inputCls} value={form.role} onChange={set("role")} aria-label="Rol">
              {assignableRoles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">Cargo en la empresa</span>
            <select
              className={inputCls}
              value={form.position}
              onChange={set("position")}
              disabled={positionsLoading}
              aria-label="Cargo"
            >
              {positionsLoading ? (
                <option value="sin_cargo">Cargando cargos…</option>
              ) : (
                positions?.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))
              )}
            </select>
          </label>
          {addingPosition ? (
            <NewPositionInlineForm
              onCreated={(value) => {
                setForm((f) => ({ ...f, position: value }));
                setAddingPosition(false);
              }}
              onCancel={() => {
                setAddingPosition(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setAddingPosition(true);
              }}
              className="flex items-center gap-1.5 self-start text-xs font-medium text-brand-teal transition hover:text-brand-teal-dark"
            >
              <Plus className="size-3.5" /> Este cargo no existe todavía
            </button>
          )}
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
  const [addingPosition, setAddingPosition] = useState(false);
  const { data: positions, isLoading: positionsLoading } = usePositions();
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
              disabled={positionsLoading}
              aria-label="Cargo"
            >
              {positionsLoading ? (
                <option value={form.position}>Cargando cargos…</option>
              ) : (
                positions?.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))
              )}
            </select>
          </label>
          {addingPosition ? (
            <NewPositionInlineForm
              onCreated={(value) => {
                setForm((f) => ({ ...f, position: value }));
                setAddingPosition(false);
              }}
              onCancel={() => {
                setAddingPosition(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setAddingPosition(true);
              }}
              className="flex items-center gap-1.5 self-start text-xs font-medium text-brand-teal transition hover:text-brand-teal-dark"
            >
              <Plus className="size-3.5" /> Este cargo no existe todavía
            </button>
          )}
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
  actorRole,
  onCredentials,
}: {
  user: AdminUser;
  actorRole: Role;
  onCredentials: (email: string, pwd: string) => void;
}) {
  const updateUser = useUpdateUser();
  const resetPassword = useResetPassword();
  const deleteUser = useDeleteUser();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  // El developer/super_admin no se editan desde esta UI (evita pisar privilegios).
  const locked = user.role === "developer" || user.role === "super_admin";
  const assignableRoles = useMemo(() => getAssignableRoles(actorRole), [actorRole]);
  // Solo se puede eliminar a alguien de rango estrictamente menor (un admin no
  // puede eliminar a un super_admin, pero un super_admin sí a un admin).
  const canDelete = canActOnTarget(actorRole, user.role);

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
              {assignableRoles.map((r) => (
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
            {canDelete && (
              <button
                type="button"
                disabled={deleteUser.isPending}
                onClick={() => {
                  setConfirmDelete(true);
                }}
                aria-label={`Eliminar a ${user.name} ${user.last_name}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <Trash2 className="size-3" /> Eliminar
              </button>
            )}
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

      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar usuario"
          message={`Se eliminará la cuenta de ${user.name} ${user.last_name} (${user.email}). Esta acción no se puede deshacer desde aquí. ¿Continuar?`}
          confirmLabel="Eliminar"
          destructive
          loading={deleteUser.isPending}
          errorMessage={
            deleteUser.isError
              ? getErrorMessage(deleteUser.error, "No se pudo eliminar el usuario")
              : null
          }
          onConfirm={() => {
            deleteUser.mutate(user.id, {
              onSuccess: () => {
                setConfirmDelete(false);
              },
            });
          }}
          onCancel={() => {
            setConfirmDelete(false);
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

// Columnas que mostramos en la previsualización, en el orden esperado del CSV.
const CSV_PREVIEW_COLUMNS: { key: string; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "nombre", label: "Nombre" },
  { key: "apellido", label: "Apellido" },
  { key: "cedula", label: "Cédula" },
  { key: "cargo", label: "Cargo" },
];

// ── Modal: carga masiva desde CSV ───────────────────────────────────────────
function BulkUploadModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedUsersCsv | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const bulkCreate = useBulkCreateUsers();
  const [result, setResult] = useState<BulkCreateUsersResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) {
      return;
    }
    setResult(null);
    setParseError(null);
    setFileName(selected.name);
    setFile(selected);

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const parsed = parseUsersCsv(text);
      if (parsed.rows.length === 0) {
        setPreview(null);
        setParseError("El archivo no tiene filas para previsualizar.");
        return;
      }
      setPreview(parsed);
    };
    reader.onerror = () => {
      setPreview(null);
      setParseError("No se pudo leer el archivo.");
    };
    reader.readAsText(selected);
  };

  const handleUpload = () => {
    if (!file) {
      return;
    }
    bulkCreate.mutate(file, { onSuccess: setResult });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cargar usuarios desde CSV"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Upload className="size-4 text-brand-gold" /> Cargar usuarios desde CSV
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
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          <p className="text-xs text-muted-foreground">
            Columnas: <code>email, nombre, apellido</code> (obligatorias) y{" "}
            <code>cedula, cargo, password</code> (opcionales). Sin contraseña, se genera una
            temporal por fila. Si el cargo no existe, se crea automáticamente. Todos los usuarios
            cargados aquí quedan con el rol estándar. Las filas inválidas se reportan sin bloquear
            al resto.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            aria-label="Archivo CSV"
            onChange={handleFileChange}
            className="text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-brand-gold-dark"
          />
          {parseError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {parseError}
            </p>
          )}
          {preview && !result && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground">
                {fileName}: {preview.rows.length} usuario
                {preview.rows.length !== 1 ? "s" : ""} para cargar.
              </p>
              <div className="max-h-56 overflow-auto rounded-lg border border-border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-accent text-muted-foreground">
                    <tr>
                      {CSV_PREVIEW_COLUMNS.filter((c) => preview.headers.includes(c.key)).map(
                        (c) => (
                          <th key={c.key} className="px-3 py-2 font-medium">
                            {c.label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, index) => (
                      <tr key={index} className="border-t border-border">
                        {CSV_PREVIEW_COLUMNS.filter((c) => preview.headers.includes(c.key)).map(
                          (c) => (
                            <td key={c.key} className="px-3 py-1.5 text-foreground">
                              {row[c.key] || "—"}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={handleUpload}
                disabled={bulkCreate.isPending}
                className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:opacity-60"
              >
                {bulkCreate.isPending
                  ? "Cargando…"
                  : `Cargar ${preview.rows.length} usuario${preview.rows.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          )}
          {bulkCreate.isError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {getErrorMessage(bulkCreate.error, "No se pudo procesar el archivo")}
            </p>
          )}
          {result && (
            <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 text-sm">
              <p className="font-medium text-foreground">
                {result.created.length} de {result.total_rows} usuarios creados
              </p>
              {result.created.length > 0 && (
                <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {result.created.map((u) => (
                    <li key={u.id}>
                      {u.email}
                      {u.temporary_password && (
                        <span className="text-foreground"> — temp: {u.temporary_password}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {result.failed.length > 0 && (
                <>
                  <p className="font-medium text-red-600 dark:text-red-400">
                    {result.failed.length} fila{result.failed.length !== 1 ? "s" : ""} con errores
                  </p>
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-xs text-red-600 dark:text-red-400">
                    {result.failed.map((f) => (
                      <li key={f.row}>
                        Fila {f.row} ({f.email ?? "sin correo"}): {f.error}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition hover:bg-accent"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export function AdminUsersPage() {
  const { user: authUser } = useAuth();
  const actorRole = authUser?.role ?? Role.USER;
  const assignableRoles = useMemo(() => getAssignableRoles(actorRole), [actorRole]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);

  // Al cambiar la búsqueda, volvemos a la página 1.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const query = useAdminUsers({ search: debouncedSearch, page, pageSize: PAGE_SIZE });
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
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
