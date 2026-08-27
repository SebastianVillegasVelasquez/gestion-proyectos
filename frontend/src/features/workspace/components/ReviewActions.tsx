import { useState } from "react";
import { AlertCircle, CheckCircle2, Lock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CommentType, Deliverable } from "../types";

// Las tres decisiones de revisión. Cada una es un COMENTARIO tipado: el motivo
// queda en el hilo y el backend mueve el estado del entregable y de la tarea
// vinculada. No hay un endpoint "cambiar estado" suelto a propósito — un
// cambio de estado sin motivo escrito es exactamente lo que rompe la
// trazabilidad cuando alguien pregunta "¿por qué se devolvió esto?".
type Decision = Extract<CommentType, "aprobacion" | "solicitud_cambio" | "rechazo">;

interface DecisionMeta {
  label: string;
  Icon: React.ElementType;
  /** Estilo del botón en reposo. */
  button: string;
  /** ¿Exige escribir un motivo antes de enviar? */
  requiresReason: boolean;
  placeholder: string;
  helper: string;
}

const DECISIONS: Record<Decision, DecisionMeta> = {
  aprobacion: {
    label: "Aprobar",
    Icon: CheckCircle2,
    button:
      "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50",
    // Aprobar sin comentario es legítimo: el trabajo habla por sí solo.
    requiresReason: false,
    placeholder: "Nota de aprobación (opcional)",
    helper: "Marca el entregable como aprobado y completa la tarea vinculada.",
  },
  solicitud_cambio: {
    label: "Solicitar cambios",
    Icon: AlertCircle,
    button:
      "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400 dark:hover:bg-amber-950/50",
    requiresReason: true,
    placeholder: "¿Qué hay que ajustar? Sé concreto: es lo que leerá quien entregó.",
    helper: "Devuelve la tarea para una nueva versión sobre el mismo enfoque.",
  },
  rechazo: {
    label: "Rechazar",
    Icon: XCircle,
    button:
      "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50",
    requiresReason: true,
    placeholder: "Motivo del rechazo (queda en el historial de la tarea).",
    helper: "Cierra la entrega tal como está: hay que replantearla desde cero.",
  },
};

interface ReviewActionsProps {
  deliverable: Deliverable;
  /** ¿El usuario es líder o supervisor DEL EQUIPO? Lo decide el servidor. */
  canReview: boolean;
  pending: boolean;
  onDecide: (type: Decision, reason: string) => void;
}

/**
 * Acciones de moderación del entregable. Vive junto a la línea de tiempo (y no
 * en el hilo de comentarios) porque decidir sobre la entrega es una acción
 * sobre el entregable, no un mensaje más de la conversación.
 */
export function ReviewActions({ deliverable, canReview, pending, onDecide }: ReviewActionsProps) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");

  if (!canReview) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed border-slate-200 px-4 py-3 dark:border-slate-700">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
        <p className="text-[12px] leading-relaxed text-slate-400 dark:text-slate-500">
          Solo el líder o supervisor puede solicitar cambios o aprobar.
        </p>
      </div>
    );
  }

  // Un entregable sin ninguna versión aún no es revisable: no hay qué mirar.
  if (deliverable.versions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-3 text-[12px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
        Aún no hay ninguna entrega que revisar.
      </p>
    );
  }

  const meta = decision ? DECISIONS[decision] : null;
  const missingReason = meta?.requiresReason === true && reason.trim() === "";

  const reset = () => {
    setDecision(null);
    setReason("");
  };

  const confirm = () => {
    if (!decision || missingReason) {
      return;
    }
    onDecide(decision, reason.trim());
    reset();
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Revisión
      </p>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(DECISIONS) as Decision[]).map((key) => {
          const d = DECISIONS[key];
          const { Icon } = d;
          const selected = decision === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                // Segundo clic sobre la misma acción = cancelar. Evita dejar el
                // panel abierto sin una salida obvia.
                setDecision(selected ? null : key);
                setReason("");
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors",
                d.button,
                selected && "ring-2 ring-current/25",
              )}
            >
              <Icon className="size-3.5" />
              {d.label}
            </button>
          );
        })}
      </div>

      {meta && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{meta.helper}</p>
          <textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
            }}
            rows={3}
            autoFocus
            placeholder={meta.placeholder}
            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-700 outline-none transition-colors focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {meta.requiresReason
                ? "El motivo es obligatorio y queda en la trazabilidad."
                : "La nota es opcional."}
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={reset}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={missingReason || pending}
                className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-40"
              >
                {pending ? "Enviando…" : `Confirmar: ${meta.label.toLowerCase()}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
