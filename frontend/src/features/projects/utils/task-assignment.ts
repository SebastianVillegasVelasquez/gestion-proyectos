import type { ProjectMember, Task, Team, TeamMember } from "../types/api.types";

// Quién responde por una tarea y en qué fechas. Vive fuera de los componentes
// porque la MISMA pregunta se hace desde la estructura del proyecto y desde los
// equipos de trabajo: si cada pantalla lo resolviera por su cuenta, acabarían
// contando cosas distintas con las mismas palabras.

/** Nombre visible de una persona (miembro del proyecto o de un equipo). */
export function fullName(person: { name: string; last_name: string }): string {
  return `${person.name} ${person.last_name}`.trim();
}

/** Iniciales para el avatar (dos letras como mucho). */
export function initialsOf(person: { name: string; last_name: string }): string {
  return `${person.name.charAt(0)}${person.last_name.charAt(0)}`.toUpperCase();
}

export function indexById<T>(items: T[], key: (item: T) => string): Map<string, T> {
  return new Map(items.map((item) => [key(item), item]));
}

/** Tipo de asignación de una tarea, para pintarlo de un vistazo:
 *  - "unassigned" sin asignar         - "person" a una persona individual
 *  - "team"       a un equipo (bolsa)  - "member" a un integrante de un equipo
 */
export type AssignmentKind = "unassigned" | "person" | "team" | "member";

export interface TaskAssignment {
  person: ProjectMember | null;
  /** Nombre del responsable, incluso si no es integrante DIRECTO del proyecto
   *  (p. ej. lo es de un equipo): sale de `person` o de `task.assignee_name`.
   *  `null` sólo si la tarea no tiene responsable. */
  assigneeName: string | null;
  team: Team | null;
  kind: AssignmentKind;
  /** Texto corto para chips y listas. Nunca vacío. */
  label: string;
}

/**
 * Resuelve la persona y/o el equipo de una tarea.
 *
 * Las dos pueden coexistir: una tarea delegada a un equipo puede tener además
 * un responsable concreto dentro de él. Cuando no hay ninguna, se dice
 * explícitamente en vez de dejar el hueco en blanco.
 */
export function resolveAssignment(
  task: Task,
  memberById: Map<string, ProjectMember>,
  teamById: Map<string, Team>,
): TaskAssignment {
  const person = task.assignee_id ? (memberById.get(task.assignee_id) ?? null) : null;
  const team = task.team_id ? (teamById.get(task.team_id) ?? null) : null;
  // Nombre real aunque la persona no sea integrante DIRECTO del proyecto: el
  // backend lo resuelve en `assignee_name`. "Responsable externo" queda sólo
  // como último recurso si hay `assignee_id` pero ni persona ni nombre.
  const assigneeName = person
    ? fullName(person)
    : (task.assignee_name ?? (task.assignee_id ? "Responsable externo" : null));

  const parts: string[] = [];
  if (assigneeName) {
    parts.push(assigneeName);
  }
  if (team) {
    parts.push(team.name);
  }

  const hasPerson = person != null || task.assignee_id != null;
  const hasTeam = task.team_id != null;
  const kind: AssignmentKind =
    hasPerson && hasTeam ? "member" : hasTeam ? "team" : hasPerson ? "person" : "unassigned";

  return { person, assigneeName, team, kind, label: parts.join(" · ") || "Sin asignar" };
}

/** ¿Esta tarea le toca a este equipo, ya sea delegada a él o a alguno de los suyos? */
export function tasksOfTeam(tasks: Task[], teamId: string, members: TeamMember[]): Task[] {
  const memberIds = new Set(members.map((m) => m.user_id));
  return tasks.filter(
    (t) => t.team_id === teamId || (t.assignee_id != null && memberIds.has(t.assignee_id)),
  );
}
