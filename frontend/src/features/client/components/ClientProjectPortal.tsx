import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, KeyRound, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { portalApi, type PublicProjectProgress } from "../api/portal.api";

const STATUS_META: Record<PublicProjectProgress["status"], { label: string; badge: string }> = {
  active: {
    label: "En marcha",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  "in-review": {
    label: "En revisión",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  },
  "at-risk": {
    label: "Requiere atención",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  },
};

/** Arma la narrativa que "escribe" la IA a partir de los datos reales del proyecto. */
function buildSummary(data: PublicProjectProgress): string {
  const progress = Math.round(data.progress_pct);
  const parts: string[] = [];

  // Apertura contextual según el avance.
  if (progress === 0) {
    parts.push(
      `El proyecto “${data.name}” está en su fase inicial: aún no se ha registrado avance sobre las tareas planificadas.`,
    );
  } else if (progress < 25) {
    parts.push(
      `El proyecto “${data.name}” está arrancando: llevamos un ${progress}% completado y el equipo se encuentra sentando las bases.`,
    );
  } else if (progress < 60) {
    parts.push(
      `El proyecto “${data.name}” avanza a buen ritmo con un ${progress}% completado; ya hay resultados tangibles y el trabajo continúa.`,
    );
  } else if (progress < 90) {
    parts.push(
      `El proyecto “${data.name}” se encuentra en una etapa avanzada, con un ${progress}% completado. El cierre está cada vez más cerca.`,
    );
  } else if (progress < 100) {
    parts.push(
      `El proyecto “${data.name}” está prácticamente terminado: hemos alcanzado un ${progress}% y solo quedan los últimos detalles.`,
    );
  } else {
    parts.push(
      `El proyecto “${data.name}” está completado al 100%. Todas las tareas planificadas han cerrado con éxito.`,
    );
  }

  // Segunda frase: estado global.
  const statusPhrase: Record<PublicProjectProgress["status"], string> = {
    active: "El equipo trabaja según lo planeado y no hay bloqueos relevantes en este momento.",
    "in-review": "Actualmente hay entregables en revisión y se están validando antes de continuar.",
    "at-risk":
      "Se han detectado señales que requieren atención y el equipo está trabajando para retomar el rumbo previsto.",
  };
  parts.push(statusPhrase[data.status]);

  // Cierre con la persona responsable.
  if (data.coordinator) {
    parts.push(
      `${data.coordinator} lidera esta iniciativa y es el punto de contacto directo con el equipo.`,
    );
  }

  parts.push("Este resumen se actualiza automáticamente conforme el equipo registra los avances.");

  return parts.join(" ");
}

/** Efecto typewriter: revela `text` carácter a carácter (~55 wpm). */
function useStreamingText(text: string, charsPerTick = 4, tickMs = 22): string {
  const [shown, setShown] = useState("");

  useEffect(() => {
    setShown("");
    if (!text) {
      return;
    }
    let i = 0;
    const id = window.setInterval(() => {
      i = Math.min(i + charsPerTick, text.length);
      setShown(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
      }
    }, tickMs);
    return () => {
      window.clearInterval(id);
    };
  }, [text, charsPerTick, tickMs]);

  return shown;
}

/**
 * Portal del cliente: pantalla ÚNICA y pública. El cliente recibe el enlace y el
 * token por separado; introduce el token aquí y, con un POST (nunca en la URL),
 * carga el avance de su proyecto en la misma pantalla. Mientras no hay datos,
 * muestra el formulario de acceso; tras un token válido, el resumen del proyecto.
 */
export function ClientProjectPortal() {
  const [token, setToken] = useState("");

  const mutation = useMutation({
    mutationFn: (t: string) => portalApi.getProgress(t),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = token.trim();
    if (clean) {
      mutation.mutate(clean);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
        <header className="flex items-center gap-3">
          <img
            src="/logo.webp"
            alt="Bitácora OBJ"
            className="h-10 w-10 shrink-0 rounded-lg object-contain"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Bitácora OBJ · Portal del cliente
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Seguimiento de tu proyecto en tiempo real
            </p>
          </div>
        </header>

        {mutation.data ? (
          <Portal data={mutation.data} />
        ) : (
          <form
            onSubmit={submit}
            className="mx-auto flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-1 text-center">
              <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                Introduce tu token de acceso
              </h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                El equipo del proyecto te compartió un token. Pégalo aquí para ver el avance.
              </p>
            </div>
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
            {mutation.isError && (
              <p className="text-sm text-rose-600 dark:text-rose-400">
                Token no válido o expirado. Verifícalo o solicita uno nuevo al equipo del proyecto.
              </p>
            )}
            <button
              type="submit"
              disabled={!token.trim() || mutation.isPending}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-50"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  Ver mi proyecto <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-400 dark:text-slate-600">
          Vista de solo lectura · La información se actualiza a medida que el equipo avanza.
        </p>
      </div>
    </div>
  );
}

function Portal({ data }: { data: PublicProjectProgress }) {
  const status = STATUS_META[data.status];
  const progress = Math.round(data.progress_pct);

  // Simulación de IA: la narrativa se computa una vez y se revela en streaming.
  const summary = useMemo(() => buildSummary(data), [data]);
  const streamed = useStreamingText(summary);
  const isStreaming = streamed.length < summary.length;

  return (
    <>
      {/* Encabezado del proyecto + avance general */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              {data.name}
            </h1>
            {(data.client_name ?? data.coordinator) && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {data.client_name}
                {data.client_name && data.coordinator && " · "}
                {data.coordinator && `Coordina: ${data.coordinator}`}
              </p>
            )}
          </div>
          <span
            className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold", status.badge)}
          >
            {status.label}
          </span>
        </div>

        <div className="mt-6">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Avance general
            </span>
            <span className="text-2xl font-semibold text-brand-blue-dark dark:text-brand-blue tabular-nums">
              {progress}%
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-brand-blue transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </section>

      {/* Resumen "generado" por IA con efecto streaming */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Resumen automático
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Redactado a partir del estado actual del proyecto
            </p>
          </div>
        </div>
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-slate-700 dark:text-slate-200">
          {streamed}
          {isStreaming && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-brand-blue"
            />
          )}
        </p>
      </section>
    </>
  );
}

export default ClientProjectPortal;
