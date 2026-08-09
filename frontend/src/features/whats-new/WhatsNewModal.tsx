import { useMemo, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { markSeen, unseenReleases } from "./releases";

/**
 * Modal de "novedades": al iniciar sesión, muestra UNA sola vez a cada usuario
 * las actualizaciones que le conciernen según su rol (elevado vs. normal). Al
 * cerrarlo se marcan como vistas (localStorage por usuario) y no vuelve a salir.
 * Se monta en el shell autenticado (AppLayout), así aparece tras el login y al
 * recargar mientras haya novedades pendientes.
 */
export function WhatsNewModal() {
  const { user, hasRole } = useAuth();
  const isElevated = hasRole(["admin", "super_admin"]);

  // Novedades pendientes al montar. Se congela para que marcar como vistas al
  // cerrar no vacíe la lista en pleno render.
  const pending = useMemo(
    () => (user ? unseenReleases(user.id, isElevated) : []),
    [user, isElevated],
  );

  // El estado es "descartado" (no "abierto"): así la visibilidad se deriva de
  // las novedades pendientes sin un efecto que sincronice estado con props.
  const [dismissed, setDismissed] = useState(false);

  if (!user || dismissed || pending.length === 0) {
    return null;
  }

  const close = () => {
    markSeen(
      user.id,
      pending.map((r) => r.id),
    );
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar novedades"
        className="absolute inset-0 bg-black/50"
        onClick={close}
      />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-accent/40 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Sparkles className="size-5 text-brand-gold" /> Novedades
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-5 py-5">
          {pending.map((release) => (
            <section key={release.id} className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">{release.title}</h3>
              <ul className="flex flex-col gap-1.5">
                {release.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand-teal" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex justify-end border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={close}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-brand-gold-dark"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
