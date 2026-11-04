import { useState } from "react";
import { CalendarCheck, ChevronDown, Mail, Pencil, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import {
  useApplyIncident,
  useDeleteIncident,
  useRevertIncident,
  useUpdateIncident,
} from "../use-incidents";
import type { ProjectIncident } from "../types";
import { RESPONSIBLE_META, formatIncidentDate, pluralDays } from "../utils";
import { HoldToConfirmButton } from "./HoldToConfirmButton";
import { IncidentEvidence } from "./IncidentEvidence";

const holdButtonCls =
  "flex h-8 items-center rounded-lg border px-3 text-xs font-semibold transition-colors max-lg:min-h-[44px]";

/** La respuesta del cliente se completa después: aquí se registra sin abrir el formulario. */
function ClientResponse({ projectId, incident }: { projectId: string; incident: ProjectIncident }) {
  const update = useUpdateIncident(projectId);
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState("");

  if (incident.client_response_date) {
    const days = incident.client_response_days ?? 0;
    return (
      <p className="text-xs text-muted-foreground">
        El cliente respondió el{" "}
        <span className="font-semibold text-foreground">
          {formatIncidentDate(incident.client_response_date)}
        </span>{" "}
        · {days === 0 ? "el mismo día" : `${pluralDays(days)} después`}
      </p>
    );
  }

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => {
          setDate(new Date().toISOString().slice(0, 10));
          setAdding(true);
        }}
        className="self-start text-xs font-medium text-brand-teal-dark underline-offset-2 hover:underline dark:text-brand-teal"
      >
        + Registrar respuesta del cliente
      </button>
    );
  }

  const valid = date !== "" && date >= incident.incident_date;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={date}
        min={incident.incident_date}
        onChange={(event) => {
          setDate(event.target.value);
        }}
        className="rounded-lg border border-border bg-card px-2 py-1 text-xs text-foreground outline-none focus:border-brand-gold"
      />
      <button
        type="button"
        disabled={!valid || update.isPending}
        onClick={() => {
          update.mutate(
            { id: incident.id, payload: { client_response_date: date } },
            {
              onSuccess: () => {
                setAdding(false);
              },
            },
          );
        }}
        className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-50"
      >
        Guardar
      </button>
      <button
        type="button"
        onClick={() => {
          setAdding(false);
        }}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Cancelar
      </button>
      {update.isError && (
        <span className="text-xs text-rose-600 dark:text-rose-400">
          {getErrorMessage(update.error, "No se pudo guardar")}
        </span>
      )}
    </div>
  );
}

/** Aplicar o revertir el atraso en el cronograma; siempre con presión sostenida. */
function ScheduleAction({ projectId, incident }: { projectId: string; incident: ProjectIncident }) {
  const apply = useApplyIncident(projectId);
  const revert = useRevertIncident(projectId);
  const error = apply.error ?? revert.error;

  if (incident.impact_days === 0 && !incident.is_applied) {
    return null;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {incident.is_applied ? (
        <HoldToConfirmButton
          onConfirm={() => {
            revert.mutate(incident.id);
          }}
          disabled={revert.isPending}
          fillClassName="bg-rose-500/25"
          title="Mantén presionado para quitar estos días de la fecha de fin del proyecto"
          className={cn(holdButtonCls, "border-border text-muted-foreground hover:bg-accent")}
        >
          <Undo2 className="size-3.5" />
          {revert.isPending ? "Revirtiendo…" : "Revertir (mantén presionado)"}
        </HoldToConfirmButton>
      ) : (
        <HoldToConfirmButton
          onConfirm={() => {
            apply.mutate(incident.id);
          }}
          disabled={apply.isPending}
          fillClassName="bg-amber-500/35"
          title="Mantén presionado para sumar estos días a la fecha de fin del proyecto"
          className={cn(
            holdButtonCls,
            "border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300",
          )}
        >
          <CalendarCheck className="size-3.5" />
          {apply.isPending
            ? "Reflejando…"
            : `Reflejar +${pluralDays(incident.impact_days)} (mantén presionado)`}
        </HoldToConfirmButton>
      )}
      {error && (
        <p className="max-w-xs text-right text-xs text-rose-600 dark:text-rose-400">
          {getErrorMessage(error, "No se pudo actualizar el cronograma")}
        </p>
      )}
    </div>
  );
}

export function IncidentCard({
  projectId,
  incident,
  onEdit,
}: {
  projectId: string;
  incident: ProjectIncident;
  onEdit: (incident: ProjectIncident) => void;
}) {
  const [showEmail, setShowEmail] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remove = useDeleteIncident(projectId);
  const responsible = RESPONSIBLE_META[incident.responsible];

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-brand-gold/15 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand-gold-dark dark:text-brand-gold">
          {formatIncidentDate(incident.incident_date)}
        </span>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            responsible.className,
          )}
        >
          {responsible.label}
        </span>
        {incident.is_applied && (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            Reflejado en el cronograma
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Editar incidente"
            title="Editar"
            onClick={() => {
              onEdit(incident);
            }}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-lg:size-[44px]"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Borrar incidente"
            title={
              incident.is_applied ? "Revierte el atraso del cronograma para borrarlo" : "Borrar"
            }
            disabled={incident.is_applied}
            onClick={() => {
              setConfirmDelete(true);
            }}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40 max-lg:size-[44px]"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-[15px] font-semibold leading-snug text-foreground">{incident.title}</h3>
        {incident.description && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
            {incident.description}
          </p>
        )}
      </div>

      {incident.email_body && (
        <div className="rounded-xl border border-border bg-accent/30">
          <button
            type="button"
            aria-expanded={showEmail}
            onClick={() => {
              setShowEmail((open) => !open);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-foreground"
          >
            <Mail className="size-3.5 text-brand-teal" /> Correo de respaldo
            <ChevronDown
              className={cn("ml-auto size-3.5 transition-transform", showEmail && "rotate-180")}
            />
          </button>
          {showEmail && (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-border px-3 py-2 font-mono text-xs leading-relaxed text-foreground">
              {incident.email_body}
            </pre>
          )}
        </div>
      )}

      <IncidentEvidence projectId={projectId} incident={incident} />

      <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border/60 pt-3">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">
            Impacto:{" "}
            <span className="font-semibold text-foreground">
              {incident.impact_days === 0 ? "sin atraso" : pluralDays(incident.impact_days)}
            </span>
            {incident.author_name && <> · registrado por {incident.author_name}</>}
          </p>
          <ClientResponse projectId={projectId} incident={incident} />
        </div>
        <ScheduleAction projectId={projectId} incident={incident} />
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Borrar incidente"
          message="Se borrará el incidente y su evidencia de la bitácora. Esta acción no se puede deshacer desde la aplicación."
          confirmLabel="Borrar"
          destructive
          loading={remove.isPending}
          errorMessage={remove.isError ? getErrorMessage(remove.error, "No se pudo borrar") : null}
          onConfirm={() => {
            remove.mutate(incident.id, {
              onSuccess: () => {
                setConfirmDelete(false);
              },
            });
          }}
          onCancel={() => {
            setConfirmDelete(false);
          }}
        />
      )}
    </li>
  );
}
