import { useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { WhatsNewContext } from "./whats-new-context";
import { relevantReleases, unseenReleases } from "./releases";
import { useMarkReleasesSeen, useSeenReleases } from "./use-whats-new";
import { WhatsNewModal } from "./WhatsNewModal";

/**
 * Orquesta las "novedades": trae del backend qué vio la persona, calcula las
 * pendientes según su rol, abre el modal automáticamente cuando hay pendientes
 * y expone (vía contexto) el conteo y una acción para reabrirlo manualmente.
 * Al cerrar, marca como vistas las pendientes (persistencia por persona), con lo
 * que el contador baja a 0 hasta que aparezca un release nuevo.
 */
export function WhatsNewProvider({ children }: { children: ReactNode }) {
  const { user, hasRole } = useAuth();
  const isElevated = hasRole(["admin", "super_admin", "developer"]);
  const enabled = Boolean(user);

  const seenQuery = useSeenReleases(enabled);
  const markSeen = useMarkReleasesSeen();

  // `data?.release_ids` es estable mientras no cambie la data del query; el
  // `?? []` va dentro del useMemo para no crear un array nuevo en cada render.
  const seenIds = seenQuery.data?.release_ids;
  const unseen = useMemo(
    () => (enabled ? unseenReleases(seenIds ?? [], isElevated) : []),
    [enabled, seenIds, isElevated],
  );
  const relevant = useMemo(
    () => (enabled ? relevantReleases(isElevated) : []),
    [enabled, isElevated],
  );

  const [manualOpen, setManualOpen] = useState(false);
  const [autoDismissed, setAutoDismissed] = useState(false);

  // Apertura automática: solo tras cargar el set de vistas y si hay pendientes.
  const autoOpen = seenQuery.isSuccess && unseen.length > 0 && !autoDismissed;
  const isOpen = manualOpen || autoOpen;

  // Reapertura manual sin pendientes → mostramos el changelog relevante completo.
  const shown = unseen.length > 0 ? unseen : relevant;

  const close = () => {
    if (unseen.length > 0) {
      markSeen.mutate(unseen.map((r) => r.id));
    }
    setManualOpen(false);
    setAutoDismissed(true);
  };

  const value = useMemo(
    () => ({
      unseenCount: unseen.length,
      hasReleases: relevant.length > 0,
      open: () => {
        setManualOpen(true);
      },
    }),
    [unseen.length, relevant.length],
  );

  return (
    <WhatsNewContext.Provider value={value}>
      {children}
      <WhatsNewModal isOpen={isOpen} releases={shown} onClose={close} />
    </WhatsNewContext.Provider>
  );
}
