import { Check, Mail, X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import {
  useAcceptInvitation,
  useMyInvitations,
  useRejectInvitation,
} from "../hooks/use-invitations";

/**
 * Invitaciones pendientes del usuario: un líder lo invitó a su equipo y decide
 * aquí si se une. Aceptar lo convierte en integrante del equipo.
 */
export function MyInvitationsBanner() {
  const query = useMyInvitations("pendiente");
  const accept = useAcceptInvitation();
  const reject = useRejectInvitation();
  const invitations = query.data ?? [];

  if (invitations.length === 0) {
    return null;
  }

  const busy = accept.isPending || reject.isPending;
  const error = accept.error ?? reject.error;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-amber-800 dark:text-amber-300">
        <Mail className="size-4" />
        Tienes {invitations.length} invitación{invitations.length === 1 ? "" : "es"} a equipos
      </div>
      <ul className="mt-2 flex flex-col gap-2">
        {invitations.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-amber-200 bg-white px-3 py-2 dark:border-amber-900/40 dark:bg-slate-900"
          >
            <span className="min-w-0 flex-1 text-[13px] text-slate-700 dark:text-slate-200">
              <span className="font-semibold">{inv.team_name}</span>
              <span className="text-slate-400"> · te invitó {inv.invited_by_name}</span>
            </span>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  accept.mutate(inv.id);
                }}
                className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                <Check className="size-3.5" />
                Aceptar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  reject.mutate(inv.id);
                }}
                className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <X className="size-3.5" />
                Rechazar
              </button>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-1.5 text-[12px] text-rose-600 dark:text-rose-400">
          {getErrorMessage(error, "No se pudo responder la invitación")}
        </p>
      )}
    </div>
  );
}
