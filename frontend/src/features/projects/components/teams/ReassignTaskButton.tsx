import { useState } from "react";
import { Check, UserCog, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUpdateTask } from "../../hooks/use-tasks";
import { colorForName } from "../../utils/entity-color";
import { fullName, initialsOf } from "../../utils/task-assignment";

/**
 * Reasigna una tarea del equipo a otro integrante DEL MISMO equipo. Sustituye
 * al viejo `<select>`: un botón que muestra al responsable actual con SU color
 * (paleta determinista por nombre, la misma que usan los chips de equipo) y
 * abre un modal para elegir. Es la única potestad del líder/supervisor sobre
 * tareas que no son suyas; solo toca `assignee_id`.
 */

interface Person {
  user_id: string;
  name: string;
  last_name: string;
}

export function ReassignTaskButton({
  projectId,
  taskId,
  currentAssigneeId,
  members,
  onDone,
  compact = false,
  variant = "button",
}: {
  projectId: string;
  taskId: string;
  currentAssigneeId: string | null;
  members: Person[];
  onDone?: () => void;
  /** Solo el icono, sin el nombre del responsable: para cuando la vista ya está
   *  agrupada/filtrada por persona y repetir el nombre en cada fila es ruido. */
  compact?: boolean;
  /**
   * `"chip"`: se pinta como la pastilla teal del responsable (mismo color y
   * nombre que la vista de solo lectura), pero al pulsarla abre el reasignador.
   * Así la estructura muestra UN solo elemento —quién está asignado— en lugar
   * de repetir el nombre en un chip estático y otra vez en el botón.
   */
  variant?: "button" | "chip";
}) {
  const [open, setOpen] = useState(false);
  const update = useUpdateTask(projectId);
  const current = members.find((m) => m.user_id === currentAssigneeId) ?? null;
  const currentLabel = current ? fullName(current) : "Asignar responsable";
  const isChip = variant === "chip";

  function choose(nextId: string | null) {
    setOpen(false);
    if (nextId === currentAssigneeId) {
      return;
    }
    update.mutate({ taskId, payload: { assignee_id: nextId } }, { onSuccess: onDone });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={update.isPending}
        onClick={() => {
          setOpen(true);
        }}
        aria-label={`Reasignar responsable (actual: ${currentLabel})`}
        title={
          isChip
            ? `Reasignar — actual: ${currentLabel}`
            : compact
              ? `Reasignar — actual: ${currentLabel}`
              : undefined
        }
        className={cn(
          "flex max-w-full items-center rounded-full font-semibold transition hover:opacity-90 disabled:opacity-50",
          compact ? "size-6 justify-center p-0" : "gap-1.5 px-2 py-1 text-[11px]",
          isChip
            ? current
              ? "bg-brand-teal/10 px-2 py-0.5 text-brand-teal-dark dark:text-brand-teal"
              : "border border-dashed border-border px-2 py-0.5 text-muted-foreground hover:border-brand-gold hover:text-brand-gold-dark"
            : current
              ? colorForName(fullName(current))
              : "border border-dashed border-border text-muted-foreground hover:border-brand-gold hover:text-brand-gold-dark",
        )}
      >
        <UserCog
          className={cn(
            "shrink-0",
            isChip ? "size-3 opacity-60" : "opacity-70",
            compact ? "size-3.5" : "size-3",
          )}
        />
        {!compact && (
          <span className="max-w-[130px] truncate">
            {update.isPending
              ? "Guardando…"
              : current
                ? fullName(current)
                : isChip
                  ? "Sin responsable"
                  : "Asignar"}
          </span>
        )}
      </button>

      {update.isError && (
        <span className="text-[11px] text-rose-600 dark:text-rose-400">
          No se pudo reasignar. Revisa que la persona siga en el equipo.
        </span>
      )}

      {open && (
        <ReassignModal
          members={members}
          currentAssigneeId={currentAssigneeId}
          onPick={choose}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ReassignModal({
  members,
  currentAssigneeId,
  onPick,
  onClose,
}: {
  members: Person[];
  currentAssigneeId: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <UserCog className="size-4 text-brand-gold" /> Reasignar responsable
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => {
              onPick(null);
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-accent",
              currentAssigneeId === null && "bg-accent",
            )}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted-foreground">
              —
            </span>
            <span className="flex-1 text-muted-foreground">Sin responsable</span>
            {currentAssigneeId === null && <Check className="size-4 text-brand-gold" />}
          </button>

          {members.map((m) => {
            const name = fullName(m);
            const isCurrent = m.user_id === currentAssigneeId;
            return (
              <button
                key={m.user_id}
                type="button"
                onClick={() => {
                  onPick(m.user_id);
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-accent",
                  isCurrent && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    colorForName(name),
                  )}
                >
                  {initialsOf(m)}
                </span>
                <span
                  className={cn(
                    "flex-1 truncate font-medium",
                    isCurrent ? "text-foreground" : "text-foreground/80",
                  )}
                >
                  {name}
                </span>
                {isCurrent && <Check className="size-4 shrink-0 text-brand-gold" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
