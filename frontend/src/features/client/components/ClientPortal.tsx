import { FolderKanban, Moon, Sun } from "lucide-react";
import { useOutletContext } from "react-router";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useAuth } from "@/features/auth/hooks/use-auth";

/**
 * Portal del cliente: pantalla ÚNICA y de solo lectura con el resumen de su
 * proyecto. Es la "fontanería": el rol CLIENT aterriza aquí y no puede navegar a
 * otras áreas (lo bloquean los RoleGuard + el sidebar reducido).
 *
 * TODO (tuyo): cuando el comando "Generar acceso de cliente" asocie al cliente a
 * un proyecto, carga aquí su resumen (reutiliza el progreso de solo lectura ya
 * existente: GET /proyectos/{id}/progreso, guardado por membresía). De momento es
 * un shell para no invadir tu comando/eventos.
 */
export function ClientPortal() {
  const { dark, toggleDark } = useOutletContext<AppOutletContext>();
  const { user } = useAuth();

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-6 overflow-y-auto p-4 sm:p-6">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/logo.webp"
            alt="Bitácora OBJ"
            className="h-10 w-10 shrink-0 rounded-lg object-contain"
          />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              Hola, {user?.name ?? "cliente"}
            </h1>
            <p className="text-sm text-muted-foreground">Resumen de tu proyecto</p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleDark}
          aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-accent"
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold/15 dark:text-brand-gold">
          <FolderKanban className="size-6" />
        </div>
        <p className="font-semibold text-foreground">Aquí verás el resumen de tu proyecto</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          En cuanto el equipo vincule tu cuenta a un proyecto, verás su avance, fechas y entregables
          — en modo solo lectura.
        </p>
      </div>
    </div>
  );
}

export default ClientPortal;
