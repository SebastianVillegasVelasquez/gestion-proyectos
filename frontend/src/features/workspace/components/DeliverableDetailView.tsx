import { useState } from "react";
import { Check, Clock, ExternalLink, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type {
  CommentType,
  Deliverable,
  DeliverableVersion,
  ResourceType,
  WorkspaceMember,
} from "../types";
import { ReviewActions } from "./ReviewActions";
import { DELIVERABLE_STATUS_LABELS, DELIVERABLE_STATUS_BADGE } from "../types";
import {
  RESOURCE_META,
  UPLOADABLE_RESOURCE_TYPES,
  detectResourceType,
  resourceDisplayName,
} from "../utils/resource-types";

/** Campos que se pueden corregir de una entrega ya subida (todos opcionales). */
export interface EditVersionPatch {
  type?: ResourceType;
  url?: string;
  note?: string;
  observations?: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Editar una entrega ya subida ─────────────────────────────────────────────

function VersionEditor({
  version,
  pending,
  onSave,
  onCancel,
}: {
  version: DeliverableVersion;
  pending: boolean;
  onSave: (patch: EditVersionPatch) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<ResourceType>(version.type);
  const [url, setUrl] = useState(version.url === "#" ? "" : version.url);
  const [note, setNote] = useState(version.note);
  const [observations, setObservations] = useState(version.observations);

  const handleSave = () => {
    if (!url.trim()) {
      return;
    }
    onSave({
      type,
      url: url.trim(),
      note: note.trim(),
      observations: observations.trim(),
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Corregir entrega V{version.versionNumber}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {UPLOADABLE_RESOURCE_TYPES.map((rt) => {
          const m = RESOURCE_META[rt];
          const Icon = m.Icon;
          const selected = type === rt;
          return (
            <button
              key={rt}
              type="button"
              onClick={() => {
                setType(rt);
              }}
              className={cn(
                "flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                selected
                  ? "border-brand-gold bg-brand-gold-light text-brand-gold-dark"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400",
              )}
            >
              <Icon className={cn("size-3", selected ? "text-brand-gold-dark" : m.color)} />
              {m.label}
            </button>
          );
        })}
      </div>

      <input
        type="url"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
        }}
        placeholder={RESOURCE_META[type].placeholder}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      />
      <input
        type="text"
        value={note}
        onChange={(e) => {
          setNote(e.target.value);
        }}
        placeholder="Detalles de la entrega"
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      />
      <textarea
        value={observations}
        onChange={(e) => {
          setObservations(e.target.value);
        }}
        rows={2}
        placeholder="Observaciones para el siguiente rol (interno del equipo)"
        className="w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] text-slate-700 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      />

      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <X className="size-3" /> Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!url.trim() || pending}
          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-40"
        >
          <Check className="size-3" /> Guardar
        </button>
      </div>
    </div>
  );
}

// ── Delivery timeline ────────────────────────────────────────────────────────

function DeliveryTimeline({
  versions,
  members,
  onEditVersion,
  editPending = false,
}: {
  versions: DeliverableVersion[];
  members: WorkspaceMember[];
  /** Si se pasa, cada versión ofrece un lápiz para corregirla en el sitio. */
  onEditVersion?: (versionId: string, patch: EditVersionPatch) => void;
  editPending?: boolean;
}) {
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center gap-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        <Clock className="size-3.5" />
        Línea de tiempo de entregas ({versions.length})
      </div>

      {versions.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-[12px] text-slate-400 dark:border-slate-700 dark:text-slate-500">
          Aún no hay entregas. Registra la primera con el recurso correspondiente.
        </p>
      ) : (
        <div className="relative ml-3 mt-3">
          {/* connector line */}
          <div className="absolute left-[13px] top-0 bottom-3 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex flex-col gap-3">
            {sorted.map((v, idx) => {
              const uploader = members.find((m) => m.id === v.uploadedBy);
              const isLatest = idx === 0;
              const meta = RESOURCE_META[v.type];
              const { Icon } = meta;

              return (
                <div key={v.id} className="relative flex items-start gap-3">
                  {/* Version badge circle */}
                  <div
                    className={cn(
                      "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      isLatest
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
                    )}
                  >
                    V{v.versionNumber}
                  </div>

                  {/* Card */}
                  <div
                    className={cn(
                      "flex-1 rounded-lg border p-3",
                      isLatest
                        ? "border-brand-gold/40 bg-brand-gold-light"
                        : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60",
                    )}
                  >
                    {onEditVersion && editingId === v.id ? (
                      <VersionEditor
                        version={v}
                        pending={editPending}
                        onCancel={() => {
                          setEditingId(null);
                        }}
                        onSave={(patch) => {
                          onEditVersion(v.id, patch);
                          setEditingId(null);
                        }}
                      />
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            {/* Resource type chip */}
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                                meta.chip,
                              )}
                            >
                              <Icon className="size-3 shrink-0" />
                              {meta.label}
                            </span>
                            <span className="truncate text-[12px] font-medium text-slate-700 dark:text-slate-200">
                              {resourceDisplayName(v.type, v.url, v.fileName)}
                            </span>
                            {isLatest && (
                              <span className="shrink-0 rounded-full bg-brand-gold-light px-1.5 py-0.5 text-[9px] font-semibold text-brand-gold-dark dark:bg-brand-gold/15 dark:text-brand-gold">
                                Actual
                              </span>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            {onEditVersion && (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(v.id);
                                }}
                                className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition-colors hover:border-brand-gold/40 hover:text-brand-gold-dark dark:border-slate-700"
                              >
                                <Pencil className="size-2.5" /> Editar
                              </button>
                            )}
                            {v.url && v.url !== "#" && (
                              <a
                                href={v.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition-colors hover:border-brand-gold/40 hover:text-brand-gold-dark dark:border-slate-700"
                              >
                                Abrir <ExternalLink className="size-2.5" />
                              </a>
                            )}
                          </div>
                        </div>

                        {v.note && (
                          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                            {v.note}
                          </p>
                        )}

                        {v.observations && (
                          <div className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 dark:border-amber-900/40 dark:bg-amber-950/20">
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                              Interno · para el siguiente rol
                            </span>
                            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                              {v.observations}
                            </p>
                          </div>
                        )}

                        <div className="mt-2 flex items-center gap-1.5">
                          {uploader && (
                            <span
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white",
                                uploader.avatarColor,
                              )}
                            >
                              {uploader.initials}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            {uploader?.name ?? "Desconocido"} · {formatDate(v.uploadedAt)}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Register delivery (URL only — file upload is a future nice-to-have) ───────

interface RegisterDeliveryProps {
  onAddVersion: (v: Omit<DeliverableVersion, "id" | "versionNumber">) => void;
  currentVersion: number;
  uploadedBy: string;
  /** Se llama tras registrar la entrega (para cerrar el modal que lo contiene). */
  onDone?: () => void;
}

function RegisterDelivery({
  onAddVersion,
  currentVersion,
  uploadedBy,
  onDone,
}: RegisterDeliveryProps) {
  const [type, setType] = useState<ResourceType>("enlace");
  const [typeTouchedByUser, setTypeTouchedByUser] = useState(false);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [observations, setObservations] = useState("");

  const handleUrlChange = (value: string) => {
    setUrl(value);
    // Sugerir el tipo automáticamente hasta que el usuario lo elija a mano.
    if (!typeTouchedByUser && value.trim()) {
      setType(detectResourceType(value));
    }
  };

  const handleAdd = () => {
    if (!url.trim()) {
      return;
    }
    onAddVersion({
      type,
      url: url.trim(),
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      note: note.trim() || `${RESOURCE_META[type].label} — V${currentVersion + 1}`,
      observations: observations.trim(),
    });
    setUrl("");
    setNote("");
    setObservations("");
    setTypeTouchedByUser(false);
    setType("enlace");
    onDone?.();
  };

  const meta = RESOURCE_META[type];

  return (
    <div className="space-y-3">
      {/* Resource type selector */}
      <div className="flex flex-wrap gap-2">
        {UPLOADABLE_RESOURCE_TYPES.map((rt) => {
          const m = RESOURCE_META[rt];
          const Icon = m.Icon;
          const selected = type === rt;
          return (
            <button
              key={rt}
              type="button"
              onClick={() => {
                setType(rt);
                setTypeTouchedByUser(true);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-colors",
                selected
                  ? "border-brand-gold bg-brand-gold-light text-brand-gold-dark"
                  : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400",
              )}
            >
              <Icon className={cn("size-3.5", selected ? "text-brand-gold-dark" : m.color)} />
              {m.label}
            </button>
          );
        })}
        {/* Archivo — nice-to-have, aún no disponible */}
        <span
          title="Subida de archivos — próximamente"
          className="flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-2.5 py-1.5 text-[12px] font-medium text-slate-300 dark:border-slate-700 dark:text-slate-600"
        >
          <RESOURCE_META.archivo.Icon className="size-3.5" />
          Archivo
          <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            Pronto
          </span>
        </span>
      </div>

      {/* URL + note */}
      <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
        <input
          type="url"
          value={url}
          onChange={(e) => {
            handleUrlChange(e.target.value);
          }}
          placeholder={meta.placeholder}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
          }}
          placeholder="Detalles de la entrega (ej: prototipo mobile actualizado, incluye estado vacío)"
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
        <textarea
          value={observations}
          onChange={(e) => {
            setObservations(e.target.value);
          }}
          rows={2}
          placeholder="Observaciones para el siguiente rol (ej: falta revisar el minuto 3). Solo lo ve el equipo, nunca el cliente."
          className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-slate-400 dark:text-slate-500">{meta.hint}</p>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!url.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-40"
          >
            <Plus className="size-3.5" />
            Registrar entrega
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface DeliverableDetailViewProps {
  deliverable: Deliverable;
  members: WorkspaceMember[];
  currentUserId: string;
  /** Solo el asignado (o quien entrega) registra entregas; el revisor no. */
  canDeliver?: boolean;
  /** Líder o supervisor del equipo: solo ellos aprueban/devuelven/rechazan. */
  canReview?: boolean;
  /** Hay una decisión de revisión en vuelo (deshabilita el botón). */
  reviewPending?: boolean;
  /** Hay una corrección de versión en vuelo. */
  editPending?: boolean;
  /** Hay un borrado en vuelo. */
  deletePending?: boolean;
  /** Error al borrar (se muestra en el diálogo de confirmación). */
  deleteError?: string | null;
  onAddVersion: (v: Omit<DeliverableVersion, "id" | "versionNumber">) => void;
  /** Corrige una entrega ya subida (no crea versión nueva). Solo si `canDeliver`. */
  onEditVersion?: (versionId: string, patch: EditVersionPatch) => void;
  onReview: (type: CommentType, reason: string) => void;
  /** Borra el entregable. Solo se ofrece a quien lo entregó. */
  onDelete?: () => void;
}

export function DeliverableDetailView({
  deliverable,
  members,
  currentUserId,
  canDeliver = true,
  canReview = false,
  reviewPending = false,
  editPending = false,
  deletePending = false,
  deleteError = null,
  onAddVersion,
  onEditVersion,
  onReview,
  onDelete,
}: DeliverableDetailViewProps) {
  const assignee = members.find((m) => m.id === deliverable.assigneeId);
  const [showRegister, setShowRegister] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // El entregable es de UNA persona: solo quien lo entregó registra o corrige
  // entregas y puede borrarlo. Que el equipo entero pueda "entregar" — sin
  // importar de quién es el trabajo — era justo el hueco que dejaba a
  // cualquier integrante tocar el entregable de otro.
  const isOwner = deliverable.assigneeId === currentUserId;
  const canRegister = canDeliver && isOwner;
  // Una vez aprobado ya movió el avance del proyecto: borrarlo pasa primero
  // por que el líder reabra la revisión, no por un borrado silencioso.
  const canDelete = canRegister && deliverable.status !== "aprobado" && onDelete;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Entregable
          </p>
          <h2 className="mt-0.5 text-base font-bold text-slate-800 dark:text-slate-100">
            {deliverable.taskTitle}
          </h2>
          {deliverable.taskId && (
            <span
              title="Este entregable mueve el estado de una tarea real del proyecto"
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-medium text-brand-teal-dark dark:text-brand-teal"
            >
              <Link2 className="size-2.5" /> Tarea vinculada
            </span>
          )}
          {assignee && (
            <div className="mt-1.5 flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white",
                  assignee.avatarColor,
                )}
              >
                {assignee.initials}
              </span>
              <span className="text-[12px] text-slate-500 dark:text-slate-400">
                {assignee.name}
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              DELIVERABLE_STATUS_BADGE[deliverable.status],
            )}
          >
            {DELIVERABLE_STATUS_LABELS[deliverable.status]}
          </span>
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                setConfirmDelete(true);
              }}
              aria-label="Eliminar entregable"
              title="Eliminar entregable"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cuerpo con scroll: la historia del entregable (qué se entregó y qué
          decidió el revisor). Crece hacia abajo con cada versión. */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <DeliveryTimeline
          versions={deliverable.versions}
          members={members}
          onEditVersion={canRegister ? onEditVersion : undefined}
          editPending={editPending}
        />

        <ReviewActions
          deliverable={deliverable}
          canReview={canReview}
          pending={reviewPending}
          onDecide={onReview}
        />
      </div>

      {/* Registrar entrega: solo un botón anclado abajo. El formulario vive en
          un modal, así el panel no reserva espacio para él cuando no se usa
          (antes dejaba un bloque alto y medio vacío bajo la última versión). */}
      {canRegister && (
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              setShowRegister(true);
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark"
          >
            <Plus className="size-4" />
            Registrar nueva entrega (V{deliverable.versions.length + 1})
          </button>
        </div>
      )}

      {showRegister && (
        <RegisterDeliveryModal
          currentVersion={deliverable.versions.length}
          uploadedBy={currentUserId}
          onAddVersion={onAddVersion}
          onClose={() => {
            setShowRegister(false);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          destructive
          title="Eliminar entregable"
          message={`¿Eliminar "${deliverable.taskTitle}"? Se pierden sus entregas y comentarios.`}
          confirmLabel="Eliminar"
          loading={deletePending}
          errorMessage={deleteError}
          onConfirm={() => {
            onDelete?.();
          }}
          onCancel={() => {
            setConfirmDelete(false);
          }}
        />
      )}
    </div>
  );
}

// ── Modal que envuelve el formulario de registro de entrega ──────────────────

function RegisterDeliveryModal({
  currentVersion,
  uploadedBy,
  onAddVersion,
  onClose,
}: {
  currentVersion: number;
  uploadedBy: string;
  onAddVersion: (v: Omit<DeliverableVersion, "id" | "versionNumber">) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar nueva entrega"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Registrar nueva entrega (V{currentVersion + 1})
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <RegisterDelivery
            onAddVersion={onAddVersion}
            currentVersion={currentVersion}
            uploadedBy={uploadedBy}
            onDone={onClose}
          />
        </div>
      </div>
    </div>
  );
}
