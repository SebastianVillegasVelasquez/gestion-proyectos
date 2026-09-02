import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { Deadline } from "../types";

const MAX_VISIBLE = 4;

/** Fila compacta: chip de fecha + título con la prioridad pegada al lado (antes
 *  iban en extremos opuestos por un `justify-between` y se leían desconectados);
 *  el proyecto va debajo, en gris. */
function DeadlineRow({ deadline }: { deadline: Deadline }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800/50">
      <div className="flex w-8 shrink-0 flex-col items-center rounded border border-slate-200 bg-slate-100 py-0.5 dark:border-slate-700 dark:bg-slate-800">
        <span className="text-[12px] font-bold leading-none text-slate-900 dark:text-slate-50">
          {deadline.day}
        </span>
        <span className="text-[8px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {deadline.month}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-100">
            {deadline.title}
          </p>
          <StatusBadge variant={deadline.priority} className="shrink-0" />
        </div>
        <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">
          {deadline.project}
        </p>
      </div>
    </div>
  );
}

interface UpcomingDeadlinesProps {
  deadlines: Deadline[];
  /** Entregas propias (tareas + subtareas) de los últimos 7 días. */
  deliveredLast7d?: number;
}

export function UpcomingDeadlines({ deadlines, deliveredLast7d }: UpcomingDeadlinesProps) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? deadlines : deadlines.slice(0, MAX_VISIBLE);
  const hasMore = deadlines.length > MAX_VISIBLE;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-1">
        <CardTitle className="text-sm font-semibold">Próximos vencimientos</CardTitle>
        {deliveredLast7d != null && (
          <span
            title="Tareas y subtareas que entregaste en los últimos 7 días"
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          >
            <CheckCircle2 className="size-3" />
            {deliveredLast7d} entregada{deliveredLast7d === 1 ? "" : "s"} · 7 d
          </span>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5">
        {visible.map((deadline) => (
          <DeadlineRow key={deadline.id} deadline={deadline} />
        ))}

        {hasMore && (
          <button
            type="button"
            onClick={() => {
              setExpanded((v) => !v);
            }}
            className="mt-1.5 flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 py-1 text-[11px] font-medium text-slate-500 transition-colors duration-150 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
          >
            {expanded ? "Ver menos" : `Ver ${String(deadlines.length - MAX_VISIBLE)} más`}
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        )}

        {deadlines.length === 0 && (
          <p className="py-3 text-center text-[12px] text-slate-400 dark:text-slate-600">
            Sin vencimientos próximos
          </p>
        )}
      </CardContent>
    </Card>
  );
}
