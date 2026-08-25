import { useState } from "react";
import { Plus, UserPlus, X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { Role } from "@/features/auth/types";
import type { DocumentType } from "@/features/projects/types/api.types";
import { DOCUMENT_TYPE_LABELS, DOCUMENT_TYPES } from "@/features/projects/types/labels";
import { usePositions } from "../../hooks/use-positions";
import { useCreateUser } from "../../hooks/use-admin-users";
import { NewPositionInlineForm } from "./NewPositionInlineForm";
import { inputCls } from "./users-ui";

// ── Modal: crear usuario ────────────────────────────────────────────────────
export function CreateUserModal({
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
