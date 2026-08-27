import { useState } from "react";
import { Clock, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { useDeleteTimeEntry, useLogTime, useTaskEffort } from "../hooks/use-tasks";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

/** "2.50" → "2,5 h"; se muestran horas, no decimales de máquina. */
function hours(value: string | null): string {
  if (value == null) {
    return "—";
  }
  const n = Number(value);
  if (Number.isNaN(n)) {
    return "—";
  }
  return `${n.toLocaleString("es-CO", { maximumFractionDigits: 2 })} h`;
}

function todayIso(): string {
  const d = new Date();
  // Fecha LOCAL: con toISOString, quien esté al oeste de UTC apuntaría las
  // horas de la tarde en el día siguiente.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Esfuerzo de una tarea: lo estimado frente a lo dedicado, y los apuntes.
 *
 * Se apunta por DÍA, no con un cronómetro: nadie va a arrancar y parar un
 * contador mientras graba; lo que se hace es anotar al final de la jornada.
 * Cada apunte es una línea propia para poder corregir una sin tocar el resto.
 */
export function TaskEffortPanel({ projectId, taskId }: { projectId: string; taskId: string }) {
  const effortQuery = useTaskEffort(taskId);
  const logTime = useLogTime(projectId, taskId);
  const deleteEntry = useDeleteTimeEntry(projectId, taskId);

  const [adding, setAdding] = useState(false);
  const [hoursValue, setHoursValue] = useState("");
  const [workDate, setWorkDate] = useState(todayIso);
  const [notes, setNotes] = useState("");

  const effort = effortQuery.data;
  const estimated = effort?.estimated_hours ? Number(effort.estimated_hours) : null;
  const logged = effort ? Number(effort.logged_hours) : 0;
  const overBudget = estimated != null && logged > estimated;
  const pct = estimated && estimated > 0 ? Math.min(100, (logged / estimated) * 100) : null;

  const canSubmit = Number(hoursValue) > 0 && workDate !== "" && !logTime.isPending;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    logTime.mutate(
      { hours: hoursValue, work_date: workDate, notes: notes.trim() || null },
      {
        onSuccess: () => {
          setHoursValue("");
          setNotes("");
          setAdding(false);
        },
      },
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-center gap-2">
        <Clock className="size-4 text-brand-teal" />
        <h4 className="text-sm font-semibold text-foreground">Dedicación</h4>
        {effort && (
          <span
            className={cn(
              "ml-auto text-sm tabular-nums",
              overBudget ? "font-semibold text-amber-600 dark:text-amber-400" : "text-foreground",
            )}
          >
            {hours(effort.logged_hours)}
            <span className="text-muted-foreground"> de {hours(effort.estimated_hours)}</span>
          </span>
        )}
      </header>

      {pct != null && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent">
          <div
            className={cn("h-full rounded-full", overBudget ? "bg-amber-500" : "bg-brand-teal")}
            style={{ width: `${String(pct)}%` }}
          />
        </div>
      )}
      {overBudget && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Ya se dedicó más de lo estimado. No bloquea nada: sirve para estimar mejor la próxima.
        </p>
      )}

      {effortQuery.isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-accent" />
      ) : (
        <ul className="flex flex-col gap-1">
          {effort?.entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs"
            >
              <span className="w-16 shrink-0 font-semibold tabular-nums text-foreground">
                {hours(entry.hours)}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{entry.work_date}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {entry.user_name}
                {entry.notes ? ` · ${entry.notes}` : ""}
              </span>
              <button
                type="button"
                onClick={() => {
                  deleteEntry.mutate(entry.id);
                }}
                disabled={deleteEntry.isPending}
                aria-label={`Borrar registro de ${hours(entry.hours)}`}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-950/30"
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
          {effort?.entries.length === 0 && !adding && (
            <li className="py-2 text-center text-xs text-muted-foreground">
              Nadie ha registrado horas todavía.
            </li>
          )}
        </ul>
      )}

      {adding ? (
        <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Horas</span>
              <input
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                autoFocus
                className={inputCls}
                value={hoursValue}
                aria-label="Horas dedicadas"
                onChange={(e) => {
                  setHoursValue(e.target.value);
                }}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Día</span>
              <input
                type="date"
                className={inputCls}
                value={workDate}
                aria-label="Día trabajado"
                onChange={(e) => {
                  setWorkDate(e.target.value);
                }}
              />
            </label>
          </div>
          <input
            type="text"
            className={inputCls}
            placeholder="En qué se fueron (opcional)"
            aria-label="Notas"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
            }}
          />
          {logTime.isError && (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              {getErrorMessage(logTime.error, "No se pudieron registrar las horas")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
              }}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-60"
            >
              {logTime.isPending ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setAdding(true);
          }}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-teal/40 hover:text-brand-teal-dark dark:hover:text-brand-teal"
        >
          <Plus className="size-3.5" /> Registrar horas
        </button>
      )}
    </section>
  );
}
