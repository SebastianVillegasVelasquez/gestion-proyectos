import { useState } from "react";
import { CheckCircle2, ListPlus, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { useDirectory } from "../../hooks/use-members";
import { useTeams } from "../../hooks/use-teams";
import { useCreateTasksFromBranch } from "../../hooks/use-tasks";
import type { BulkTasksResult, TaskPriority, WorkItemTree } from "../../types/api.types";

type AssignMode = "none" | "person" | "team";

const PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "urgente", label: "Urgente" },
];

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-brand-gold focus:ring-2 focus:ring-brand-gold/20";

/** Cuenta las piezas de la rama para anticipar cuántas tareas van a salir. */
function countBranch(node: WorkItemTree, onlyLeaves: boolean): number {
  const self = !onlyLeaves || node.children.length === 0 ? 1 : 0;
  return node.children.reduce((sum, c) => sum + countBranch(c, onlyLeaves), self);
}

/**
 * Convierte de una vez toda una rama de la estructura en tareas.
 *
 * Montar un proyecto es pasar decenas de piezas del árbol a trabajo asignado.
 * Una por una es el cuello de botella real, y por eso esta pantalla asume el
 * caso frecuente (las piezas, no los agrupadores; sin duplicar lo que ya existe)
 * y deja cambiarlo.
 */
export function BulkTasksFromBranchModal({
  projectId,
  node,
  onClose,
}: {
  projectId: string;
  node: WorkItemTree;
  onClose: () => void;
}) {
  const [onlyLeaves, setOnlyLeaves] = useState(true);
  const [skipWithTasks, setSkipWithTasks] = useState(true);
  const [inheritDates, setInheritDates] = useState(true);
  const [priority, setPriority] = useState<TaskPriority>("media");
  const [assignMode, setAssignMode] = useState<AssignMode>("none");
  const [assigneeId, setAssigneeId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [result, setResult] = useState<BulkTasksResult | null>(null);

  const directoryQuery = useDirectory();
  const teamsQuery = useTeams(projectId);
  const teams = teamsQuery.data?.items ?? [];
  const bulkCreate = useCreateTasksFromBranch(projectId);

  const candidates = countBranch(node, onlyLeaves);

  const handleSubmit = () => {
    bulkCreate.mutate(
      {
        itemId: node.id,
        payload: {
          only_leaves: onlyLeaves,
          skip_with_tasks: skipWithTasks,
          inherit_dates: inheritDates,
          priority,
          assignee_id: assignMode === "person" ? assigneeId || null : null,
          team_id: assignMode === "team" ? teamId || null : null,
        },
      },
      { onSuccess: setResult },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Crear tareas para la rama"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold text-foreground">
            <ListPlus className="size-4 shrink-0 text-brand-teal" />
            <span className="truncate">Crear tareas de «{node.nombre}»</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          {result ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                {result.created.length} tarea{result.created.length !== 1 ? "s" : ""} creada
                {result.created.length !== 1 ? "s" : ""}
              </p>
              {result.skipped.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Sin crear ({result.skipped.length})
                  </p>
                  <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                    {result.skipped.map((s) => (
                      <li key={s.work_item_id} className="flex items-start gap-1.5">
                        <XCircle className="mt-0.5 size-3 shrink-0" />
                        <span>
                          <span className="text-foreground">{s.nombre}</span>: {s.motivo}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Se creará una tarea por cada elemento de esta rama, con el nombre del elemento.
                Ahora mismo son <span className="font-medium text-foreground">{candidates}</span>.
              </p>

              <label className="flex items-start gap-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={onlyLeaves}
                  onChange={(e) => {
                    setOnlyLeaves(e.target.checked);
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-brand-teal"
                />
                <span>
                  Solo los elementos que no contienen nada
                  <span className="block text-xs text-muted-foreground">
                    Los que agrupan (una unidad, un módulo) no generan tarea.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={skipWithTasks}
                  onChange={(e) => {
                    setSkipWithTasks(e.target.checked);
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-brand-teal"
                />
                <span>
                  Saltar los que ya tienen tarea
                  <span className="block text-xs text-muted-foreground">
                    Permite repetir la operación sin duplicar nada.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={inheritDates}
                  onChange={(e) => {
                    setInheritDates(e.target.checked);
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-brand-teal"
                />
                <span>
                  Copiar las fechas de cada elemento
                  <span className="block text-xs text-muted-foreground">
                    Si no, las tareas nacen sin fechas y se planifican después.
                  </span>
                </span>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Prioridad</span>
                <select
                  className={inputCls}
                  value={priority}
                  onChange={(e) => {
                    setPriority(e.target.value as TaskPriority);
                  }}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Responsable</span>
                <div className="flex gap-1 rounded-lg border border-border bg-accent/40 p-1">
                  {(
                    [
                      ["none", "Nadie aún"],
                      ["person", "Una persona"],
                      ["team", "Un equipo"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setAssignMode(mode);
                        setAssigneeId("");
                        setTeamId("");
                      }}
                      aria-pressed={assignMode === mode}
                      className={cn(
                        "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition",
                        assignMode === mode
                          ? "bg-card text-brand-teal-dark shadow-sm dark:text-brand-teal"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {assignMode === "person" && (
                  <select
                    className={inputCls}
                    value={assigneeId}
                    aria-label="Persona responsable"
                    onChange={(e) => {
                      setAssigneeId(e.target.value);
                    }}
                  >
                    <option value="">Selecciona una persona…</option>
                    {directoryQuery.data?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.last_name}
                      </option>
                    ))}
                  </select>
                )}

                {assignMode === "team" && (
                  <select
                    className={inputCls}
                    value={teamId}
                    aria-label="Equipo responsable"
                    onChange={(e) => {
                      setTeamId(e.target.value);
                    }}
                  >
                    <option value="">Selecciona un equipo…</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
                {assignMode === "team" && teams.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    Este proyecto aún no tiene equipos.
                  </span>
                )}
              </div>

              {bulkCreate.isError && (
                <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
                  {getErrorMessage(bulkCreate.error, "No se pudieron crear las tareas")}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent"
          >
            {result ? "Cerrar" : "Cancelar"}
          </button>
          {!result && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={bulkCreate.isPending || candidates === 0}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-60"
            >
              {bulkCreate.isPending ? "Creando…" : `Crear ${String(candidates)} tareas`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
