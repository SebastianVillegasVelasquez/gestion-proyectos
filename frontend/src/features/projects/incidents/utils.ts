import type { IncidentResponsible, ProjectIncident } from "./types";

export const RESPONSIBLE_META: Record<IncidentResponsible, { label: string; className: string }> = {
  cliente: {
    label: "Cliente",
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  equipo: {
    label: "Equipo",
    className: "bg-brand-teal/10 text-brand-teal-dark dark:text-brand-teal",
  },
  tercero: {
    label: "Tercero",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
};

export const RESPONSIBLE_ORDER: IncidentResponsible[] = ["cliente", "equipo", "tercero"];

export interface IncidentSummary {
  total: number;
  /** Suma de los días de impacto de todos los incidentes. */
  impactDays: number;
  /** Días que ya se sumaron a la fecha de fin del proyecto. */
  appliedDays: number;
  /** Días que todavía NO se reflejan en el cronograma. */
  pendingDays: number;
  pendingCount: number;
  /** Promedio de días que tardó el cliente en responder (null si nunca respondió). */
  avgClientResponseDays: number | null;
}

export function summarizeIncidents(incidents: readonly ProjectIncident[]): IncidentSummary {
  let impactDays = 0;
  let appliedDays = 0;
  let pendingDays = 0;
  let pendingCount = 0;
  const responses: number[] = [];

  for (const incident of incidents) {
    impactDays += incident.impact_days;
    if (incident.is_applied) {
      appliedDays += incident.applied_days ?? 0;
    } else if (incident.impact_days > 0) {
      pendingDays += incident.impact_days;
      pendingCount += 1;
    }
    if (incident.client_response_days !== null) {
      responses.push(incident.client_response_days);
    }
  }

  return {
    total: incidents.length,
    impactDays,
    appliedDays,
    pendingDays,
    pendingCount,
    avgClientResponseDays:
      responses.length === 0
        ? null
        : Math.round((responses.reduce((a, b) => a + b, 0) / responses.length) * 10) / 10,
  };
}

/** `YYYY-MM-DD` + N días, calculado en UTC para que el horario de verano no
 *  corra la fecha un día. */
export function addDaysToIso(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** `2026-03-10` → `10 mar 2026`. */
export function formatIncidentDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
}

export function pluralDays(days: number): string {
  return `${String(days)} día${days === 1 ? "" : "s"}`;
}
