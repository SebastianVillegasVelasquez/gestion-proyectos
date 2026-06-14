import { useState } from "react";
import {
  Minus,
  ChevronDown,
  Equal,
  ChevronUp,
  ChevronsUp,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority } from "../types";
import {
  TASK_STATUS_OPTIONS,
  TASK_PRIORITY_OPTIONS,
  STATUS_BAR_COLOR,
  PRIORITY_COLOR,
  createEmptyTask,
} from "../types";
import type { BuilderNode, ProjectMember } from "../../types";
import { NODE_TYPE_LABELS } from "../../types";

// ── shared styles ──────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-500";

const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

// ── priority icon map ──────────────────────────────────────────────────────

const PRIORITY_ICON: Record<TaskPriority, LucideIcon> = {
  no_definida: Minus,
  baja: ChevronDown,
  media: Equal,
  alta: ChevronUp,
  urgente: ChevronsUp,
};

// ── helpers ────────────────────────────────────────────────────────────────

function FieldGroup({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {error && <p className="mt-1 text-[11px] text-rose-500">{error}</p>}
    </div>
  );
}

function StatusIndicator({ status }: { status: TaskStatus }) {
  return (
    <div className={cn("mt-1.5 h-1 w-full rounded-full", STATUS_BAR_COLOR[status])} />
  );
}

// ── component ─────────────────────────────────────────────────────────────

interface TaskDetailFormProps {
  initialTask: Task | null;
  nodes: BuilderNode[];
  members: ProjectMember[];
  onSave: (task: Task, changeReason: string) => void;
  onDelete?: () => void;
  onCancel: () => void;
}

export function TaskDetailForm({
  initialTask,
  nodes,
  members,
  onSave,
  onDelete,
  onCancel,
}: TaskDetailFormProps) {
  const [form, setForm] = useState<Task>(
    () => initialTask ?? createEmptyTask(nodes[0]?.id ?? "")
  );
  const [errors, setErrors] = useState<Partial<Record<keyof Task, string>>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [changeReason, setChangeReason] = useState("");

  const set = <K extends keyof Task>(key: K, value: Task[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {setErrors((prev) => ({ ...prev, [key]: undefined }));}
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof Task, string>> = {};
    if (!form.title.trim()) {errs.title = "El título es obligatorio.";}
    if (!form.node_id) {errs.node_id = "Debes asignar un nodo.";}
    if (form.start_date && form.due_date && form.due_date < form.start_date) {
      errs.due_date = "La fecha fin no puede ser anterior a la de inicio.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {onSave({ ...form, title: form.title.trim() }, changeReason);}
  };

  const PriorityIcon = PRIORITY_ICON[form.priority];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
      {/* Title */}
      <FieldGroup label="Título *" error={errors.title}>
        <input
          type="text"
          value={form.title}
          onChange={(e) => { set("title", e.target.value); }}
          placeholder="Ej: Diseñar pantalla de login"
          className={cn(inputCls, errors.title && "border-rose-400")}
          autoFocus
        />
      </FieldGroup>

      {/* Description */}
      <FieldGroup label="Descripción">
        <textarea
          value={form.description}
          onChange={(e) => { set("description", e.target.value); }}
          placeholder="Descripción detallada de la tarea..."
          rows={3}
          className={cn(inputCls, "resize-none leading-relaxed")}
        />
      </FieldGroup>

      {/* Status + Priority */}
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Estado">
          <select
            value={form.status}
            onChange={(e) => { set("status", e.target.value as TaskStatus); }}
            className={inputCls}
          >
            {TASK_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <StatusIndicator status={form.status} />
        </FieldGroup>

        <FieldGroup label="Prioridad">
          <div className="relative">
            <select
              value={form.priority}
              onChange={(e) => { set("priority", e.target.value as TaskPriority); }}
              className={cn(inputCls, "pl-8")}
            >
              {TASK_PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <PriorityIcon
              className={cn(
                "pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5",
                PRIORITY_COLOR[form.priority]
              )}
            />
          </div>
        </FieldGroup>
      </div>

      {/* Change reason (only for "devuelta") */}
      {form.status === "devuelta" && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-800/50 dark:bg-rose-950/20">
          <FieldGroup label="Motivo de devolución *">
            <textarea
              value={changeReason}
              onChange={(e) => { setChangeReason(e.target.value); }}
              placeholder="Describe el motivo por el que se devuelve la tarea..."
              rows={3}
              className={cn(inputCls, "resize-none leading-relaxed")}
            />
          </FieldGroup>
          <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400">
            Este motivo será visible en el dashboard de trazabilidad.
          </p>
        </div>
      )}

      {/* Node */}
      <FieldGroup label="Nodo *" error={errors.node_id}>
        <select
          value={form.node_id}
          onChange={(e) => { set("node_id", e.target.value); }}
          className={cn(inputCls, errors.node_id && "border-rose-400")}
        >
          <option value="">— Seleccionar nodo —</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              [{NODE_TYPE_LABELS[n.node_type]}] {n.name || "Sin nombre"}
            </option>
          ))}
        </select>
      </FieldGroup>

      {/* Assignee */}
      <FieldGroup label="Responsable">
        <select
          value={form.assignee_id ?? ""}
          onChange={(e) => { set("assignee_id", e.target.value || null); }}
          className={inputCls}
        >
          <option value="">— Sin asignar —</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.role})
            </option>
          ))}
        </select>
      </FieldGroup>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="Fecha inicio">
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => { set("start_date", e.target.value); }}
            className={inputCls}
          />
        </FieldGroup>
        <FieldGroup label="Fecha fin" error={errors.due_date}>
          <input
            type="date"
            value={form.due_date}
            min={form.start_date || undefined}
            onChange={(e) => { set("due_date", e.target.value); }}
            className={cn(inputCls, errors.due_date && "border-rose-400")}
          />
        </FieldGroup>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        {/* Delete */}
        {onDelete && (
          confirmDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-rose-600 dark:text-rose-400">¿Confirmar?</span>
              <button
                type="button"
                onClick={onDelete}
                className="rounded-md bg-rose-50 px-2.5 py-1.5 text-[12px] font-medium text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400"
              >
                Sí, eliminar
              </button>
              <button
                type="button"
                onClick={() => { setConfirmDelete(false); }}
                className="text-[12px] text-slate-400 hover:text-slate-600"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setConfirmDelete(true); }}
              className="flex items-center gap-1 text-[12px] text-slate-400 transition-colors hover:text-rose-500 dark:hover:text-rose-400"
            >
              <Trash2 className="size-3.5" />
              Eliminar
            </button>
          )
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:hover:bg-blue-500"
        >
          {initialTask ? "Guardar cambios" : "Crear tarea"}
        </button>
      </div>
    </form>
  );
}
