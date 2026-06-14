import { Pencil, UserPlus, CalendarRange } from "lucide-react";

interface ActionBarProps {
  onEdit: () => void;
  onAddMembers: () => void;
  onManageTasks: () => void;
}

export function ActionBar({ onEdit, onAddMembers, onManageTasks }: ActionBarProps) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {/* Secondary actions */}
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
      >
        <Pencil className="size-3.5" />
        Editar proyecto
      </button>

      <button
        type="button"
        onClick={onAddMembers}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-700"
      >
        <UserPlus className="size-3.5" />
        Añadir miembros
      </button>

      {/* Primary CTA — intentional right-side push on wider screens */}
      <div className="flex-1" />

      <button
        type="button"
        onClick={onManageTasks}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
      >
        <CalendarRange className="size-4" />
        Gestionar tareas y cronograma
      </button>
    </div>
  );
}
