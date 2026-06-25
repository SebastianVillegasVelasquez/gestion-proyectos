import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Deliverable, WorkspaceMember, DeliverableStatus } from "../types";
import { DELIVERABLE_STATUS_LABELS, DELIVERABLE_STATUS_BADGE } from "../types";
import { RESOURCE_META } from "../utils/resource-types";

function StatusBadge({ status }: { status: DeliverableStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        DELIVERABLE_STATUS_BADGE[status],
      )}
    >
      {DELIVERABLE_STATUS_LABELS[status]}
    </span>
  );
}

function DeliverableIcon({ d }: { d: Deliverable }) {
  const latest = d.versions.at(-1);
  if (!latest) {
    return <Package className="size-4 text-slate-400" />;
  }
  const meta = RESOURCE_META[latest.type];
  const Icon = meta.Icon;
  return <Icon className={cn("size-4", meta.color)} />;
}

interface DeliverableListProps {
  deliverables: Deliverable[];
  members: WorkspaceMember[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DeliverableList({
  deliverables,
  members,
  selectedId,
  onSelect,
}: DeliverableListProps) {
  const getMember = (id: string) => members.find((m) => m.id === id);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Entregables activos
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {deliverables.length}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-2">
        {deliverables.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            Sin entregables aún.
          </p>
        ) : (
          deliverables.map((d) => {
            const assignee = getMember(d.assigneeId);
            const isSelected = d.id === selectedId;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  onSelect(d.id);
                }}
                className={cn(
                  "group w-full border-l-2 px-4 py-3.5 text-left transition-colors duration-100",
                  isSelected
                    ? "border-l-brand-gold bg-brand-gold-light"
                    : "border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40",
                )}
              >
                {/* Title row */}
                <div className="flex items-start gap-2.5">
                  <div
                    className={cn(
                      "mt-0.5 shrink-0 rounded-md p-1",
                      isSelected ? "bg-brand-gold-light" : "bg-slate-100 dark:bg-slate-800",
                    )}
                  >
                    <DeliverableIcon d={d} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-[13px] font-medium leading-snug",
                        isSelected
                          ? "text-brand-gold-dark dark:text-brand-gold"
                          : "text-slate-700 dark:text-slate-200",
                      )}
                    >
                      {d.taskTitle}
                    </p>

                    {/* Assignee */}
                    {assignee && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white",
                            assignee.avatarColor,
                          )}
                        >
                          {assignee.initials}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {assignee.name}
                        </span>
                      </div>
                    )}

                    {/* Footer: status + version count */}
                    <div className="mt-2 flex items-center gap-2">
                      <StatusBadge status={d.status} />
                      {d.versions.length > 0 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {d.versions.length} versión{d.versions.length !== 1 ? "es" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
