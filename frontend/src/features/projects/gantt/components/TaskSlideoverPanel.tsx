import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task } from "../types";
import type { BuilderNode } from "../../types";
import type { ProjectMember } from "../../types";
import { TaskDetailForm } from "./TaskDetailForm";

interface TaskSlideoverPanelProps {
  isOpen: boolean;
  task: Task | null; // null = creating new
  nodes: BuilderNode[];
  members: ProjectMember[];
  onClose: () => void;
  onSave: (task: Task, changeReason: string) => void;
  onDelete: (taskId: string) => void;
}

export function TaskSlideoverPanel({
  isOpen,
  task,
  nodes,
  members,
  onClose,
  onSave,
  onDelete,
}: TaskSlideoverPanelProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) {return;}
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") {onClose();} };
    document.addEventListener("keydown", handler);
    return () => { document.removeEventListener("keydown", handler); };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="slideover-title"
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-full flex-col sm:w-[420px]",
          "border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
          "shadow-2xl transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <h2
            id="slideover-title"
            className="text-sm font-semibold text-slate-900 dark:text-slate-50"
          >
            {task ? "Detalle de la tarea" : "Nueva tarea"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form (scrollable) */}
        <div className="flex-1 overflow-y-auto">
          {isOpen && (
            <TaskDetailForm
              key={task?.id ?? "new"}
              initialTask={task}
              nodes={nodes}
              members={members}
              onSave={onSave}
              onDelete={task ? () => { onDelete(task.id); } : undefined}
              onCancel={onClose}
            />
          )}
        </div>
      </aside>
    </>
  );
}
