import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Upload,
  UserPlus,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import { Role } from "@/features/auth/types";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useDebouncedValue } from "@/features/projects/utils/use-debounced-value";
import { usePositions, useCreatePosition } from "../hooks/use-positions";
import {
  useAdminUsers,
  useBulkCreateUsers,
  useCreateUser,
  useResetPassword,
  useUpdateUser,
} from "../hooks/use-admin-users";
import type {
  AdminUser,
  AdminUserSortField,
  BulkCreateUsersResult,
  SortDirection,
} from "../api/users.api";
import type { DocumentType } from "@/features/projects/types/api.types";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@/features/projects/types/labels";
import { parseUsersCsv, type ParsedUsersCsv } from "../utils/parse-users-csv";
import {
  copyTextToClipboard,
  downloadCsvTemplate,
  USERS_CSV_LLM_PROMPT,
} from "../utils/bulk-upload-helpers";

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
  // Un solo campo: el cargo tal cual se lee ("Diseñador Gráfico"). La clave
  // interna la deriva el backend; pedírsela al administrador no le aportaba
  // nada y hacía el formulario más difícil de completar.
  const [label, setLabel] = useState("");
  const createPosition = useCreatePosition();

  const canSubmit = label.trim().length >= 2 && !createPosition.isPending;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    createPosition.mutate(
      { label: label.trim() },
      {
        onSuccess: (created) => {
          onCreated(created.value);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Nombre del cargo</span>
        <input
          className={inputCls}
          placeholder="Ej.: Diseñador Gráfico"
          aria-label="Nombre del cargo"
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
      </label>
      <p className="text-[11px] text-muted-foreground">
        Escríbelo tal como quieres que se vea, con tildes y mayúsculas.
      </p>
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
          disabled={!canSubmit}
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
            onChange={(e) => {
              // El backend normaliza el correo a minúsculas/sin espacios para
              // detectar duplicados sin importar cómo se haya escrito: lo
              // reflejamos aquí para que lo que se ve sea lo que se guarda.
              setForm((f) => ({ ...f, email: e.target.value.trim().toLowerCase() }));
            }}
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

// Fecha de alta en formato corto es-CO ("12 mar 2026"): la tabla solo necesita
// el día, no la hora.
function formatJoinDate(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  // El developer/super_admin no se editan desde esta UI (evita pisar privilegios).
  const locked = user.role === "developer" || user.role === "super_admin";
  const assignableRoles = useMemo(() => getAssignableRoles(actorRole), [actorRole]);

  return (
    <>
      <tr
        className={cn(
          "border-b border-border transition-colors last:border-0 hover:bg-accent/40",
          // La cuenta inactiva se atenúa: sigue visible y accionable, pero se
          // lee de un vistazo que no puede entrar al sistema.
          !user.is_active && "bg-muted/30",
        )}
      >
        <td className="px-5 py-3">
          <p
            className={cn(
              "text-sm font-medium text-foreground",
              !user.is_active && "text-muted-foreground",
            )}
          >
            {user.name} {user.last_name}
          </p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </td>
        <td className="px-3 py-3 text-center">
          {locked ? (
            <span className="inline-block rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-foreground">
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
        <td className="px-3 py-3 text-center">
          <button
            type="button"
            disabled={locked || updateUser.isPending}
            onClick={() => {
              setConfirmToggle(true);
            }}
            title={
              user.is_active
                ? "Desactivar: la cuenta deja de poder iniciar sesión"
                : "Activar: la cuenta vuelve a poder iniciar sesión"
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-40",
              user.is_active
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "size-1.5 rounded-full",
                user.is_active ? "bg-emerald-500" : "bg-slate-400",
              )}
            />
            {user.is_active ? "Activo" : "Inactivo"}
          </button>
        </td>
        <td className="px-3 py-3 text-center text-xs text-muted-foreground">
          {/* Las cuentas privilegiadas no exponen su fecha de alta: son cuentas
              de plataforma, no personal que se dé de alta y de baja. */}
          {locked ? "—" : formatJoinDate(user.created_at)}
        </td>
        <td className="px-5 py-3">
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

// Columnas que mostramos en la previsualización, en el orden esperado del CSV.
const CSV_PREVIEW_COLUMNS: { key: string; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "nombre", label: "Nombre" },
  { key: "apellido", label: "Apellido" },
  { key: "cedula", label: "Cédula" },
  { key: "cargo", label: "Cargo" },
];

// Mensajes de fila que en realidad no son un error del archivo, sino un aviso
// esperado: la persona ya existe en el sistema (por correo o documento). Los
// distinguimos en la UI para que el admin no los lea como "algo salió mal".
const ALREADY_EXISTS_PATTERN = /ya se encuentra registrado|ya está registrad/i;

// ── Modal: carga masiva desde CSV ───────────────────────────────────────────
function BulkUploadModal({ onClose }: { onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedUsersCsv | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const bulkCreate = useBulkCreateUsers();
  const [result, setResult] = useState<BulkCreateUsersResult | null>(null);

  // Una vez hay un archivo cargado (previsualizado o ya procesado), dejamos de
  // mostrar las instrucciones: solo estorban y le quitan espacio a la tabla.
  const showInstructions = !preview && !result;

  const handleCopyPrompt = () => {
    copyTextToClipboard(USERS_CSV_LLM_PROMPT)
      .then(() => {
        setPromptCopied(true);
        setTimeout(() => {
          setPromptCopied(false);
        }, 1500);
      })
      .catch(() => {
        setParseError("No se pudo copiar el prompt al portapapeles.");
      });
  };

  const processFile = (selected: File) => {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      processFile(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      processFile(dropped);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileName(null);
    setPreview(null);
    setParseError(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-card shadow-xl">
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
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
          {showInstructions && (
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-accent/40 p-4">
              <p className="text-sm font-medium text-foreground">¿Cómo armo el archivo?</p>
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                <li>
                  De cada persona necesitamos al menos su{" "}
                  <span className="text-foreground">correo, nombre y apellido</span>.
                </li>
                <li>
                  Si quieres, también puedes agregar su{" "}
                  <span className="text-foreground">cédula, cargo y una contraseña</span> — si dejas
                  la contraseña en blanco, le asignamos una temporal automáticamente.
                </li>
                <li>Un renglón por persona.</li>
                <li>
                  ¿El cargo que escribiste no existe todavía en el sistema? No te preocupes, lo
                  creamos automáticamente.
                </li>
                <li>
                  Si alguien ya está registrado (o aparece dos veces en el archivo), te lo avisamos
                  sin detener la carga del resto.
                </li>
                <li>
                  Puedes armar el archivo en Excel o Google Sheets y luego guardarlo/exportarlo como
                  CSV.
                </li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={downloadCsvTemplate}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                >
                  <Download className="size-3.5" /> Descargar plantilla
                </button>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent"
                >
                  {promptCopied ? (
                    <Check className="size-3.5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {promptCopied ? "Prompt copiado" : "Copiar prompt para IA"}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ese prompt le explica a cualquier IA (ChatGPT, Claude, etc.) cómo armar el archivo
                por ti: solo pégale la lista de personas que quieres cargar.
              </p>
            </div>
          )}

          {showInstructions && (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              aria-label="Arrastra o selecciona tu archivo CSV"
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition",
                isDragging
                  ? "border-brand-gold bg-brand-gold/5"
                  : "border-border hover:border-brand-gold/60 hover:bg-accent/40",
              )}
            >
              <Upload className="size-6 text-muted-foreground" />
              <p className="text-sm text-foreground">
                Arrastra tu archivo aquí o{" "}
                <span className="font-medium text-brand-gold">haz clic para buscarlo</span>
              </p>
              <p className="text-xs text-muted-foreground">Solo archivos .csv</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                aria-label="Archivo CSV"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {parseError && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400">
              {parseError}
            </p>
          )}

          {preview && !result && (
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {fileName}: {preview.rows.length} usuario
                  {preview.rows.length !== 1 ? "s" : ""} para cargar.
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                >
                  Elegir otro archivo
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
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
            <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-lg border border-border bg-background p-3 text-sm">
              {(() => {
                const alreadyExisted = result.failed.filter((f) =>
                  ALREADY_EXISTS_PATTERN.test(f.error),
                );
                const realErrors = result.failed.filter(
                  (f) => !ALREADY_EXISTS_PATTERN.test(f.error),
                );
                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="flex items-center gap-1.5 font-medium text-foreground">
                          <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" />
                          {result.created.length} de {result.total_rows} usuarios creados
                        </p>
                        {alreadyExisted.length > 0 && (
                          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                            <AlertCircle className="size-3.5" />
                            {alreadyExisted.length} ya existían
                          </p>
                        )}
                        {realErrors.length > 0 && (
                          <p className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                            <XCircle className="size-3.5" />
                            {realErrors.length} con error
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleReset}
                        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        Cargar otro archivo
                      </button>
                    </div>
                    {result.created.length > 0 && (
                      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-accent text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 font-medium">Nombre</th>
                              <th className="px-3 py-2 font-medium">Apellido</th>
                              <th className="px-3 py-2 font-medium">Email</th>
                              <th className="px-3 py-2 font-medium">Contraseña temporal</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.created.map((u) => (
                              <tr key={u.id} className="border-t border-border">
                                <td className="px-3 py-1.5 text-foreground">{u.name}</td>
                                <td className="px-3 py-1.5 text-foreground">{u.last_name}</td>
                                <td className="px-3 py-1.5 text-foreground">{u.email}</td>
                                <td className="px-3 py-1.5 text-foreground">
                                  {u.temporary_password ?? "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {alreadyExisted.length > 0 && (
                      <ul className="max-h-32 shrink-0 space-y-1 overflow-y-auto text-xs text-amber-600 dark:text-amber-400">
                        {alreadyExisted.map((f) => (
                          <li key={f.row} className="flex items-start gap-1.5">
                            <AlertCircle className="mt-0.5 size-3 shrink-0" />
                            Fila {f.row} ({f.email ?? "sin correo"}): {f.error}
                          </li>
                        ))}
                      </ul>
                    )}
                    {realErrors.length > 0 && (
                      <ul className="max-h-32 shrink-0 space-y-1 overflow-y-auto text-xs text-red-600 dark:text-red-400">
                        {realErrors.map((f) => (
                          <li key={f.row} className="flex items-start gap-1.5">
                            <XCircle className="mt-0.5 size-3 shrink-0" />
                            Fila {f.row} ({f.email ?? "sin correo"}): {f.error}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                );
              })()}
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

// ── Cabecera ordenable ──────────────────────────────────────────────────────
// El orden lo resuelve el backend (la lista está paginada), así que la
// cabecera solo publica "por qué columna y en qué sentido".
function SortableHeader({
  field,
  label,
  sort,
  onSort,
  align = "center",
}: {
  field: AdminUserSortField;
  label: string;
  sort: { by: AdminUserSortField; dir: SortDirection };
  onSort: (field: AdminUserSortField) => void;
  align?: "left" | "center" | "right";
}) {
  const active = sort.by === field;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;

  return (
    <th
      scope="col"
      // aria-sort le dice al lector de pantalla lo mismo que la flecha dice
      // visualmente: por qué columna está ordenada la tabla.
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "py-2.5",
        // La tabla es text-left por defecto: la cabecera centrada tiene que
        // pedir el centrado explícitamente para alinearse con su columna.
        align === "left"
          ? "px-5 text-left"
          : align === "right"
            ? "px-5 text-right"
            : "px-3 text-center",
      )}
    >
      <button
        type="button"
        onClick={() => {
          onSort(field);
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded transition hover:text-foreground",
          align === "center" && "justify-center",
          active && "text-foreground",
        )}
      >
        {label}
        <Icon className={cn("size-3.5", !active && "opacity-40")} />
      </button>
    </th>
  );
}

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
  const [creds, setCreds] = useState<{ title: string; email: string; password: string } | null>(
    null,
  );

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
                  label="Fecha de alta"
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
