import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import type { AdminUser } from "../../api/users.api";
import { usePositions } from "../../hooks/use-positions";
import { useUpdateUser } from "../../hooks/use-admin-users";
import { NewPositionInlineForm } from "./NewPositionInlineForm";
import { inputCls } from "./users-ui";

// ── Modal: editar datos del usuario ─────────────────────────────────────────
export function EditUserModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [form, setForm] = useState({
    name: user.name,
    last_name: user.last_name,
    email: user.email,
    position: user.position,
  });
  const [mustChangePassword, setMustChangePassword] = useState(user.must_change_password);
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
          must_change_password: mustChangePassword,
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
          <label className="mt-1 flex items-start gap-2.5 rounded-lg border border-border bg-background/60 px-3 py-2.5">
            <input
              type="checkbox"
              checked={mustChangePassword}
              onChange={(e) => {
                setMustChangePassword(e.target.checked);
              }}
              className="mt-0.5 size-4 shrink-0 accent-brand-gold"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">
                Pedir cambio de contraseña en el próximo ingreso
              </span>
              <span className="text-xs text-muted-foreground">
                Desmárcalo para que esta cuenta entre directo con su contraseña actual, sin el modal
                de bienvenida.
              </span>
            </span>
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
