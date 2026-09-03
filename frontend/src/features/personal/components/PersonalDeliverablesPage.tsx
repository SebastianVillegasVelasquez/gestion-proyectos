import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, ListTodo, Package, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { useMyDashboardPanels } from "@/features/dashboard/hooks/use-dashboard-summary";
import { EmptyState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { getErrorMessage } from "@/utils/get-error-message";
import { DeliverableList } from "@/features/workspace/components/DeliverableList";
import {
  DeliverableDetailView,
  type EditVersionPatch,
} from "@/features/workspace/components/DeliverableDetailView";
import { FeedbackThread } from "@/features/workspace/components/FeedbackThread";
import { mapDeliverable } from "@/features/workspace/utils/adapters";
import type {
  CommentType,
  Deliverable,
  DeliverableVersion,
  WorkspaceMember,
} from "@/features/workspace/types";
import type { ApiMyTask, ApiPersonalDeliverable } from "../api/personal.api";
import {
  useAddPersonalComment,
  useAddPersonalVersion,
  useCreatePersonalDeliverable,
  useDeletePersonalDeliverable,
  useMyPersonalDeliverables,
  useMyTasks,
  usePersonalReviewQueue,
  useSetPersonalApproval,
  useUpdatePersonalVersion,
  useUploadPersonalVersionFile,
} from "../hooks/use-personal-deliverables";
import { MyTasksView } from "./MyTasksView";

const AVATAR_COLORS = [
  "bg-violet-600",
  "bg-blue-600",
  "bg-emerald-600",
  "bg-amber-500",
  "bg-rose-600",
  "bg-cyan-600",
];

/** Miembros sintéticos para que la lista y el hilo resuelvan nombres/iniciales.
 * En lo personal no hay un equipo del que tirar: basta con "yo" y una etiqueta
 * genérica para el resto de participantes (normalmente un revisor). */
function membersFor(d: ApiPersonalDeliverable, meId: string, meName: string): WorkspaceMember[] {
  const out: WorkspaceMember[] = [];
  const seen = new Set<string>();
  const add = (id: string, name: string) => {
    if (!id || seen.has(id)) {
      return;
    }
    seen.add(id);
    out.push({
      id,
      name,
      initials: name.slice(0, 2).toUpperCase(),
      avatarColor: AVATAR_COLORS[out.length % AVATAR_COLORS.length],
      role: "integrante",
    });
  };
  add(meId, meName || "Yo");
  add(d.assignee_id, "Responsable");
  d.comments.forEach((c) => {
    add(c.author_id, "Participante");
  });
  return out;
}

// ── Modal: nueva entrega personal ───────────────────────────────────────────

function NewPersonalDeliverableModal({
  tasks,
  pending,
  error,
  onCreate,
  onClose,
}: {
  tasks: { id: string; title: string; project_name: string | null }[];
  pending: boolean;
  error: string | null;
  onCreate: (title: string, taskId: string | null, requiresApproval: boolean) => void;
  onClose: () => void;
}) {
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);

  const selectTask = (id: string) => {
    setTaskId(id);
    const t = tasks.find((x) => x.id === id);
    if (t) {
      setTitle(t.title);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">Nueva entrega</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) {
              onCreate(title.trim(), taskId || null, requiresApproval);
            }
          }}
          className="mt-5 space-y-4"
        >
          {tasks.length > 0 && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Tarea individual del proyecto
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
                    {t.project_name ? `${t.project_name} · ` : ""}
                    {t.title}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                Solo tareas asignadas a ti y sin equipo. Al vincularla, aprobar o rechazar mueve su
                estado y queda en la trazabilidad del proyecto.
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
              placeholder="Ej: Informe final — Fase 2"
              autoFocus
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
            <input
              type="checkbox"
              checked={requiresApproval}
              onChange={(e) => {
                setRequiresApproval(e.target.checked);
              }}
              className="mt-0.5 size-4 accent-brand-gold"
            />
            <span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                Requiere revisión
              </span>
              <span className="mt-0.5 block text-[11px] text-slate-400 dark:text-slate-500">
                Si lo activas, la entrega pasa por un responsable del proyecto antes de darse por
                completada. Si no, entregar completa la tarea directo.
              </span>
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          )}

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
              {pending ? "Creando…" : "Crear entrega"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

type Tab = "tareas" | "mias" | "revisar";

export function PersonalDeliverablesPage() {
  const { user } = useAuth();
  const meId = user?.id ?? "";
  const meName = user?.name ?? "Yo";

  const [tab, setTab] = useState<Tab>("tareas");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const mineQuery = useMyPersonalDeliverables();
  const reviewQuery = usePersonalReviewQueue();
  const myTasksQuery = useMyTasks();
  const panelsQuery = useMyDashboardPanels();

  const createDeliverable = useCreatePersonalDeliverable();
  const addVersion = useAddPersonalVersion();
  const uploadVersionFile = useUploadPersonalVersionFile();
  const updateVersion = useUpdatePersonalVersion();
  const deleteDeliverable = useDeletePersonalDeliverable();
  const addComment = useAddPersonalComment();
  const setApproval = useSetPersonalApproval();

  const rawList = useMemo<ApiPersonalDeliverable[]>(
    () => (tab === "mias" ? mineQuery.data : reviewQuery.data) ?? [],
    [tab, mineQuery.data, reviewQuery.data],
  );
  const rawById = useMemo(() => {
    const m = new Map<string, ApiPersonalDeliverable>();
    rawList.forEach((d) => m.set(d.id, d));
    return m;
  }, [rawList]);

  const deliverables: Deliverable[] = useMemo(() => rawList.map(mapDeliverable), [rawList]);
  const selected = deliverables.find((d) => d.id === selectedId) ?? deliverables.at(0) ?? null;
  const selectedRaw = selected ? (rawById.get(selected.id) ?? null) : null;

  const members = useMemo(
    () => (selectedRaw ? membersFor(selectedRaw, meId, meName) : []),
    [selectedRaw, meId, meName],
  );

  // Tareas para el modal de alta: mis tareas abiertas (el backend rechaza las de
  // equipo y las que ya tienen entregable, con un mensaje claro).
  const linkableTasks = useMemo(
    () =>
      (panelsQuery.data?.task_board ?? [])
        .filter((t) => t.status !== "completada" && t.status !== "cancelada")
        .map((t) => ({ id: t.id, title: t.title, project_name: t.project_name })),
    [panelsQuery.data],
  );

  // ids de tareas que ya tienen una entrega personal.
  const deliverableTaskIds = useMemo(
    () =>
      new Set(
        (mineQuery.data ?? []).map((d) => d.task_id).filter((id): id is string => id != null),
      ),
    [mineQuery.data],
  );

  // Desde «Mis tareas»: abrir (o crear) la entrega personal de una tarea
  // individual y saltar a la pestaña de entregas con ella seleccionada.
  const openIndividual = (task: ApiMyTask) => {
    const existing = (mineQuery.data ?? []).find((d) => d.task_id === task.id);
    if (existing) {
      setTab("mias");
      setSelectedId(existing.id);
      return;
    }
    createDeliverable.mutate(
      {
        task_title: task.title,
        task_id: task.id,
        requires_approval: task.requires_approval,
      },
      {
        onSuccess: (d) => {
          setTab("mias");
          setSelectedId(d.id);
        },
      },
    );
  };

  const handleCreate = (title: string, taskId: string | null, requiresApproval: boolean) => {
    createDeliverable.mutate(
      { task_title: title, task_id: taskId, requires_approval: taskId ? requiresApproval : null },
      {
        onSuccess: (d) => {
          setShowNew(false);
          setTab("mias");
          setSelectedId(d.id);
        },
      },
    );
  };

  const handleAddVersion = (v: Omit<DeliverableVersion, "id" | "versionNumber">) => {
    if (!selected) {
      return;
    }
    addVersion.mutate({
      id: selected.id,
      body: {
        type: v.type,
        url: v.url ?? undefined,
        note: v.note,
        observations: v.observations || undefined,
      },
    });
  };

  const handleUploadFile = (file: File, note: string, observations: string) => {
    if (!selected) {
      return;
    }
    uploadVersionFile.mutate({
      id: selected.id,
      body: { file, note, observations: observations || undefined },
    });
  };

  const handleEditVersion = (versionId: string, patch: EditVersionPatch) => {
    if (!selected) {
      return;
    }
    updateVersion.mutate({ id: selected.id, versionId, body: patch });
  };

  const handleReview = (type: CommentType, reason: string) => {
    if (!selected) {
      return;
    }
    addComment.mutate({
      id: selected.id,
      body: { content: reason || "Entrega aprobada.", type, mentions: [] },
    });
  };

  const handleAddComment = (content: string, type: CommentType, mentions: string[]) => {
    if (!selected) {
      return;
    }
    addComment.mutate({ id: selected.id, body: { content, type, mentions } });
  };

  const handleDelete = () => {
    if (!selected) {
      return;
    }
    deleteDeliverable.mutate(selected.id, {
      onSuccess: () => {
        setSelectedId(null);
      },
    });
  };

  const loading =
    (tab === "mias" && mineQuery.isLoading) || (tab === "revisar" && reviewQuery.isLoading);
  const reviewCount = reviewQuery.data?.length ?? 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-[1500px] flex-col gap-4 overflow-hidden p-4 sm:p-6">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold-dark dark:text-brand-gold">
            <Package className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Mis tareas</h1>
            <p className="text-xs text-muted-foreground">
              Todo lo que tienes asignado, con avisos de vencimiento y su entrega.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowNew(true);
          }}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-gold-dark"
        >
          Nueva entrega
        </button>
      </header>

      <div className="flex shrink-0 gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => {
            setTab("tareas");
            setSelectedId(null);
          }}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "tareas"
              ? "border-brand-gold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListTodo className="size-4" /> Mis tareas
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("mias");
            setSelectedId(null);
          }}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "mias"
              ? "border-brand-gold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ClipboardCheck className="size-4" /> Mis entregas
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("revisar");
            setSelectedId(null);
          }}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === "revisar"
              ? "border-brand-gold text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="size-4" /> Para revisar
          {reviewCount > 0 && (
            <span className="rounded-full bg-brand-gold/20 px-1.5 text-[11px] font-bold text-brand-gold-dark dark:text-brand-gold">
              {reviewCount}
            </span>
          )}
        </button>
      </div>

      {tab === "tareas" ? (
        <MyTasksView
          tasks={myTasksQuery.data ?? []}
          loading={myTasksQuery.isLoading}
          deliverableTaskIds={deliverableTaskIds}
          onOpenIndividual={openIndividual}
        />
      ) : loading ? (
        <div className="flex-1">
          <LoadingSkeleton rows={4} />
        </div>
      ) : deliverables.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <EmptyState
            icon={Package}
            title={tab === "mias" ? "Todavía no tienes entregas" : "Nada por revisar"}
            hint={
              tab === "mias"
                ? "Crea una entrega para una de tus tareas individuales."
                : "Aquí aparecen las entregas personales de tareas de proyectos que coordinas o supervisas."
            }
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="w-72 shrink-0 overflow-hidden border-r border-border">
            <DeliverableList
              deliverables={deliverables}
              members={members}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
          </div>

          {selected && selectedRaw ? (
            <>
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-border">
                {selectedRaw.task_id != null && selectedRaw.viewer_is_owner && (
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-accent/30 px-4 py-2.5">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="size-3.5" />
                      {selectedRaw.task_requires_approval
                        ? "Esta entrega pasa por revisión de un responsable del proyecto."
                        : "Al entregar, la tarea se completa directo (sin revisión)."}
                    </span>
                    <button
                      type="button"
                      disabled={setApproval.isPending}
                      onClick={() => {
                        setApproval.mutate({
                          id: selected.id,
                          requiresApproval: !selectedRaw.task_requires_approval,
                        });
                      }}
                      className="rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                    >
                      {selectedRaw.task_requires_approval ? "Quitar revisión" : "Exigir revisión"}
                    </button>
                  </div>
                )}
                <DeliverableDetailView
                  deliverable={selected}
                  members={members}
                  currentUserId={meId}
                  canDeliver={selectedRaw.viewer_is_owner}
                  canReview={selectedRaw.viewer_can_review}
                  reviewPending={addComment.isPending}
                  editPending={updateVersion.isPending}
                  deletePending={deleteDeliverable.isPending}
                  deleteError={
                    deleteDeliverable.isError
                      ? getErrorMessage(deleteDeliverable.error, "No se pudo eliminar")
                      : null
                  }
                  onAddVersion={handleAddVersion}
                  onUploadFile={handleUploadFile}
                  uploadPending={uploadVersionFile.isPending}
                  onEditVersion={handleEditVersion}
                  onReview={handleReview}
                  onDelete={handleDelete}
                />
              </div>
              <div className="flex w-[380px] shrink-0 flex-col overflow-hidden">
                <FeedbackThread
                  comments={selected.comments}
                  members={members}
                  currentUserId={meId}
                  onAddComment={handleAddComment}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              <CheckCircle2 className="mr-2 size-4" /> Selecciona una entrega.
            </div>
          )}
        </div>
      )}

      {showNew && (
        <NewPersonalDeliverableModal
          tasks={linkableTasks}
          pending={createDeliverable.isPending}
          error={
            createDeliverable.isError
              ? getErrorMessage(createDeliverable.error, "No se pudo crear la entrega")
              : null
          }
          onCreate={handleCreate}
          onClose={() => {
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}
