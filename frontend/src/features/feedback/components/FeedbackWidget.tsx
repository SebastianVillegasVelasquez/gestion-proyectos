import { useState } from "react";
import {
  Check,
  Lightbulb,
  MessageCircle,
  MessageSquarePlus,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { useSendFeedback } from "../hooks/use-feedback";
import { FEEDBACK_OPTIONS, type FeedbackType } from "../types";

const TYPE_ICON: Record<FeedbackType, LucideIcon> = {
  positivo: ThumbsUp,
  negativo: ThumbsDown,
  nueva_funcionalidad: Lightbulb,
  nice_to_have: Sparkles,
  otro: MessageCircle,
};

const MIN_LENGTH = 3;

function FeedbackModal({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<FeedbackType>("positivo");
  const [message, setMessage] = useState("");
  const sendFeedback = useSendFeedback();

  const canSubmit = message.trim().length >= MIN_LENGTH && !sendFeedback.isPending;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    sendFeedback.mutate({
      feedback_type: type,
      message: message.trim(),
      page: window.location.pathname,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:items-center sm:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Enviar feedback"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <MessageSquarePlus className="size-4 text-brand-gold" /> Tu opinión nos ayuda
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

        {sendFeedback.isSuccess ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Check className="size-6" />
            </div>
            <p className="font-semibold text-foreground">¡Gracias por tu feedback!</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Lo revisaremos para seguir mejorando la plataforma.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 px-5 py-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ¿De qué se trata?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FEEDBACK_OPTIONS.map((opt) => {
                  const Icon = TYPE_ICON[opt.value];
                  const active = type === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        setType(opt.value);
                      }}
                      aria-pressed={active}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                        active
                          ? "border-brand-gold bg-brand-gold-light text-foreground dark:bg-brand-gold/15"
                          : "border-border bg-background text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-brand-gold" />
                      <span className="truncate font-medium">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Cuéntanos
              </span>
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                }}
                rows={4}
                autoFocus
                maxLength={2000}
                placeholder="Escribe aquí lo bueno, lo malo o tu idea…"
                aria-label="Mensaje de feedback"
                className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20"
              />
            </label>

            {sendFeedback.isError && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {getErrorMessage(sendFeedback.error, "No se pudo enviar tu feedback")}
              </p>
            )}

            <div className="flex justify-end gap-2">
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
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sendFeedback.isPending ? "Enviando…" : "Enviar feedback"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Widget de feedback siempre visible: un botón flotante (abajo a la derecha) que
 * abre el formulario. Se monta una vez en el layout autenticado.
 */
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        aria-label="Abrir feedback"
        className="fixed bottom-5 right-5 z-40 flex items-center justify-center rounded-full bg-brand-gold p-3 text-brand-black shadow-lg transition hover:bg-brand-gold-dark active:scale-95"
      >
        <MessageSquarePlus className="size-5" />
      </button>

      {open && (
        <FeedbackModal
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
