import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, KeyRound } from "lucide-react";

/**
 * Entrada del portal del cliente: si el cliente solo tiene el token (no el
 * enlace completo), lo pega aquí y entra. No valida contra el backend en este
 * paso — la validación real ocurre al cargar /portal/{token} (404 si no existe),
 * que ya muestra "enlace no válido". Mantenerlo así evita un endpoint extra.
 */
export function ClientPortalEntry() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");

  const enter = () => {
    const clean = token.trim();
    if (clean) {
      void navigate(`/portal/${encodeURIComponent(clean)}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img
            src="/logo.webp"
            alt="Bitácora OBJ"
            className="h-12 w-12 rounded-lg object-contain"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Portal del cliente
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Introduce tu token de acceso para ver el avance de tu proyecto.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            enter();
          }}
          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <KeyRound className="size-3.5" /> Token de acceso
            </span>
            <input
              value={token}
              autoFocus
              onChange={(e) => {
                setToken(e.target.value);
              }}
              placeholder="Pega aquí tu token"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <button
            type="submit"
            disabled={!token.trim()}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-50"
          >
            Ver mi proyecto <ArrowRight className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export default ClientPortalEntry;
