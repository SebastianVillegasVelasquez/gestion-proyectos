import { useMemo, useState } from "react";
import { useOutletContext } from "react-router";
import { ListTodo, Package, Settings, Settings2, Users2, UsersRound, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { Role } from "@/features/auth/types";
import { TeamsManagementPage } from "@/features/projects/components/teams/TeamsManagementPage";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import type { CommentType, DeliverableVersion, WorkspaceMember } from "../types";
import { TEAM_ROLE_LABELS } from "../types";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { TeamTasksView } from "./TeamTasksView";
import { DeliverableList } from "./DeliverableList";
import { DeliverableDetailView } from "./DeliverableDetailView";
import { FeedbackThread } from "./FeedbackThread";
import { mapDeliverable, mapMember } from "../utils/adapters";
import type { ApiTeamTask } from "../api/workspace.api";
import {
  useAddComment,
  useAddVersion,
  useCreateDeliverable,
  useDeliverables,
  useMyTeams,
  useTeamMembers,
  useTeamTasks,
  useWorkspaceAccess,
} from "../hooks/use-workspace";

type WorkspaceTab = "tareas" | "entregables" | "configuracion";

const TABS: { id: WorkspaceTab; label: string; Icon: React.ElementType }[] = [
  { id: "tareas", label: "Tareas del equipo", Icon: ListTodo },
  { id: "entregables", label: "Entregables y Revisiones", Icon: Package },
  { id: "configuracion", label: "Configuración del Grupo", Icon: Settings },
];

// ── Group settings (datos reales del equipo) ───────────────────────────────

function GroupSettings({
  name,
  description,
  members,
}: {
  name: string;
  description: string;
  members: WorkspaceMember[];
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Nombre del equipo
        </label>
        <input
          type="text"
          defaultValue={name}
          readOnly
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Descripción
        </label>
        <textarea
          defaultValue={description}
          readOnly
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Integrantes ({members.length})
        </p>
        <div className="space-y-2">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white",
                  m.avatarColor,
                )}
              >
                {m.initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{m.name}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {TEAM_ROLE_LABELS[m.role]}
                </p>
              </div>
              {m.role !== "integrante" && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  {TEAM_ROLE_LABELS[m.role]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── New deliverable modal ──────────────────────────────────────────────────

function NewDeliverableModal({
  members,
  tasks,
  pending,
  onCreate,
  onClose,
}: {
  members: WorkspaceMember[];
  // Tareas del equipo abiertas (aún no completadas) para elegir opcionalmente:
  // así el entregable queda enganchado y aprobar/rechazar mueve la tarea real.
  tasks: ApiTeamTask[];
  pending: boolean;
  onCreate: (taskTitle: string, assigneeId: string, taskId: string | null) => void;
  onClose: () => void;
}) {
  const [taskId, setTaskId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(members[0]?.id ?? "");

  // Al elegir una tarea real, autorrellenamos título y responsable. Si el usuario
  // los edita después, respetamos su valor (no sobreescribimos en cada render).
  const selectTask = (id: string) => {
    setTaskId(id);
    const t = tasks.find((x) => x.id === id);
    if (t) {
      setTitle(t.title);
      if (t.assignee_id) {
        setAssigneeId(t.assignee_id);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            Nuevo entregable
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) {
              onCreate(title.trim(), assigneeId, taskId || null);
            }
          }}
          className="mt-5 space-y-4"
        >
          {tasks.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tarea del proyecto
              </label>
              <select
                value={taskId}
                onChange={(e) => {
                  selectTask(e.target.value);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <option value="">Sin vincular (entrega suelta)</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.work_item_name} · {t.title}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Al aprobar o rechazar, se actualiza la tarea vinculada y queda en la trazabilidad
                del proyecto.
              </p>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Título del entregable *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              placeholder="Ej: Prototipo de Interfaz — Módulo 2"
              autoFocus
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Responsable
            </label>
            <select
              value={assigneeId}
              onChange={(e) => {
                setAssigneeId(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim() || pending}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-brand-gold-dark disabled:opacity-40"
            >
              {pending ? "Creando…" : "Crear entregable"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NoDeliverableSelected() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
        <Package className="size-6 text-slate-400 dark:text-slate-500" />
      </div>
      <p className="font-semibold text-slate-600 dark:text-slate-300">Selecciona un entregable</p>
      <p className="max-w-xs text-sm text-slate-400 dark:text-slate-500">
        Elige un entregable de la izquierda para ver su línea de tiempo y el hilo de
        retroalimentación.
      </p>
    </div>
  );
}

// ── Member workspace ─────────────────────────────────────────────────────────
// Experiencia del integrante: sus equipos, entregables y revisiones.

function MemberWorkspace() {
  useOutletContext<AppOutletContext>();
  const { user } = useAuth();
  const currentUserId = user?.id ?? "";

  const teamsQuery = useMyTeams();
  const teams = teamsQuery.data ?? [];

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("tareas");
  const [showNew, setShowNew] = useState(false);

  // El equipo activo: el seleccionado o el primero disponible.
  const activeTeamId = selectedTeamId ?? teams[0]?.id ?? null;
  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;

  const membersQuery = useTeamMembers(activeTeamId);
  const accessQuery = useWorkspaceAccess(activeTeamId);
  const deliverablesQuery = useDeliverables(activeTeamId);
  const tasksQuery = useTeamTasks(activeTeamId);

  const members = (membersQuery.data ?? []).map(mapMember);
  const deliverables = (deliverablesQuery.data ?? []).map(mapDeliverable);
  // Al abrir "Nuevo entregable" solo ofrecemos tareas abiertas y aún NO
  // vinculadas — evita que dos entregables apunten a la misma Task (el
  // backend además rechaza el duplicado con un índice único parcial).
  const linkableTasks = useMemo(() => {
    const linked = new Set((deliverablesQuery.data ?? []).map((d) => d.task_id).filter(Boolean));
    return (tasksQuery.data ?? []).filter(
      (t) => t.status !== "completada" && t.status !== "cancelada" && !linked.has(t.id),
    );
  }, [deliverablesQuery.data, tasksQuery.data]);
  const access = accessQuery.data;
  const canDeliver = access?.can_deliver ?? false;
  const canReview = access?.can_review ?? false;

  const selectedDeliverable =
    deliverables.find((d) => d.id === selectedDeliverableId) ?? deliverables[0] ?? null;

  const createDeliverable = useCreateDeliverable(activeTeamId);
  const addVersion = useAddVersion(activeTeamId);
  const addComment = useAddComment(activeTeamId);

  const handleSwitchTeam = (id: string) => {
    setSelectedTeamId(id);
    setSelectedDeliverableId(null);
    setActiveTab("tareas");
  };

  const handleAddVersion = (version: Omit<DeliverableVersion, "id" | "versionNumber">) => {
    if (!selectedDeliverable) {
      return;
    }
    addVersion.mutate({
      deliverableId: selectedDeliverable.id,
      body: { type: version.type, url: version.url, note: version.note },
    });
  };

  const handleAddComment = (content: string, type: CommentType, mentions: string[]) => {
    if (!selectedDeliverable) {
      return;
    }
    addComment.mutate({ deliverableId: selectedDeliverable.id, body: { content, type, mentions } });
  };

  const handleCreate = (taskTitle: string, assigneeId: string, taskId: string | null) => {
    createDeliverable.mutate(
      { task_title: taskTitle, assignee_id: assigneeId, task_id: taskId },
      {
        onSuccess: (d) => {
          setSelectedDeliverableId(d.id);
          setShowNew(false);
        },
      },
    );
  };

  // ── Estados de carga / vacío ──────────────────────────────────────────────
  if (teamsQuery.isLoading) {
    return (
      <div className="p-6">
        <LoadingSkeleton rows={4} />
      </div>
    );
  }
  if (teamsQuery.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="No se pudieron cargar tus equipos"
          onRetry={() => void teamsQuery.refetch()}
        />
      </div>
    );
  }
  if (teams.length === 0 || !activeTeam) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <EmptyState
          icon={Users2}
          title="No perteneces a ningún equipo de trabajo"
          hint="Cuando un administrador te agregue a un equipo, su espacio aparecerá aquí."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Selector de equipos */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        {teams.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              handleSwitchTeam(t.id);
            }}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-md px-4 py-3 text-[13px] font-medium transition-colors",
              t.id === activeTeam.id
                ? "border-b-2 border-brand-gold text-brand-gold"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            <Users2 className="size-3.5" />
            {t.name}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-900">
        <WorkspaceHeader
          name={activeTeam.name}
          description={activeTeam.description ?? ""}
          members={members}
          canDeliver={canDeliver}
          onNewDeliverable={() => {
            setShowNew(true);
          }}
        />

        {/* Tabs */}
        <div className="flex shrink-0 items-end gap-1 border-b border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-slate-900">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveTab(id);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-t-md px-3 py-2.5 text-[13px] font-medium transition-colors",
                activeTab === id
                  ? "border-b-2 border-brand-gold text-brand-gold"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {activeTab === "tareas" && (
            <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
              <TeamTasksView teamId={activeTeam.id} />
            </div>
          )}

          {activeTab === "entregables" && (
            <>
              <div className="w-72 shrink-0 overflow-hidden border-r border-slate-200 dark:border-slate-800">
                {deliverablesQuery.isLoading ? (
                  <div className="p-4">
                    <LoadingSkeleton rows={3} />
                  </div>
                ) : (
                  <DeliverableList
                    deliverables={deliverables}
                    members={members}
                    selectedId={selectedDeliverable?.id ?? null}
                    onSelect={setSelectedDeliverableId}
                  />
                )}
              </div>

              {selectedDeliverable ? (
                <>
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-slate-200 dark:border-slate-800">
                    <DeliverableDetailView
                      deliverable={selectedDeliverable}
                      members={members}
                      currentUserId={currentUserId}
                      canDeliver={canDeliver}
                      onAddVersion={handleAddVersion}
                    />
                  </div>
                  <div className="flex w-[400px] shrink-0 flex-col overflow-hidden">
                    <FeedbackThread
                      comments={selectedDeliverable.comments}
                      members={members}
                      canReview={canReview}
                      currentUserId={currentUserId}
                      deliverableStatus={selectedDeliverable.status}
                      onAddComment={handleAddComment}
                    />
                  </div>
                </>
              ) : (
                <NoDeliverableSelected />
              )}
            </>
          )}

          {activeTab === "configuracion" && (
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
              <GroupSettings
                name={activeTeam.name}
                description={activeTeam.description ?? ""}
                members={members}
              />
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <NewDeliverableModal
          members={members}
          tasks={linkableTasks}
          pending={createDeliverable.isPending}
          onCreate={handleCreate}
          onClose={() => {
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

// ── Vista con tabs para roles privilegiados ──────────────────────────────────
// Admin/super_admin/developer acceden tanto a la gestión de equipos como a su
// propio espacio de trabajo (pueden pertenecer a equipos como cualquier miembro).

type AdminTab = "gestion" | "mis-equipos";

function AdminWorkspace() {
  const [tab, setTab] = useState<AdminTab>("gestion");
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => {
            setTab("gestion");
          }}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-medium transition-colors",
            tab === "gestion"
              ? "border-brand-gold text-brand-gold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          )}
        >
          <Settings2 className="size-3.5" /> Administrar equipos
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("mis-equipos");
          }}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-[13px] font-medium transition-colors",
            tab === "mis-equipos"
              ? "border-brand-gold text-brand-gold"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          )}
        >
          <UsersRound className="size-3.5" /> Mis equipos
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 flex flex-col">
          {tab === "gestion" ? <TeamsManagementPage /> : <MemberWorkspace />}
        </div>
      </div>
    </div>
  );
}

// ── Dispatcher por rol ───────────────────────────────────────────────────────
// Para administración/developer, /workspace muestra gestión + mis equipos con tabs.
// Para el resto de roles, es su espacio de trabajo personal.

export function WorkspacePage() {
  const { hasRole } = useAuth();
  if (hasRole([Role.ADMIN, Role.SUPER_ADMIN, Role.DEVELOPER])) {
    return <AdminWorkspace />;
  }
  return <MemberWorkspace />;
}
