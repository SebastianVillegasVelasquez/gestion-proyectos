import { useState, useCallback } from "react";
import { useOutletContext } from "react-router";
import { ClipboardList, Package, Settings, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import type {
  WorkspaceGroup,
  Deliverable,
  DeliverableVersion,
  CommentType,
  DeliverableStatus,
  GroupTask,
} from "../types";
import { GROUP_TASK_STATUS_LABELS, GROUP_TASK_PRIORITY_COLOR } from "../types";
import { MOCK_GROUPS } from "../mockData";
import { WorkspaceHeader } from "./WorkspaceHeader";
import { DeliverableList } from "./DeliverableList";
import { DeliverableDetailView } from "./DeliverableDetailView";
import { FeedbackThread } from "./FeedbackThread";

// ── Tab definitions ───────────────────────────────────────────────────────

type WorkspaceTab = "tareas" | "entregables" | "configuracion";

const TABS: { id: WorkspaceTab; label: string; Icon: React.ElementType }[] = [
  { id: "tareas", label: "Tablero de Tareas", Icon: ClipboardList },
  { id: "entregables", label: "Entregables y Revisiones", Icon: Package },
  { id: "configuracion", label: "Configuración del Grupo", Icon: Settings },
];

// ── Kanban (Tablero tab) ──────────────────────────────────────────────────

const KANBAN_COLS: GroupTask["status"][] = ["por_hacer", "en_progreso", "completado"];

const KANBAN_COL_CLS: Record<GroupTask["status"], string> = {
  por_hacer: "border-t-slate-400",
  en_progreso: "border-t-brand-teal",
  completado: "border-t-emerald-500",
};

function KanbanBoard({ group }: { group: WorkspaceGroup }) {
  return (
    <div className="flex h-full gap-4 overflow-x-auto p-5">
      {KANBAN_COLS.map((col) => {
        const tasks = group.tasks.filter((t) => t.status === col);
        return (
          <div
            key={col}
            className={cn(
              "flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-t-4 border-slate-200 bg-white dark:border-slate-800",
              KANBAN_COL_CLS[col],
            )}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
                {GROUP_TASK_STATUS_LABELS[col]}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {tasks.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 pb-3">
              {tasks.length === 0 && (
                <p className="py-4 text-center text-[11px] text-slate-400 dark:text-slate-500 italic">
                  Vacío
                </p>
              )}
              {tasks.map((task) => {
                const assignee = group.members.find((m) => m.id === task.assigneeId);
                return (
                  <div
                    key={task.id}
                    className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"
                  >
                    <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">
                      {task.title}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          GROUP_TASK_PRIORITY_COLOR[task.priority],
                        )}
                      >
                        {task.priority}
                      </span>
                      {assignee && (
                        <span
                          className={cn(
                            "ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white",
                            assignee.avatarColor,
                          )}
                          title={assignee.name}
                        >
                          {assignee.initials}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Group Settings tab ────────────────────────────────────────────────────

function GroupSettings({ group }: { group: WorkspaceGroup }) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Nombre del grupo
        </label>
        <input
          type="text"
          defaultValue={group.name}
          readOnly
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Descripción
        </label>
        <textarea
          defaultValue={group.description}
          readOnly
          rows={3}
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>
      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Miembros ({group.members.length})
        </p>
        <div className="space-y-2">
          {group.members.map((m) => (
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
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{m.name}</p>
                <p className="text-[11px] capitalize text-slate-400 dark:text-slate-500">
                  {m.role === "lider" ? "Líder del grupo" : "Integrante"}
                </p>
              </div>
              {m.id === group.leaderId && (
                <span className="ml-auto rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                  👑 Líder
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── New Task Modal ────────────────────────────────────────────────────────

interface NewTaskModalProps {
  group: WorkspaceGroup;
  onSave: (task: GroupTask) => void;
  onClose: () => void;
}

function NewTaskModal({ group, onSave, onClose }: NewTaskModalProps) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState(group.members[0]?.id ?? "");
  const [priority, setPriority] = useState<GroupTask["priority"]>("media");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      return;
    }
    onSave({
      id: crypto.randomUUID(),
      title: title.trim(),
      assigneeId,
      status: "por_hacer",
      priority,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
            Nueva tarea de grupo
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
              }}
              placeholder="Ej: Revisar guión del módulo 3"
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
              {group.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Prioridad
            </label>
            <div className="flex gap-2">
              {(["baja", "media", "alta"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPriority(p);
                  }}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-[12px] font-medium capitalize transition-colors",
                    priority === p
                      ? "border-brand-gold bg-brand-gold-light text-brand-gold-dark"
                      : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
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
              disabled={!title.trim()}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-brand-gold-dark disabled:opacity-40"
            >
              Crear tarea
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── No deliverable selected placeholder ───────────────────────────────────

function NoDeliverableSelected() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
        <Package className="size-6 text-slate-400 dark:text-slate-500" />
      </div>
      <p className="font-semibold text-slate-600 dark:text-slate-300">Selecciona un entregable</p>
      <p className="max-w-xs text-sm text-slate-400 dark:text-slate-500">
        Haz clic en un entregable de la izquierda para ver sus versiones y el hilo de
        retroalimentación.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export function WorkspacePage() {
  useOutletContext<AppOutletContext>(); // ensures correct layout context

  const [groups, setGroups] = useState<WorkspaceGroup[]>(MOCK_GROUPS);
  const [selectedGroupId, setSelectedGroupId] = useState(MOCK_GROUPS[0].id);
  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string | null>(
    MOCK_GROUPS[0].deliverables[0]?.id ?? null,
  );
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("entregables");
  const [showNewTask, setShowNewTask] = useState(false);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId)!;
  const currentUserId = selectedGroup.leaderId; // simulate current user = leader

  const selectedDeliverable =
    selectedGroup.deliverables.find((d) => d.id === selectedDeliverableId) ?? null;

  // ── mutations ─────────────────────────────────────────────────────────

  const updateGroup = useCallback(
    (updater: (g: WorkspaceGroup) => WorkspaceGroup) => {
      setGroups((prev) => prev.map((g) => (g.id === selectedGroupId ? updater(g) : g)));
    },
    [selectedGroupId],
  );

  const updateDeliverable = useCallback(
    (delId: string, updater: (d: Deliverable) => Deliverable) => {
      updateGroup((g) => ({
        ...g,
        deliverables: g.deliverables.map((d) => (d.id === delId ? updater(d) : d)),
      }));
    },
    [updateGroup],
  );

  const handleAddVersion = useCallback(
    (version: Omit<DeliverableVersion, "id" | "versionNumber">) => {
      if (!selectedDeliverableId) {
        return;
      }
      updateDeliverable(selectedDeliverableId, (d) => ({
        ...d,
        status: "en_revision",
        versions: [
          ...d.versions,
          { ...version, id: crypto.randomUUID(), versionNumber: d.versions.length + 1 },
        ],
        updatedAt: new Date().toISOString(),
      }));
    },
    [selectedDeliverableId, updateDeliverable],
  );

  const handleAddComment = useCallback(
    (content: string, type: CommentType, mentions: string[]) => {
      if (!selectedDeliverableId) {
        return;
      }
      const statusChange: Partial<Record<CommentType, DeliverableStatus>> = {
        aprobacion: "aprobado",
        solicitud_cambio: "cambios_solicitados",
      };
      updateDeliverable(selectedDeliverableId, (d) => ({
        ...d,
        status: statusChange[type] ?? d.status,
        comments: [
          ...d.comments,
          {
            id: crypto.randomUUID(),
            authorId: currentUserId,
            content,
            createdAt: new Date().toISOString(),
            type,
            mentions,
          },
        ],
        updatedAt: new Date().toISOString(),
      }));
    },
    [selectedDeliverableId, currentUserId, updateDeliverable],
  );

  const handleAddTask = useCallback(
    (task: GroupTask) => {
      updateGroup((g) => ({ ...g, tasks: [...g.tasks, task] }));
      setShowNewTask(false);
    },
    [updateGroup],
  );

  const handleSwitchGroup = (id: string) => {
    setSelectedGroupId(id);
    const group = groups.find((g) => g.id === id);
    setSelectedDeliverableId(group?.deliverables[0]?.id ?? null);
    setActiveTab("entregables");
  };

  // ── render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Group switcher tabs */}
      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              handleSwitchGroup(g.id);
            }}
            className={cn(
              "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-t-md px-4 py-3 text-[13px] font-medium transition-colors",
              g.id === selectedGroupId
                ? "border-b-2 border-brand-gold text-brand-gold"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
            )}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white",
                g.members.find((m) => m.id === g.leaderId)?.avatarColor ?? "bg-slate-400",
              )}
            >
              {g.members.find((m) => m.id === g.leaderId)?.initials ?? "?"}
            </span>
            {g.name}
          </button>
        ))}
      </div>

      {/* Workspace area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-slate-900">
        {/* Header */}
        <WorkspaceHeader
          group={selectedGroup}
          onNewTask={() => {
            setShowNewTask(true);
          }}
        />

        {/* Tab bar */}
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

        {/* Tab content */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* ── Entregables: Master-Detail ── */}
          {activeTab === "entregables" && (
            <>
              {/* Left: deliverable list */}
              <div className="w-80 shrink-0 overflow-hidden border-r border-slate-200 dark:border-slate-800">
                <DeliverableList
                  deliverables={selectedGroup.deliverables}
                  members={selectedGroup.members}
                  selectedId={selectedDeliverableId}
                  onSelect={setSelectedDeliverableId}
                />
              </div>

              {/* Right: detail + thread */}
              {selectedDeliverable ? (
                <div className="flex flex-1 flex-col overflow-hidden">
                  {/* Versions + upload (top half) */}
                  <div className="flex-[0_0_45%] overflow-hidden border-b border-slate-200 dark:border-slate-800">
                    <DeliverableDetailView
                      deliverable={selectedDeliverable}
                      members={selectedGroup.members}
                      currentUserId={currentUserId}
                      onAddVersion={handleAddVersion}
                    />
                  </div>

                  {/* Feedback thread (bottom half) */}
                  <div className="flex-1 overflow-hidden">
                    <FeedbackThread
                      comments={selectedDeliverable.comments}
                      members={selectedGroup.members}
                      leaderId={selectedGroup.leaderId}
                      currentUserId={currentUserId}
                      deliverableStatus={selectedDeliverable.status}
                      onAddComment={handleAddComment}
                    />
                  </div>
                </div>
              ) : (
                <NoDeliverableSelected />
              )}
            </>
          )}

          {/* ── Tablero Kanban ── */}
          {activeTab === "tareas" && (
            <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
              <KanbanBoard group={selectedGroup} />
            </div>
          )}

          {/* ── Configuración ── */}
          {activeTab === "configuracion" && (
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
              <GroupSettings group={selectedGroup} />
            </div>
          )}
        </div>
      </div>

      {/* New Task Modal */}
      {showNewTask && (
        <NewTaskModal
          group={selectedGroup}
          onSave={handleAddTask}
          onClose={() => {
            setShowNewTask(false);
          }}
        />
      )}
    </div>
  );
}
