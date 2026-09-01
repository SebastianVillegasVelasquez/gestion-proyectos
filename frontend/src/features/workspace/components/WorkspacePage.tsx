import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOutletContext, useSearchParams } from "react-router";
import {
  BarChart3,
  CalendarRange,
  FolderTree,
  ListTodo,
  Package,
  Settings,
  Users2,
  X,
} from "lucide-react";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import { useNodeTypes, useWorkTree } from "@/features/projects/hooks/use-structure";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import type { CommentType, DeliverableVersion } from "../types";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { TeamTasksView } from "./TeamTasksView";
import { DeliverableList } from "./DeliverableList";
import { DeliverableDetailView, type EditVersionPatch } from "./DeliverableDetailView";
import { FeedbackThread } from "./FeedbackThread";
import { GroupSettingsView } from "./GroupSettingsView";
import { MyInvitationsBanner } from "./MyInvitationsBanner";
import { TeamGanttPanel } from "./TeamGanttPanel";
import { TeamProgressView } from "./TeamProgressView";
import { WorkspaceNav } from "./WorkspaceNav";
import { WorkspaceStructureView } from "./WorkspaceStructureView";
import { getErrorMessage } from "@/utils/get-error-message";
import { mapDeliverable, mapMember } from "../utils/adapters";
import type { ApiTeamTask } from "../api/workspace.api";
import {
  useAddComment,
  useAddVersion,
  useCreateDeliverable,
  useDeleteDeliverable,
  useDeliverables,
  useEditVersion,
  useMyTeams,
  useTeamMembers,
  useTeamTasks,
  useWorkspaceAccess,
} from "../hooks/use-workspace";

type WorkspaceTab =
  | "tareas"
  | "entregables"
  | "estructura"
  | "cronograma"
  | "progreso"
  | "configuracion";

// ── New deliverable modal ──────────────────────────────────────────────────

