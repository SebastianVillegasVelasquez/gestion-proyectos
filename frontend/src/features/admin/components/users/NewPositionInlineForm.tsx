import { useState } from "react";
import { getErrorMessage } from "@/utils/get-error-message";
import { useCreatePosition } from "../../hooks/use-positions";
import { inputCls } from "./users-ui";

// ── Formulario inline: alta de un cargo nuevo (sin salir del modal) ─────────
export function NewPositionInlineForm({
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
