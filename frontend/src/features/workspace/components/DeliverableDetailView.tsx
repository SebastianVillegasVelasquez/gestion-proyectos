import { useState, useRef } from "react";
import {
  Link,
  FileText,
  ImageIcon,
  File,
  Upload,
  ExternalLink,
  Plus,
  ChevronDown,
  ChevronRight,
  GitBranch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Deliverable, DeliverableVersion, WorkspaceMember } from "../types";
import { DELIVERABLE_STATUS_LABELS, DELIVERABLE_STATUS_BADGE } from "../types";

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

function detectService(url: string): {
  label: string;
  Icon: React.ElementType;
  color: string;
} {
  const u = url.toLowerCase();
  if (u.includes("figma.com")) {
    return { label: "Figma", Icon: Link, color: "text-pink-500" };
  }
  if (u.includes("github.com")) {
    return { label: "GitHub", Icon: GitBranch, color: "text-slate-700 dark:text-slate-300" };
  }
  if (u.includes("drive.google")) {
    return { label: "Google Drive", Icon: Link, color: "text-blue-500" };
  }
  if (u.includes("notion.so")) {
    return { label: "Notion", Icon: Link, color: "text-slate-800 dark:text-slate-200" };
  }
  return { label: "Enlace externo", Icon: ExternalLink, color: "text-blue-500" };
}

function fileIcon(version: DeliverableVersion) {
  if (version.type === "enlace") {
    const svc = detectService(version.url);
    return { Icon: svc.Icon, color: svc.color };
  }
  const mime = version.mimeType ?? "";
  if (mime.includes("image")) {
    return { Icon: ImageIcon, color: "text-purple-500" };
  }
  if (mime.includes("pdf")) {
    return { Icon: FileText, color: "text-rose-500" };
  }
  if (mime.includes("word") || mime.includes("document")) {
    return { Icon: FileText, color: "text-blue-500" };
  }
  return { Icon: File, color: "text-slate-500" };
}

// ── Version history ────────────────────────────────────────────────────────

function VersionHistory({
  versions,
  members,
}: {
  versions: DeliverableVersion[];
  members: WorkspaceMember[];
}) {
  const [expanded, setExpanded] = useState(true);

  if (versions.length === 0) {
    return null;
  }

  const sorted = [...versions].sort((a, b) => b.versionNumber - a.versionNumber);

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setExpanded((v) => !v);
        }}
        className="flex w-full items-center gap-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
      >
        {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        Historial de versiones ({versions.length})
      </button>

      {expanded && (
        <div className="relative ml-3 mt-2">
          {/* connector line */}
          <div className="absolute left-[13px] top-0 bottom-3 w-px bg-slate-200 dark:bg-slate-700" />

          <div className="flex flex-col gap-3">
            {sorted.map((v, idx) => {
              const uploader = members.find((m) => m.id === v.uploadedBy);
              const isLatest = idx === 0;
              const { Icon, color } = fileIcon(v);
              const svc = v.type === "enlace" ? detectService(v.url) : null;

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
                      <div className="flex items-center gap-1.5">
                        <Icon className={cn("size-3.5 shrink-0", color)} />
                        <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">
                          {v.type === "enlace"
                            ? (svc?.label ?? "Enlace")
                            : (v.fileName ?? "Archivo")}
                        </span>
                        {isLatest && (
                          <span className="rounded-full bg-brand-gold-light px-1.5 py-0.5 text-[9px] font-semibold text-brand-gold-dark dark:bg-brand-gold/15 dark:text-brand-gold">
                            Actual
                          </span>
                        )}
                      </div>

                      {v.url && v.url !== "#" && (
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-500 transition-colors hover:border-brand-gold/40 hover:text-brand-gold-dark"
                        >
                          Abrir <ExternalLink className="size-2.5" />
                        </a>
                      )}
                    </div>

                    {v.note && (
                      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
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

// ── Upload zone ────────────────────────────────────────────────────────────

interface UploadSectionProps {
  onAddVersion: (v: Omit<DeliverableVersion, "id" | "versionNumber">) => void;
  currentVersion: number;
  uploadedBy: string;
}

function UploadSection({ onAddVersion, currentVersion, uploadedBy }: UploadSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [urlNote, setUrlNote] = useState("");
  const [showUrlForm, setShowUrlForm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) {
      return;
    }
    onAddVersion({
      type: "archivo",
      url: "#",
      fileName: file.name,
      mimeType: file.type,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      note: urlNote || `${file.name} subido como V${currentVersion + 1}`,
    });
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    onAddVersion({
      type: "archivo",
      url: "#",
      fileName: file.name,
      mimeType: file.type,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      note: file.name,
    });
    e.target.value = "";
  };

  const handleAddUrl = () => {
    if (!url.trim()) {
      return;
    }
    const svc = detectService(url);
    onAddVersion({
      type: "enlace",
      url: url.trim(),
      uploadedBy,
      uploadedAt: new Date().toISOString(),
      note: urlNote || `${svc.label} — V${currentVersion + 1}`,
    });
    setUrl("");
    setUrlNote("");
    setShowUrlForm(false);
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Subir nueva versión (V{currentVersion + 1})
      </p>

      {/* Drag & Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => {
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
          isDragging
            ? "border-brand-gold bg-brand-gold-light"
            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800/30",
        )}
      >
        <Upload
          className={cn(
            "size-7",
            isDragging ? "text-brand-gold" : "text-slate-300 dark:text-slate-600",
          )}
        />
        <div>
          <p className="text-[13px] font-medium text-slate-600 dark:text-slate-300">
            {isDragging ? "Suelta el archivo aquí" : "Arrastra un archivo"}
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            o haz clic para seleccionar · PDF, DOCX, PNG, ZIP
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={handleFileInput}
          accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.zip"
        />
      </div>

      {/* URL section */}
      {showUrlForm ? (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
            }}
            placeholder="https://figma.com/proto/..."
            autoFocus
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          <input
            type="text"
            value={urlNote}
            onChange={(e) => {
              setUrlNote(e.target.value);
            }}
            placeholder="Nota opcional (ej: prototipo mobile actualizado)"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAddUrl}
              disabled={!url.trim()}
              className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-40"
            >
              Añadir enlace
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUrlForm(false);
                setUrl("");
                setUrlNote("");
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShowUrlForm(true);
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 py-2.5 text-[12px] text-slate-500 transition-colors hover:border-brand-gold/40 hover:text-brand-gold-dark"
        >
          <Plus className="size-3.5" />
          Añadir enlace externo (Figma, GitHub, Drive…)
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

interface DeliverableDetailViewProps {
  deliverable: Deliverable;
  members: WorkspaceMember[];
  currentUserId: string;
  onAddVersion: (v: Omit<DeliverableVersion, "id" | "versionNumber">) => void;
}

export function DeliverableDetailView({
  deliverable,
  members,
  currentUserId,
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
        <VersionHistory versions={deliverable.versions} members={members} />
        <UploadSection
          onAddVersion={onAddVersion}
          currentVersion={deliverable.versions.length}
          uploadedBy={currentUserId}
        />
      </div>
    </div>
  );
}
