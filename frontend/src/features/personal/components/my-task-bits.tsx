import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, FolderTree, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STATUS_LABELS } from "@/features/projects/types/labels";
import { tipoStyle } from "@/features/projects/utils/tipo-style";
import type { ApiMyTask, ApiWorkItemCrumb } from "../api/personal.api";

/**
 * Miga de pan del origen de la tarea: hasta los `max` últimos elementos de su
 * cadena RAÍZ→elemento, cada chip con el color de su tipo (igual que la
 * Estructura). Sin ancestros = tarea individual.
 */
export function TaskOriginCrumb({
  ancestors,
  max = 3,
}: {
  ancestors: ApiWorkItemCrumb[];
  max?: number;
}) {
  if (ancestors.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <FolderTree className="size-3" /> Individual
      </span>
    );
  }
  const shown = ancestors.slice(-max);
  const clipped = shown.length < ancestors.length;
  return (
    <span
      className="flex flex-wrap items-center gap-1 text-[11px]"
      title={ancestors.map((a) => a.name).join(" › ")}
    >
      {clipped && <span className="text-muted-foreground">…</span>}
      {shown.map((node, i) => {
        const style = tipoStyle(
          node.tipo_id ?? node.id,
          node.tipo_nombre,
          node.es_dependencia_externa,
        );
        return (
          <span key={node.id} className="flex items-center gap-1">
            {i > 0 || clipped ? <span className="text-muted-foreground">›</span> : null}
            <span
              className={cn(
                "inline-flex max-w-[160px] items-center gap-1 truncate rounded px-1.5 py-0.5 font-medium",
                style.chip,
              )}
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", style.dot)} />
              <span className="truncate">{node.name}</span>
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * Etiqueta «Bloqueada» con un panel (hover + clic para fijarlo) que explica por
 * qué no se puede entregar todavía: qué tareas faltan, su estado y quién las
 * tiene.
 */
export function BlockedPopover({ task }: { task: ApiMyTask }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!pinned) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setPinned(false);
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
    };
  }, [pinned]);

  const blockers = task.blocked_by.filter((b) => b.status !== "completada");
  const show = open || pinned;

  return (
    <span
      ref={ref}
      className="relative shrink-0"
      onMouseEnter={() => {
        setOpen(true);
      }}
      onMouseLeave={() => {
        if (!pinned) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        onClick={() => {
          setPinned((v) => !v);
          setOpen(true);
        }}
        aria-expanded={show}
        className="inline-flex cursor-help items-center gap-1 rounded-md border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-800 dark:text-amber-400"
      >
        <Lock className="size-3" /> Bloqueada
      </button>

      {show && (
        <div
          role="tooltip"
          className="absolute right-0 top-full z-30 mt-1 w-72 rounded-lg border border-border bg-card p-3 text-left shadow-xl"
        >
          <p className="mb-2 text-xs font-semibold text-foreground">No puedes entregar todavía</p>
          {blockers.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {blockers.map((b) => (
                <li key={b.id} className="text-[12px] leading-snug">
                  <span className="font-medium text-foreground">{b.title}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {TASK_STATUS_LABELS[b.status]}
                    {" · "}
                    {b.assignee_name ? `la tiene ${b.assignee_name}` : "sin responsable"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              {task.delivery_blocked_reason ??
                "Una dependencia o una actividad de terceros sigue abierta."}
            </p>
          )}
        </div>
      )}
    </span>
  );
}

/**
 * Acción de entrega de una tarea en «Mis tareas», idéntica en la Lista y en la
 * Estructura:
 *  - completada → nada
 *  - de equipo  → enlace al espacio del equipo
 *  - bloqueada  → popover con el porqué
 *  - individual → botón Entregar / Ver entrega
 */
export function MyTaskDeliverAction({
  task,
  isDone,
  hasDeliverable,
  onOpenIndividual,
}: {
  task: ApiMyTask;
  isDone: boolean;
  hasDeliverable: boolean;
  onOpenIndividual: (task: ApiMyTask) => void;
}) {
  if (isDone) {
    return null;
  }
  if (task.team_id) {
    return (
      <Link
        to={`/workspace?team=${task.team_id}`}
        className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
        title={task.delivery_blocked_reason ?? undefined}
      >
        Entregar en el equipo <ArrowUpRight className="inline size-3" />
      </Link>
    );
  }
  if (!hasDeliverable && Boolean(task.delivery_blocked_reason)) {
    return <BlockedPopover task={task} />;
  }
  return (
    <button
      type="button"
      onClick={() => {
        onOpenIndividual(task);
      }}
      className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-brand-gold-dark"
    >
      {hasDeliverable ? "Ver entrega" : "Entregar"}
    </button>
  );
}
