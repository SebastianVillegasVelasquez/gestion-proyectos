import { useState } from "react";
import { Clock, ExternalLink, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Deliverable, DeliverableVersion, ResourceType, WorkspaceMember } from "../types";
import { DELIVERABLE_STATUS_LABELS, DELIVERABLE_STATUS_BADGE } from "../types";
import {
  RESOURCE_META,
  UPLOADABLE_RESOURCE_TYPES,
  detectResourceType,
  resourceDisplayName,
} from "../utils/resource-types";

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

// ── Delivery timeline ────────────────────────────────────────────────────────

function DeliveryTimeline({
  versions,
  members,
}: {
  versions: DeliverableVersion[];
  members: WorkspaceMember[];
}) {
  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

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

                      {v.url && v.url !== "#" && (
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition-colors hover:border-brand-gold/40 hover:text-brand-gold-dark dark:border-slate-700"
                        >
                          Abrir <ExternalLink className="size-2.5" />
                        </a>
                      )}
                    </div>

                    {v.note && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {v.note}
                      </p>
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
}

function RegisterDelivery({ onAddVersion, currentVersion, uploadedBy }: RegisterDeliveryProps) {
  const [type, setType] = useState<ResourceType>("enlace");
  const [typeTouchedByUser, setTypeTouchedByUser] = useState(false);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");

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
    });
    setUrl("");
    setNote("");
    setTypeTouchedByUser(false);
    setType("enlace");
  };

  const meta = RESOURCE_META[type];

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Registrar nueva entrega (V{currentVersion + 1})
      </p>

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
  onAddVersion: (v: Omit<DeliverableVersion, "id" | "versionNumber">) => void;
}

export function DeliverableDetailView({
  deliverable,
  members,
  currentUserId,
  canDeliver = true,
  onAddVersion,
}: DeliverableDetailViewProps) {
  const assignee = members.find((m) => m.id === deliverable.assigneeId);

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
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            DELIVERABLE_STATUS_BADGE[deliverable.status],
          )}
        >
          {DELIVERABLE_STATUS_LABELS[deliverable.status]}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <DeliveryTimeline versions={deliverable.versions} members={members} />
        {canDeliver && (
          <RegisterDelivery
            onAddVersion={onAddVersion}
            currentVersion={deliverable.versions.length}
            uploadedBy={currentUserId}
          />
        )}
      </div>
    </div>
  );
}
