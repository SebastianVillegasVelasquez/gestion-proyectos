import { useMemo, useState } from "react";
import { Activity, Bell, ShieldAlert, Trash2, UserPlus, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { roleRank } from "@/features/auth/types";
import {
  useChangeTeamMemberRole,
  useDeleteTeam,
  useRemoveTeamMember,
  useUpdateTeam,
} from "@/features/projects/hooks/use-teams";
import type { ApiTeamNotificationSettings, ApiTeamTask } from "../api/workspace.api";
import { useTeamNotifications, useUpdateTeamNotifications } from "../hooks/use-workspace";
import { useTeamInvitations } from "../hooks/use-invitations";
import { InviteMemberModal } from "./InviteMemberModal";
import type { Deliverable, TeamRole, WorkspaceMember } from "../types";
import { TEAM_ROLE_LABELS } from "../types";
import { buildTeamActivity, formatActivityDate } from "../utils/team-activity";
import { workloadBarClass, workloadByMember } from "../utils/team-tasks";

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:disabled:bg-slate-900";

const labelCls =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

const ROLE_ORDER: TeamRole[] = ["lider", "supervisor", "integrante"];

function Card({
  title,
  Icon,
  children,
  tone = "default",
}: {
  title: string;
  Icon: React.ElementType;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-white dark:bg-slate-900",
        tone === "danger"
          ? "border-rose-200 dark:border-rose-900/60"
          : "border-slate-200 dark:border-slate-800",
      )}
    >
      <header
        className={cn(
          "flex items-center gap-2 border-b px-4 py-2.5",
          tone === "danger"
            ? "border-rose-100 text-rose-700 dark:border-rose-900/60 dark:text-rose-400"
            : "border-slate-100 text-slate-600 dark:border-slate-800 dark:text-slate-300",
        )}
      >
        <Icon className="size-4 shrink-0" />
        <h3 className="text-[12px] font-semibold">{title}</h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

// ── Identidad del equipo ────────────────────────────────────────────────────

function TeamIdentityCard({
  projectId,
  teamId,
  name,
  description,
  canManage,
}: {
  projectId: string;
  teamId: string;
  name: string;
  description: string;
  canManage: boolean;
}) {
  const [draftName, setDraftName] = useState(name);
  const [draftDescription, setDraftDescription] = useState(description);
  const update = useUpdateTeam(projectId, teamId);

  const dirty = draftName.trim() !== name || draftDescription.trim() !== description;
  const valid = draftName.trim().length >= 2;

  return (
    <Card title="Identidad del equipo" Icon={Users2}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!dirty || !valid) {
            return;
          }
          update.mutate({
            name: draftName.trim(),
            description: draftDescription.trim() || null,
          });
        }}
      >
        <div>
          <label className={labelCls} htmlFor="team-name">
            Nombre del equipo
          </label>
          <input
            id="team-name"
            type="text"
            value={draftName}
            disabled={!canManage}
            onChange={(e) => {
              setDraftName(e.target.value);
            }}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls} htmlFor="team-description">
            Descripción
          </label>
          <textarea
            id="team-description"
            rows={3}
            value={draftDescription}
            disabled={!canManage}
            onChange={(e) => {
              setDraftDescription(e.target.value);
            }}
            placeholder="¿De qué responde este equipo?"
            className={cn(inputCls, "resize-none")}
          />
        </div>

        {canManage ? (
          <div className="flex items-center justify-end gap-2">
            {update.isError && (
              <p className="flex-1 text-[11px] text-rose-600 dark:text-rose-400">
                {getErrorMessage(update.error, "No se pudieron guardar los cambios.")}
              </p>
            )}
            {!update.isError && update.isSuccess && !dirty && (
              <p className="flex-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                Cambios guardados.
              </p>
            )}
            <button
              type="submit"
              disabled={!dirty || !valid || update.isPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-40"
            >
              {update.isPending ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            Solo un administrador puede renombrar el equipo o editar su descripción.
          </p>
        )}
      </form>
    </Card>
  );
}

// ── Integrantes ─────────────────────────────────────────────────────────────

