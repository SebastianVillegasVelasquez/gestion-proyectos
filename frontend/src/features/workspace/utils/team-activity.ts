import type { Deliverable, WorkspaceMember } from "../types";

/**
 * Un hecho del equipo, ya resuelto a texto legible.
 *
 * La actividad NO es una tabla nueva: se deriva de lo que ya ocurrió sobre los
 * entregables (entregas y revisiones), que es exactamente lo que la bitácora
 * del equipo debe contar. Guardar una copia en otra tabla sería duplicar la
 * verdad y arriesgar que las dos versiones se contradigan.
 */
export interface TeamActivityEvent {
  id: string;
  text: string;
  /** ISO del momento en que ocurrió, para ordenar y formatear. */
  at: string;
  /** Color del punto en el feed. */
  dot: string;
}

function memberName(members: WorkspaceMember[], id: string): string {
  return members.find((m) => m.id === id)?.name ?? "Alguien";
}

/**
 * Construye el feed a partir de los entregables ya cargados: cada versión es
 * una entrega y cada comentario de revisión es una decisión.
 *
 * @param limit corta el feed para que la tarjeta no crezca sin fin.
 */
export function buildTeamActivity(
  deliverables: Deliverable[],
  members: WorkspaceMember[],
  limit = 12,
): TeamActivityEvent[] {
  const events: TeamActivityEvent[] = [];

  for (const d of deliverables) {
    for (const v of d.versions) {
      events.push({
        id: `v-${v.id}`,
        at: v.uploadedAt,
        dot: "bg-brand-teal",
        text: `${memberName(members, v.uploadedBy)} entregó la V${String(v.versionNumber)} de "${d.taskTitle}"`,
      });
    }

    for (const c of d.comments) {
      const who = memberName(members, c.authorId);
      if (c.type === "aprobacion") {
        events.push({
          id: `c-${c.id}`,
          at: c.createdAt,
          dot: "bg-emerald-500",
          text: `${who} aprobó "${d.taskTitle}"`,
        });
      } else if (c.type === "solicitud_cambio") {
        events.push({
          id: `c-${c.id}`,
          at: c.createdAt,
          dot: "bg-amber-500",
          text: `${who} solicitó cambios en "${d.taskTitle}"`,
        });
      } else if (c.type === "rechazo") {
        events.push({
          id: `c-${c.id}`,
          at: c.createdAt,
          dot: "bg-rose-500",
          text: `${who} rechazó "${d.taskTitle}"`,
        });
      } else {
        events.push({
          id: `c-${c.id}`,
          at: c.createdAt,
          dot: "bg-slate-300 dark:bg-slate-600",
          text: `${who} comentó en "${d.taskTitle}"`,
        });
      }
    }
  }

  // Más reciente primero: la pregunta que responde el feed es "¿qué pasó ahora?".
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return events.slice(0, limit);
}

/** Fecha corta y legible para el feed ("14 mar, 09:30"). */
export function formatActivityDate(iso: string): string {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
