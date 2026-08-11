import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReleaseNote } from "./releases";

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function formatReleaseDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} de ${MONTHS[Number(m) - 1]} de ${y}`;
}

/**
 * Modal de "novedades" (presentacional). La lógica de qué mostrar y cuándo vive
 * en WhatsNewProvider; aquí solo pintamos las releases y avisamos al cerrar. Con
 * varias novedades se navega por paginación (una por pantalla) en vez de un
 * scroll largo: cada release luce como una "tarjeta" con su fecha y sus puntos.
 */
export function WhatsNewModal({
  isOpen,
  releases,
  onClose,
}: {
  isOpen: boolean;
  releases: ReleaseNote[];
  onClose: () => void;
}) {
  const [page, setPage] = useState(0);
  // Al abrir siempre arrancamos en la primera novedad. Se resetea comparando el
  // valor anterior durante el render (patrón recomendado por React) en vez de un
  // efecto, para no encadenar renders.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    setPage(0);
  }

  if (!isOpen || releases.length === 0) {
    return null;
  }

  const total = releases.length;
  const safePage = Math.min(page, total - 1);
  const release = releases[safePage];
  const isLast = safePage === total - 1;
  const isFirst = safePage === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar novedades"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
        {/* Cabecera con degradado de marca */}
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-gold via-brand-gold-dark to-brand-teal-dark px-7 py-6 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-10 size-40 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white/20 ring-1 ring-inset ring-white/30">
                <Sparkles className="size-6" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
                  Novedades
                </p>
                <h2 className="text-lg font-semibold leading-tight">Qué hay de nuevo</h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex size-8 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Contenido de la release actual */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-7 py-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-brand-teal/10 px-2.5 py-1 text-[11px] font-semibold text-brand-teal-dark dark:text-brand-teal">
              {formatReleaseDate(release.date)}
            </span>
            {total > 1 && (
              <span className="text-[11px] font-medium text-muted-foreground">
                {safePage + 1} de {total}
              </span>
            )}
          </div>

          <h3 className="text-xl font-semibold tracking-tight text-foreground">{release.title}</h3>

          <ul className="flex flex-col gap-2.5">
            {release.items.map((item, i) => (
              <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-muted-foreground">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-teal/15 text-brand-teal-dark dark:text-brand-teal">
                  <Check className="size-3.5" />
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Pie: paginación + acción principal */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-accent/30 px-7 py-4">
          {total > 1 ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setPage((p) => Math.max(p - 1, 0));
                }}
                disabled={isFirst}
                aria-label="Anterior"
                className="flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="size-4" />
              </button>
              {/* Indicadores de página */}
              <div className="flex items-center gap-1.5">
                {releases.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setPage(i);
                    }}
                    aria-label={`Ir a la novedad ${i + 1}`}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === safePage
                        ? "w-5 bg-brand-gold"
                        : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                    )}
                  />
                ))}
              </div>
            </div>
          ) : (
            <span />
          )}

          {isLast ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-brand-gold-dark"
            >
              Entendido
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setPage((p) => Math.min(p + 1, total - 1));
              }}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-brand-gold-dark"
            >
              Siguiente <ArrowRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