function MembersCard({
  projectId,
  teamId,
  members,
  tasks,
  canManage,
  canInvite,
}: {
  projectId: string;
  teamId: string;
  members: WorkspaceMember[];
  tasks: ApiTeamTask[];
  /** Cambiar el rol de un integrante o quitarlo del equipo es exclusivo de
   *  administración (admin / super_admin / developer) — mismo criterio que el
   *  backend. El líder ya no gestiona miembros aquí, solo invita. */
  canManage: boolean;
  canInvite: boolean;
}) {
  const [inviting, setInviting] = useState(false);
  const [toRemove, setToRemove] = useState<WorkspaceMember | null>(null);
  const changeRole = useChangeTeamMemberRole(projectId, teamId);
  const removeMember = useRemoveTeamMember(projectId, teamId);
  const invitationsQuery = useTeamInvitations(projectId, teamId, canInvite);
  const pendingInvites = (invitationsQuery.data ?? []).filter((i) => i.status === "pendiente");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const workload = useMemo(
    () =>
      workloadByMember(
        tasks,
        members.map((m) => m.id),
        today,
      ),
    [tasks, members, today],
  );

  // Un equipo sin líder se queda sin quien apruebe: la UI lo impide antes de
  // pedírselo al servidor, para que el error no llegue como sorpresa.
  const leaderCount = members.filter((m) => m.role === "lider").length;
  const isLastLeader = (m: WorkspaceMember) => m.role === "lider" && leaderCount === 1;

  return (
    <>
      <Card title={`Integrantes (${String(members.length)})`} Icon={Users2}>
        {/* La lista crece con el equipo: se le pone techo y scroll propio para
            que las acciones de abajo (invitar, zona de peligro) no se vayan
            fuera de la pantalla en un equipo de veinte personas. */}
        <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
          {members.map((m) => {
            const load = workload[m.id];
            const lastLeader = isLastLeader(m);
            // Solo administración gestiona miembros; para el resto (líder
            // incluido) la fila es de solo lectura.
            const manageThis = canManage;
            return (
              <div
                key={m.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-800"
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
                    m.avatarColor,
                  )}
                >
                  {m.initials}
                </span>

                <div className="min-w-[140px] flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {m.name}
                  </p>
                  {/* Carga relativa al integrante más ocupado (ver utils): el
                      modelo no guarda capacidad por persona, así que un %
                      absoluto sería inventado. */}
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={cn("h-full rounded-full", workloadBarClass(load.pct))}
                        style={{ width: `${String(load.pct)}%` }}
                      />
                    </div>
                    <span
                      title="Carga relativa al integrante más ocupado del equipo"
                      className="text-[10px] tabular-nums text-slate-400 dark:text-slate-500"
                    >
                      {load.openTasks} abierta{load.openTasks === 1 ? "" : "s"}
                      {load.overdueTasks > 0 && (
                        <span className="ml-1 font-semibold text-rose-500">
                          · {load.overdueTasks} vencida{load.overdueTasks === 1 ? "" : "s"}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {manageThis ? (
                  <select
                    aria-label={`Rol de ${m.name} en el equipo`}
                    value={m.role}
                    disabled={changeRole.isPending}
                    onChange={(e) => {
                      changeRole.mutate({
                        userId: m.id,
                        teamRole: e.target.value as TeamRole,
                      });
                    }}
                    className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-600 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {ROLE_ORDER.map((r) => (
                      <option
                        key={r}
                        value={r}
                        // Degradar al único líder dejaría al equipo sin revisor.
                        disabled={lastLeader && r !== "lider"}
                      >
                        {TEAM_ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {TEAM_ROLE_LABELS[m.role]}
                  </span>
                )}

                {manageThis && (
                  <button
                    type="button"
                    disabled={lastLeader}
                    title={
                      lastLeader
                        ? "El equipo debe conservar al menos un líder"
                        : `Quitar a ${m.name} del equipo`
                    }
                    aria-label={`Quitar a ${m.name} del equipo`}
                    onClick={() => {
                      setToRemove(m);
                    }}
                    className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {changeRole.isError && (
          <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400">
            {getErrorMessage(changeRole.error, "No se pudo cambiar el rol.")}
          </p>
        )}

        {canInvite && pendingInvites.length > 0 && (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800/40">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Invitaciones pendientes ({pendingInvites.length})
            </p>
            <ul className="mt-1 flex max-h-40 flex-col gap-1 overflow-y-auto">
              {pendingInvites.map((inv) => (
                <li key={inv.id} className="text-[12px] text-slate-600 dark:text-slate-300">
                  {inv.user_name}
                  <span className="text-slate-400"> · esperando respuesta</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {canInvite && (
          <button
            type="button"
            onClick={() => {
              setInviting(true);
            }}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-[12px] font-medium text-slate-500 transition-colors hover:border-brand-gold hover:text-brand-gold-dark dark:border-slate-700 dark:text-slate-400"
          >
            <UserPlus className="size-3.5" />
            Invitar integrante
          </button>
        )}
      </Card>

      {inviting && (
        <InviteMemberModal
          projectId={projectId}
          teamId={teamId}
          memberUserIds={members.map((m) => m.id)}
          onClose={() => {
            setInviting(false);
          }}
        />
      )}

      {toRemove && (
        <ConfirmDialog
          title="Quitar del equipo"
          message={`${toRemove.name} dejará de ver el espacio de este equipo. Sus tareas y entregas se conservan.`}
          confirmLabel="Quitar"
          destructive
          loading={removeMember.isPending}
          errorMessage={
            removeMember.isError
              ? getErrorMessage(removeMember.error, "No se pudo quitar al integrante.")
              : null
          }
          onCancel={() => {
            setToRemove(null);
          }}
          onConfirm={() => {
            removeMember.mutate(toRemove.id, {
              onSuccess: () => {
                setToRemove(null);
              },
            });
          }}
        />
      )}
    </>
  );
}

// ── Notificaciones ──────────────────────────────────────────────────────────

const NOTIFICATION_ROWS: { key: keyof ApiTeamNotificationSettings; label: string }[] = [
  { key: "nueva_tarea_asignada", label: "Se me asigna una tarea nueva" },
  { key: "entregable_rechazado", label: "Rechazan o devuelven un entregable" },
  { key: "comentario_nuevo", label: "Alguien comenta en un entregable" },
  { key: "entregable_aprobado", label: "Se aprueba un entregable" },
];

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="text-[13px] text-slate-600 dark:text-slate-300">{label}</span>
      {/* Checkbox real (accesible por teclado y lectores de pantalla) escondido
          bajo un track pintado con `peer-*`. */}
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => {
            onChange(e.target.checked);
          }}
        />
        <span className="block h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-primary peer-disabled:opacity-50 dark:bg-slate-700" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 size-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

function NotificationsCard({ teamId, isMember }: { teamId: string; isMember: boolean }) {
  const query = useTeamNotifications(teamId);
  const update = useUpdateTeamNotifications(teamId);
  const settings = query.data;

  return (
    <Card title="Notificaciones del equipo" Icon={Bell}>
      {query.isLoading || !settings ? (
        <p className="py-2 text-[12px] text-slate-400 dark:text-slate-500">Cargando…</p>
      ) : (
        <>
          <p className="mb-1 text-[11px] text-slate-400 dark:text-slate-500">
            Estas preferencias son tuyas y aplican solo a este equipo.
          </p>
          <div className="flex flex-col gap-1.5 rounded-lg bg-slate-50 p-1.5 dark:bg-slate-950/40">
            {NOTIFICATION_ROWS.map((row) => (
              <Toggle
                key={row.key}
                label={row.label}
                checked={settings[row.key]}
                disabled={!isMember || update.isPending}
                onChange={(next) => {
                  update.mutate({ ...settings, [row.key]: next });
                }}
              />
            ))}
          </div>
          {!isMember && (
            <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
              Estás viendo este equipo como administrador; no recibes sus avisos.
            </p>
          )}
          {update.isError && (
            <p className="mt-2 text-[11px] text-rose-600 dark:text-rose-400">
              No se pudo guardar. {getErrorMessage(update.error, "Intenta de nuevo.")}
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// ── Actividad ───────────────────────────────────────────────────────────────

function ActivityCard({
  deliverables,
  members,
}: {
  deliverables: Deliverable[];
  members: WorkspaceMember[];
}) {
  const events = useMemo(() => buildTeamActivity(deliverables, members), [deliverables, members]);

  return (
    <Card title="Actividad reciente" Icon={Activity}>
      {events.length === 0 ? (
        <p className="py-2 text-[12px] text-slate-400 dark:text-slate-500">
          Todavía no hay movimientos en este equipo.
        </p>
      ) : (
        <ol className="relative space-y-3 border-l border-slate-200 pl-4 dark:border-slate-700">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span
                aria-hidden
                className={cn(
                  "absolute -left-[21px] top-1.5 size-2 rounded-full ring-2 ring-white dark:ring-slate-900",
                  e.dot,
                )}
              />
              <p className="text-[12px] leading-snug text-slate-600 dark:text-slate-300">
                {e.text}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {formatActivityDate(e.at)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ── Zona de peligro ─────────────────────────────────────────────────────────

function DangerZoneCard({
  projectId,
  teamId,
  teamName,
  onArchived,
}: {
  projectId: string;
  teamId: string;
  teamName: string;
  onArchived: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const archive = useDeleteTeam(projectId);

  return (
    <>
      <Card title="Zona de peligro" Icon={ShieldAlert} tone="danger">
        <p className="text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
          Archivar retira el equipo del proyecto y su espacio de trabajo deja de estar disponible.
          Las tareas delegadas se conservan y quedan sin equipo asignado.
        </p>
        <button
          type="button"
          onClick={() => {
            setConfirming(true);
          }}
          className="mt-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-[12px] font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/50"
        >
          Archivar equipo
        </button>
      </Card>

      {confirming && (
        <ConfirmDialog
          title={`Archivar "${teamName}"`}
          message="El equipo dejará de aparecer en el proyecto y sus integrantes perderán acceso a este espacio. Las tareas y entregas se conservan."
          confirmLabel="Archivar equipo"
          destructive
          loading={archive.isPending}
          errorMessage={
            archive.isError
              ? getErrorMessage(archive.error, "No se pudo archivar el equipo.")
              : null
          }
          onCancel={() => {
            setConfirming(false);
          }}
          onConfirm={() => {
            archive.mutate(teamId, {
              onSuccess: () => {
                setConfirming(false);
                onArchived();
              },
            });
          }}
        />
      )}
    </>
  );
}

// ── Vista ───────────────────────────────────────────────────────────────────

interface GroupSettingsViewProps {
  projectId: string;
  teamId: string;
  name: string;
  description: string;
  members: WorkspaceMember[];
  tasks: ApiTeamTask[];
  deliverables: Deliverable[];
  /** ¿El usuario actual pertenece al equipo? (el admin puede solo observar) */
  isMember: boolean;
  /** ¿El usuario actual es líder de este equipo? (puede invitar). */
  isLeader: boolean;
  onArchived: () => void;
}

/**
 * Configuración del Grupo. Renombrar el equipo, archivarlo, y ahora también
 * cambiar el rol o quitar a un integrante son de administración
 * (admin / super_admin desde su panel de equipos). El LÍDER del equipo solo
 * puede invitar. Cualquier integrante ajusta sus propios avisos. Son las MISMAS
 * rutas `/projects/{id}/teams/...`, no una copia con permisos propios.
 */
export function GroupSettingsView({
  projectId,
  teamId,
  name,
  description,
  members,
  tasks,
  deliverables,
  isMember,
  isLeader,
  onArchived,
}: GroupSettingsViewProps) {
  const { user } = useAuth();
  // Espejo del `require_role("admin", "super_admin")` del backend: developer
  // tiene rango superior, así que entra por la comparación de rango.
  const canManage = user ? roleRank(user.role) >= roleRank("admin") : false;
  // Invitar es del líder del equipo o de administración (mismo criterio que el
  // backend: líder del equipo O admin).
  const canInvite = canManage || isLeader;

  return (
    // `h-full overflow-y-auto`: la página de configuración es la única sección
    // del espacio que crece hacia abajo sin límite propio (identidad, equipo,
    // avisos, actividad). Sin scroll aquí, lo que no cupiera quedaría recortado
    // por el contenedor del workspace en vez de poder alcanzarse.
    <div className="grid h-full gap-4 overflow-y-auto p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        {/* `key`: al cambiar de equipo queremos un formulario NUEVO, no uno
            sincronizado por efecto. Remontar es la forma que React recomienda
            para reiniciar estado derivado de props. */}
        <TeamIdentityCard
          key={teamId}
          projectId={projectId}
          teamId={teamId}
          name={name}
          description={description}
          canManage={canManage}
        />
        <MembersCard
          projectId={projectId}
          teamId={teamId}
          members={members}
          tasks={tasks}
          canManage={canManage}
          canInvite={canInvite}
        />
        {canManage && (
          <DangerZoneCard
            projectId={projectId}
            teamId={teamId}
            teamName={name}
            onArchived={onArchived}
          />
        )}
      </div>

      <div className="space-y-4">
        <NotificationsCard teamId={teamId} isMember={isMember} />
        <ActivityCard deliverables={deliverables} members={members} />
      </div>
    </div>
  );
}