function NewDeliverableModal({
  tasks,
  pending,
  initialTaskId,
  onCreate,
  onClose,
}: {
  // Tareas ABIERTAS y ASIGNADAS A QUIEN ABRE el modal (aún no completadas ni
  // ya con un entregable): solo se entrega lo propio, así que ni la tarea ni
  // el responsable se eligen aquí — el responsable es siempre quien entrega.
  tasks: ApiTeamTask[];
  pending: boolean;
  /** Preselecciona una tarea (atajo "Entregar" desde la vista de estructura). */
  initialTaskId?: string;
  onCreate: (taskTitle: string, taskId: string | null) => void;
  onClose: () => void;
}) {
  const preselected = initialTaskId ? tasks.find((t) => t.id === initialTaskId) : undefined;
  const [taskId, setTaskId] = useState<string>(preselected?.id ?? "");
  const [title, setTitle] = useState(preselected?.title ?? "");

  // Al elegir una tarea real, autorrellenamos el título. Si el usuario lo
  // edita después, respetamos su valor (no sobreescribimos en cada render).
  const selectTask = (id: string) => {
    setTaskId(id);
    const t = tasks.find((x) => x.id === id);
    if (t) {
      setTitle(t.title);
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
              onCreate(title.trim(), taskId || null);
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
                Solo tus tareas asignadas y abiertas. Al aprobar o rechazar, se actualiza la tarea
                vinculada y queda en la trazabilidad del proyecto.
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
  // Al llegar desde "mis proyectos → equipos" el equipo viene en `?team=`.
  const [searchParams] = useSearchParams();

  const teamsQuery = useMyTeams();
  const teams = teamsQuery.data ?? [];

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(searchParams.get("team"));
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("tareas");
  const [showNew, setShowNew] = useState(false);
  // Tarea preseleccionada al abrir el modal desde el atajo "Entregar" de la
  // vista de estructura (fase 3.4). null = alta normal desde "Nuevo entregable".
  const [deliverTaskId, setDeliverTaskId] = useState<string | null>(null);

  // El equipo activo: el seleccionado o el primero disponible.
  const activeTeamId = selectedTeamId ?? teams[0]?.id ?? null;
  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null;

  const membersQuery = useTeamMembers(activeTeamId);
  const accessQuery = useWorkspaceAccess(activeTeamId);
  const deliverablesQuery = useDeliverables(activeTeamId);
  const tasksQuery = useTeamTasks(activeTeamId);
  // Estructura y cronograma del proyecto del equipo (secciones del menú lateral).
  const projectId = activeTeam?.project_id ?? "";
  const treeQuery = useWorkTree(projectId);
  const nodeTypesQuery = useNodeTypes(projectId);
  const typeNameById = useMemo(() => {
    const m = new Map<string, string>();
    (nodeTypesQuery.data ?? []).forEach((t) => m.set(t.id, t.nombre));
    return m;
  }, [nodeTypesQuery.data]);
  const today = new Date().toISOString().slice(0, 10);

  const members = (membersQuery.data ?? []).map(mapMember);
  const deliverables = (deliverablesQuery.data ?? []).map(mapDeliverable);
  // Al abrir "Nuevo entregable" solo ofrecemos MIS tareas (nadie entrega el
  // trabajo de otra persona), abiertas y aún NO vinculadas — evita que dos
  // entregables apunten a la misma Task (el backend además rechaza el
  // duplicado con un índice único parcial).
  const linkableTasks = useMemo(() => {
    const linked = new Set((deliverablesQuery.data ?? []).map((d) => d.task_id).filter(Boolean));
    return (tasksQuery.data ?? []).filter(
      (t) =>
        t.assignee_id === currentUserId &&
        t.status !== "completada" &&
        t.status !== "cancelada" &&
        !linked.has(t.id),
    );
  }, [deliverablesQuery.data, tasksQuery.data, currentUserId]);
  const linkableTaskIds = useMemo(() => new Set(linkableTasks.map((t) => t.id)), [linkableTasks]);
  const access = accessQuery.data;
  const canDeliver = access?.can_deliver ?? false;
  const canReview = access?.can_review ?? false;

  const selectedDeliverable =
    deliverables.find((d) => d.id === selectedDeliverableId) ?? deliverables[0] ?? null;

  const createDeliverable = useCreateDeliverable(activeTeamId);
  const addVersion = useAddVersion(activeTeamId);
  const editVersion = useEditVersion(activeTeamId);
  const addComment = useAddComment(activeTeamId);
  const deleteDeliverable = useDeleteDeliverable(activeTeamId);
  const qc = useQueryClient();
  // Reasignar una tarea desde la estructura toca la caché de tareas del
  // proyecto (lo hace el propio hook), pero no la del workspace: la refrescamos.
  const refreshTeamTasks = () => {
    if (activeTeamId) {
      void qc.invalidateQueries({ queryKey: ["workspace", "tasks", activeTeamId] });
    }
  };

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
      body: {
        type: version.type,
        url: version.url ?? undefined,
        note: version.note,
        observations: version.observations || undefined,
      },
    });
  };

  const handleEditVersion = (versionId: string, patch: EditVersionPatch) => {
    if (!selectedDeliverable) {
      return;
    }
    editVersion.mutate({
      deliverableId: selectedDeliverable.id,
      versionId,
      body: {
        type: patch.type,
        url: patch.url,
        note: patch.note,
        observations: patch.observations,
      },
    });
  };

  const handleDelete = () => {
    if (!selectedDeliverable) {
      return;
    }
    deleteDeliverable.mutate(selectedDeliverable.id, {
      onSuccess: () => {
        setSelectedDeliverableId(null);
      },
    });
  };

  const handleAddComment = (content: string, type: CommentType, mentions: string[]) => {
    if (!selectedDeliverable) {
      return;
    }
    addComment.mutate({ deliverableId: selectedDeliverable.id, body: { content, type, mentions } });
  };

  /**
   * Una decisión de revisión ES un comentario tipado: el motivo queda en el
   * hilo y el backend mueve el estado del entregable y de la tarea vinculada.
   * Aprobar admite motivo vacío, así que ponemos un texto por defecto para no
   * guardar un comentario en blanco.
   */
  const handleReview = (type: CommentType, reason: string) => {
    if (!selectedDeliverable) {
      return;
    }
    addComment.mutate({
      deliverableId: selectedDeliverable.id,
      body: {
        content: reason || "Entregable aprobado.",
        type,
        mentions: [],
      },
    });
  };

  // Al archivar el equipo activo su espacio desaparece: volvemos al primero
  // que quede (`selectedTeamId = null` hace que el efecto tome teams[0]).
  const handleArchived = () => {
    setSelectedTeamId(null);
    setSelectedDeliverableId(null);
    setActiveTab("tareas");
  };

  const handleCreate = (taskTitle: string, taskId: string | null) => {
    createDeliverable.mutate(
      { task_title: taskTitle, assignee_id: currentUserId, task_id: taskId },
      {
        onSuccess: (d) => {
          setSelectedDeliverableId(d.id);
          setShowNew(false);
          setDeliverTaskId(null);
          // El entregable recién creado pasa a la vista de entregables, donde se
          // registra la entrega real (versión).
          setActiveTab("entregables");
        },
      },
    );
  };

  const openDeliverForTask = (taskId: string) => {
    setDeliverTaskId(taskId);
    setShowNew(true);
  };

  // "Entregar sin adjunto": crea un entregable REAL (con una versión de tipo
  // `sin_adjunto`, sin URL) igual que una entrega normal — así el líder lo ve y
  // lo aprueba/devuelve en la pestaña de Entregables, la tarea se mueve por el
  // mismo camino (a revisión, o directo a completada si no exige aprobación) y
  // los avisos se disparan. Antes solo cambiaba el estado de la tarea y no
  // dejaba nada que revisar.
  const markTaskDelivered = (taskId: string) => {
    const task = (tasksQuery.data ?? []).find((t) => t.id === taskId);
    createDeliverable.mutate(
      {
        task_title: task?.title ?? "Entrega sin adjunto",
        assignee_id: currentUserId,
        task_id: taskId,
      },
      {
        onSuccess: (d) => {
          addVersion.mutate(
            { deliverableId: d.id, body: { type: "sin_adjunto" } },
            {
              onSuccess: () => {
                setSelectedDeliverableId(d.id);
                setActiveTab("entregables");
              },
            },
          );
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
      <div className="flex h-full flex-col">
        <MyInvitationsBanner />
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={Users2}
            title="No perteneces a ningún equipo de trabajo"
            hint="Cuando te inviten o te agreguen a un equipo, su espacio aparecerá aquí."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      <MyInvitationsBanner />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Columna principal: cabecera + sección activa, a todo el ancho. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-900">
          <WorkspaceHeader
            name={activeTeam.name}
            description={activeTeam.description ?? ""}
            members={members}
            canDeliver={canDeliver}
            onNewDeliverable={() => {
              setShowNew(true);
            }}
            teams={teams}
            activeTeamId={activeTeam.id}
            onSwitchTeam={handleSwitchTeam}
          />

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {activeTab === "tareas" && (
              <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
                <TeamTasksView
                  teamId={activeTeam.id}
                  projectId={activeTeam.project_id}
                  members={members}
                  teamMembers={membersQuery.data ?? []}
                  onDeliver={
                    canDeliver
                      ? (t) => {
                          openDeliverForTask(t.id);
                        }
                      : undefined
                  }
                  onMarkDelivered={
                    canDeliver
                      ? (t) => {
                          markTaskDelivered(t.id);
                        }
                      : undefined
                  }
                  canDeliverTask={(t) => linkableTaskIds.has(t.id)}
                />
              </div>
            )}

            {activeTab === "estructura" && (
              <div className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 sm:p-6">
                <WorkspaceStructureView
                  tree={treeQuery.data ?? []}
                  tasks={tasksQuery.data ?? []}
                  typeNameById={typeNameById}
                  today={today}
                  projectId={activeTeam.project_id}
                  teamMembers={membersQuery.data ?? []}
                  canReview={canReview}
                  onDeliverTask={
                    canDeliver
                      ? (t) => {
                          openDeliverForTask(t.id);
                        }
                      : undefined
                  }
                  onMarkDeliveredTask={
                    canDeliver
                      ? (t) => {
                          markTaskDelivered(t.id);
                        }
                      : undefined
                  }
                  canDeliverTask={(t) => linkableTaskIds.has(t.id)}
                  onReassigned={refreshTeamTasks}
                />
              </div>
            )}

            {activeTab === "cronograma" && (
              <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
                <TeamGanttPanel projectId={activeTeam.project_id} teamId={activeTeam.id} />
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
                        canReview={canReview}
                        reviewPending={addComment.isPending}
                        editPending={editVersion.isPending}
                        deletePending={deleteDeliverable.isPending}
                        deleteError={
                          deleteDeliverable.isError
                            ? getErrorMessage(
                                deleteDeliverable.error,
                                "No se pudo eliminar el entregable",
                              )
                            : null
                        }
                        onAddVersion={handleAddVersion}
                        onEditVersion={handleEditVersion}
                        onReview={handleReview}
                        onDelete={handleDelete}
                      />
                    </div>
                    <div className="flex w-[400px] shrink-0 flex-col overflow-hidden">
                      <FeedbackThread
                        comments={selectedDeliverable.comments}
                        members={members}
                        currentUserId={currentUserId}
                        onAddComment={handleAddComment}
                      />
                    </div>
                  </>
                ) : (
                  <NoDeliverableSelected />
                )}
              </>
            )}

            {activeTab === "progreso" && (
              <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
                <TeamProgressView
                  tasks={tasksQuery.data ?? []}
                  deliverables={deliverables}
                  teamMembers={membersQuery.data ?? []}
                  today={new Date().toISOString().slice(0, 10)}
                />
              </div>
            )}

            {activeTab === "configuracion" && (
              <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
                <GroupSettingsView
                  projectId={activeTeam.project_id}
                  teamId={activeTeam.id}
                  name={activeTeam.name}
                  description={activeTeam.description ?? ""}
                  members={members}
                  tasks={tasksQuery.data ?? []}
                  deliverables={deliverables}
                  isMember={access?.team_role != null}
                  isLeader={access?.team_role === "lider"}
                  onArchived={handleArchived}
                />
              </div>
            )}
          </div>
        </div>

        {/* Menú lateral derecho: navegación entre secciones (estilo Linear). */}
        <WorkspaceNav
          active={activeTab}
          onSelect={setActiveTab}
          items={[
            { id: "tareas", label: "Tareas", Icon: ListTodo },
            {
              id: "entregables",
              label: "Entregables",
              Icon: Package,
              count: deliverables.length,
            },
            { id: "estructura", label: "Estructura", Icon: FolderTree },
            { id: "cronograma", label: "Cronograma", Icon: CalendarRange },
            { id: "progreso", label: "Progreso", Icon: BarChart3 },
            { id: "configuracion", label: "Configuración", Icon: Settings },
          ]}
        />
      </div>

      {showNew && (
        <NewDeliverableModal
          tasks={linkableTasks}
          pending={createDeliverable.isPending}
          initialTaskId={deliverTaskId ?? undefined}
          onCreate={handleCreate}
          onClose={() => {
            setShowNew(false);
            setDeliverTaskId(null);
          }}
        />
      )}
    </div>
  );
}

// La gestión de equipos ahora vive dentro de cada proyecto (ver
// ProjectTeamsPage); /workspace es únicamente el espacio personal de cada
// usuario, sin importar su rol (admin/super_admin/developer también
// pertenecen a equipos como cualquier integrante).

export function WorkspacePage() {
  return <MemberWorkspace />;
}
