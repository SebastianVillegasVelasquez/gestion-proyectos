import { CalendarClock } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { getErrorMessage } from "@/utils/get-error-message";
import { useApplyPendingIncidents, useProjectIncidents } from "../use-incidents";
import { addDaysToIso, formatIncidentDate, pluralDays, summarizeIncidents } from "../utils";
import { HoldToConfirmButton } from "./HoldToConfirmButton";

/**
 * Refleja en las fechas del proyecto los atrasos documentados en la bitácora.
 *
 * Los incidentes NO mueven el cronograma al registrarse: esa decisión es
 * deliberada y se confirma aquí, manteniendo presionado. El botón aparece solo
 * para administración y solo si hay días pendientes; se usa tanto en el
 * cronograma como en la información general del proyecto.
 */
export function PendingDelayButton({
  projectId,
  endDate,
}: {
  projectId: string;
  endDate: string | null;
}) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(["admin", "super_admin"]);
  const incidentsQuery = useProjectIncidents(projectId, isAdmin);
  const applyPending = useApplyPendingIncidents(projectId);

  const { pendingDays } = summarizeIncidents(incidentsQuery.data ?? []);
  if (!isAdmin || pendingDays === 0) {
    return null;
  }

  const newEnd = endDate ? addDaysToIso(endDate, pendingDays) : null;
  const title = endDate
    ? `Mantén presionado para mover el fin del proyecto del ${formatIncidentDate(endDate)} al ${formatIncidentDate(newEnd ?? endDate)}`
    : "El proyecto no tiene fecha de fin: defínela para poder reflejar el atraso";

  return (
    <div className="flex flex-col items-end gap-1">
      <HoldToConfirmButton
        onConfirm={() => {
          applyPending.mutate(undefined);
        }}
        disabled={!endDate || applyPending.isPending}
        title={title}
        fillClassName="bg-amber-500/35"
        className="flex h-9 items-center rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/15 max-lg:min-h-[44px] dark:text-amber-300"
      >
        <CalendarClock className="size-4" />
        {applyPending.isPending
          ? "Reflejando…"
          : `Reflejar +${pluralDays(pendingDays)} (mantén presionado)`}
      </HoldToConfirmButton>
      {applyPending.isError && (
        <p className="max-w-xs text-right text-xs text-rose-600 dark:text-rose-400">
          {getErrorMessage(applyPending.error, "No se pudo reflejar el atraso")}
        </p>
      )}
    </div>
  );
}
