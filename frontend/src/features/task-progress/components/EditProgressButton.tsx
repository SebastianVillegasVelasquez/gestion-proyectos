import { useState } from "react";
import { Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { TaskProgressDialog } from "./TaskProgressDialog";

/** Botón «Avance» que abre el diálogo de edición con evidencia. */
export function EditProgressButton({
  taskId,
  taskTitle,
  compact = false,
  className,
}: {
  taskId: string;
  taskTitle: string;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="Actualizar el avance con evidencia"
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md border border-border font-semibold text-foreground transition-colors hover:bg-accent",
          compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
          className,
        )}
      >
        <Gauge className={compact ? "size-3" : "size-3.5"} />
        Avance
      </button>
      {open && (
        <TaskProgressDialog
          taskId={taskId}
          taskTitle={taskTitle}
          onClose={() => {
            setOpen(false);
          }}
        />
      )}
    </>
  );
}
