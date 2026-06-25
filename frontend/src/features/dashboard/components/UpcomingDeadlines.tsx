import { ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { Deadline } from "../types";

const MAX_VISIBLE = 3;

function DeadlineRow({ deadline }: { deadline: Deadline }) {
  return (
    <div className="flex items-center gap-3 rounded-md p-2 transition-colors duration-150 hover:bg-slate-100 dark:hover:bg-slate-800/50">
      {/* Date block */}
      <div className="flex w-9 shrink-0 flex-col items-center justify-center rounded-md border border-slate-200 bg-slate-100 py-1 dark:border-slate-700 dark:bg-slate-800">
        <span className="text-[14px] font-bold leading-none text-slate-900 dark:text-slate-50">
          {deadline.day}
        </span>
        <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {deadline.month}
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-slate-800 dark:text-slate-100">
          {deadline.title}
        </p>
        <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{deadline.project}</p>
      </div>

      <StatusBadge variant={deadline.priority} className="shrink-0" />
    </div>
  );
}

interface UpcomingDeadlinesProps {
  deadlines: Deadline[];
}

export function UpcomingDeadlines({ deadlines }: UpcomingDeadlinesProps) {
  const visible = deadlines.slice(0, MAX_VISIBLE);
  const hasMore = deadlines.length > MAX_VISIBLE;

  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-semibold">Próximos vencimientos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-0.5">
        {visible.map((deadline) => (
          <DeadlineRow key={deadline.id} deadline={deadline} />
        ))}

        {hasMore && (
          <button
            type="button"
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 py-1.5 text-[11px] font-medium text-slate-500 transition-colors duration-150 hover:border-slate-300 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200"
          >
            Ver más
            <ChevronDown className="size-3" />
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
