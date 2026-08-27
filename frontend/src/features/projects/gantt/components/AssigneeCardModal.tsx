import { CalendarDays, Mail, UsersRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "../../types/labels";
import type { ProjectMember, Task } from "../../types/api.types";

interface Props {
  task: Task;
  /** Integrante del proyecto responsable de la tarea, si lo hay. */
  member: ProjectMember | null;
  /** Nombre del equipo al que está delegada, si lo está. */
  teamName: string | null;
  /** Horas dedicadas / estimadas ya calculadas por la fila. */
  onClose: () => void;
}

function fmt(iso: string | null): string {
  if (!iso) {
    return "sin fecha";
  }
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-xs font-medium text-foreground">{children}</span>
    </div>
  );
}

/**
 * Quién lleva esta tarea, sin salir del cronograma.
 *
 * En el Gantt el responsable se ve como dos iniciales en un círculo; con
 * cincuenta filas eso no basta para saber a quién hay que escribirle. El modal
 * resuelve la pregunta inmediata ("¿quién es AM y cómo lo contacto?") sin
 * navegar a otra pantalla y perder el sitio en el cronograma.
 *
 * Muestra a la PERSONA o al EQUIPO según cómo esté repartida la tarea: el
 * reparto es excluyente, así que nunca hay que enseñar los dos.
 */
export function AssigneeCardModal({ task, member, teamName, onClose }: Props) {
  const fullName = member ? `${member.name} ${member.last_name}` : null;
  const initials = member
    ? (member.name.charAt(0) + member.last_name.charAt(0)).toUpperCase()
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Responsable de la tarea"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card shadow-xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          {member ? (
            <>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-teal-light text-sm font-semibold text-brand-teal-dark dark:bg-brand-teal/15 dark:text-brand-teal">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{fullName}</p>
                <p className="truncate text-xs capitalize text-muted-foreground">
                  {member.position.replace(/_/g, " ")}
                </p>
              </div>
            </>
          ) : teamName ? (
            <>
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300">
                <UsersRound className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{teamName}</p>
                <p className="text-xs text-muted-foreground">
                  Delegada al equipo; su líder la reparte.
                </p>
              </div>
            </>
          ) : (
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Sin responsable</p>
              <p className="text-xs text-muted-foreground">
                Esta tarea todavía no está asignada a nadie.
              </p>
            </div>
          )}
        </div>

        <div className="divide-y divide-border px-5 py-2">
          <Row label="Tarea">{task.title}</Row>
          <Row label="Estado">
            <span
              className={cn("rounded px-1.5 py-0.5 text-[11px]", TASK_STATUS_COLORS[task.status])}
            >
              {TASK_STATUS_LABELS[task.status]}
            </span>
          </Row>
          <Row label="Fechas">
            <span className="inline-flex items-center gap-1 tabular-nums">
              <CalendarDays className="size-3 shrink-0 text-muted-foreground" />
              {fmt(task.start_date)} — {fmt(task.due_date)}
            </span>
          </Row>
          {member && teamName && <Row label="Equipo">{teamName}</Row>}
          {member && (
            <Row label="Contacto">
              <a
                href={`mailto:${member.email}`}
                className="inline-flex items-center gap-1 text-brand-teal hover:underline"
              >
                <Mail className="size-3 shrink-0" />
                {member.email}
              </a>
            </Row>
          )}
        </div>
      </div>
    </div>
  );
}
