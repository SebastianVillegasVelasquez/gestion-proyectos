import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { getErrorMessage } from "@/utils/get-error-message";
import { profileApi } from "../api/profile.api";

const MAX = 500;

/**
 * «Sobre mí»: el único campo del perfil que edita la propia persona. El nombre,
 * el correo, el rol y el cargo los administra la organización, así que aquí se
 * muestran pero no se tocan (y el servidor tampoco los aceptaría).
 */
export function BioEditor({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const save = useMutation({ mutationFn: (bio: string) => profileApi.updateBio(bio) });
  const dirty = text.trim() !== initial.trim();

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        maxLength={MAX}
        rows={4}
        onChange={(e) => {
          setText(e.target.value);
        }}
        placeholder="Cuenta en qué trabajas, en qué puedes ayudar o cómo prefieres que te contacten."
        aria-label="Sobre mí"
        className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {text.length} / {MAX}
        </span>
        <div className="flex items-center gap-3">
          {save.isError && (
            <span role="alert" className="text-xs text-red-600 dark:text-red-400">
              {getErrorMessage(save.error, "No se pudo guardar")}
            </span>
          )}
          {save.isSuccess && !dirty && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">Guardado.</span>
          )}
          <button
            type="button"
            onClick={() => {
              save.mutate(text.trim());
            }}
            disabled={!dirty || save.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {save.isPending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
