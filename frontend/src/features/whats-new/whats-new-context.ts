import { createContext, useContext } from "react";

export interface WhatsNewValue {
  /** Novedades relevantes al rol que la persona aún no ha visto. */
  unseenCount: number;
  /** ¿Hay novedades relevantes al rol (vistas o no) para poder reabrir? */
  hasReleases: boolean;
  /** Abre el modal manualmente (p. ej. desde el botón «Novedades»). */
  open: () => void;
}

export const WhatsNewContext = createContext<WhatsNewValue | null>(null);

// Valor seguro por defecto: si algún consumidor queda fuera del provider, no
// rompe (simplemente no hay novedades ni acción de abrir).
export function useWhatsNew(): WhatsNewValue {
  return (
    useContext(WhatsNewContext) ?? {
      unseenCount: 0,
      hasReleases: false,
      open: () => {
        /* sin provider: no-op */
      },
    }
  );
}
