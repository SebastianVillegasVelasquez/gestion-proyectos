import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Download,
  File as FileIcon,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  FolderPlus,
  Grid2x2,
  Home,
  List as ListIcon,
  Search,
  Trash2,
  Upload,
  Users2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { getErrorMessage } from "@/utils/get-error-message";
import { filesApi, type ApiProjectFile, type ApiProjectFolder } from "../api/files.api";
import {
  useCreateFolder,
  useDeleteFile,
  useDeleteFolder,
  useProjectFiles,
  useUploadFile,
} from "../hooks/use-project-files";
import { formatFileSize } from "../utils/format-size";
import { FilePreviewModal, type PreviewableFile } from "./FilePreviewModal";

const VIEW_KEY = "files.view";

type ViewMode = "list" | "grid";

function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

/** "12 mar 2026" a partir del ISO del backend. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

/** Icono por tipo de contenido — la pista visual que hace que un archivador se
 *  lea de un vistazo (imagen, hoja de cálculo, PDF…). */
function fileIconFor(contentType: string): { Icon: typeof FileIcon; tint: string } {
  const ct = contentType.toLowerCase();
  if (ct.startsWith("image/")) {
    return { Icon: FileImage, tint: "text-emerald-500" };
  }
  if (ct.startsWith("video/")) {
    return { Icon: FileVideo, tint: "text-fuchsia-500" };
  }
  if (ct.startsWith("audio/")) {
    return { Icon: FileAudio, tint: "text-amber-500" };
  }
  if (ct === "application/pdf") {
    return { Icon: FileText, tint: "text-rose-500" };
  }
  if (
    ct.includes("spreadsheet") ||
    ct.includes("excel") ||
    ct === "text/csv" ||
    ct.includes("ms-excel")
  ) {
    return { Icon: FileSpreadsheet, tint: "text-green-600" };
  }
  if (ct.includes("word") || ct.includes("document") || ct.startsWith("text/")) {
    return { Icon: FileText, tint: "text-blue-500" };
  }
  if (
    ct.includes("zip") ||
    ct.includes("compressed") ||
    ct.includes("tar") ||
    ct.includes("rar") ||
    ct.includes("7z")
  ) {
    return { Icon: FileArchive, tint: "text-orange-500" };
  }
  return { Icon: FileIcon, tint: "text-muted-foreground" };
}

/** Camino RAÍZ→carpeta actual siguiendo `ids` desde `root`. Se corta en el
 *  primer id que ya no existe (una carpeta borrada mientras se navegaba). */
function resolvePath(root: ApiProjectFolder, ids: string[]): ApiProjectFolder[] {
  const chain: ApiProjectFolder[] = [root];
  let node = root;
  for (const id of ids.slice(1)) {
    const next = node.children.find((c) => c.id === id);
    if (!next) {
      break;
    }
    chain.push(next);
    node = next;
  }
  return chain;
}

function countLabel(folder: ApiProjectFolder): string {
  const n = folder.children.length + folder.files.length;
  return n === 0 ? "vacía" : `${String(n)} elemento${n === 1 ? "" : "s"}`;
}

// ── Modal: nueva carpeta ────────────────────────────────────────────────────

function NewFolderDialog({
  parentName,
  pending,
  error,
  onCreate,
  onClose,
}: {
  parentName: string;
  pending: boolean;
  error: string | null;
  onCreate: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Nueva carpeta"
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <FolderPlus className="size-4 text-brand-gold-dark dark:text-brand-gold" />
            Nueva carpeta
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Dentro de <span className="font-medium text-foreground">{parentName}</span>
        </p>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) {
              onCreate(name.trim());
            }
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder="Nombre de la carpeta"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30"
          />
          {error && (
            <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || pending}
              className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-brand-gold-dark disabled:opacity-40"
            >
              {pending ? "Creando…" : "Crear"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Filas / tarjetas ───────────────────────────────────────────────────────

interface RowActions {
  projectId: string;
  canWrite: boolean;
  busy: boolean;
  onOpenFolder: (folder: ApiProjectFolder) => void;
  onPreview: (file: ApiProjectFile) => void;
  onDeleteFolder: (folder: ApiProjectFolder) => void;
  onDeleteFile: (file: ApiProjectFile) => void;
}

function FolderListRow({ folder, actions }: { folder: ApiProjectFolder; actions: RowActions }) {
  return (
    <div className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent/60 sm:grid-cols-[minmax(0,1fr)_140px_120px_80px]">
      <button
        type="button"
        onClick={() => {
          actions.onOpenFolder(folder);
        }}
        className="flex min-w-0 items-center gap-2.5 text-left"
      >
        <Folder className="size-4 shrink-0 fill-brand-gold/20 text-brand-gold" />
        <span className="truncate text-[13px] font-medium text-foreground">{folder.name}</span>
        {folder.team_name && (
          <span className="hidden shrink-0 items-center gap-1 rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-semibold text-brand-teal-dark dark:text-brand-teal sm:inline-flex">
            <Users2 className="size-2.5" /> {folder.team_name}
          </span>
        )}
      </button>
      <span className="hidden text-[12px] text-muted-foreground sm:block">Carpeta</span>
      <span className="hidden text-[12px] text-muted-foreground sm:block">
        {formatDate(folder.created_at)}
      </span>
      <div className="flex items-center justify-end gap-1">
        <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
          {countLabel(folder)}
        </span>
        {actions.canWrite && !folder.is_root && (
          <button
            type="button"
            onClick={() => {
              actions.onDeleteFolder(folder);
            }}
            disabled={actions.busy}
            title="Borrar la carpeta y su contenido"
            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-rose-950/40"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function FileListRow({ file, actions }: { file: ApiProjectFile; actions: RowActions }) {
  const { Icon, tint } = fileIconFor(file.content_type);
  const delivery = file.delivery;
  return (
    <div className="group grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent/60 sm:grid-cols-[minmax(0,1fr)_140px_120px_80px]">
      <button
        type="button"
        onClick={() => {
          actions.onPreview(file);
        }}
        className="flex min-w-0 items-center gap-2.5 text-left"
      >
        <Icon className={cn("size-4 shrink-0", tint)} />
        <span className="truncate text-[13px] text-foreground group-hover:text-brand-gold-dark group-hover:underline dark:group-hover:text-brand-gold">
          {file.name}
        </span>
        {delivery && (
          <span
            title={`Entrega V${String(delivery.version_number)} de «${delivery.task_title}»`}
            className="hidden shrink-0 items-center gap-1 rounded-full bg-brand-gold/15 px-2 py-0.5 text-[10px] font-bold text-brand-gold-dark dark:text-brand-gold sm:inline-flex"
          >
            V{delivery.version_number}
            <span className="max-w-[120px] truncate font-medium opacity-80">
              {delivery.task_title}
            </span>
          </span>
        )}
      </button>
      <span className="hidden truncate text-[12px] text-muted-foreground sm:block">
        {file.uploaded_by_name ?? "—"}
      </span>
      <span className="hidden text-[12px] text-muted-foreground sm:block">
        {formatDate(file.created_at)}
      </span>
      <div className="flex items-center justify-end gap-1">
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {formatFileSize(file.size_bytes)}
        </span>
        <button
          type="button"
          onClick={() => void filesApi.download(actions.projectId, file.id, file.name)}
          title="Descargar"
          className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus:opacity-100 group-hover:opacity-100"
        >
          <Download className="size-3.5" />
        </button>
        {actions.canWrite && (
          <button
            type="button"
            onClick={() => {
              actions.onDeleteFile(file);
            }}
            disabled={actions.busy}
            title="Borrar archivo"
            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 focus:opacity-100 group-hover:opacity-100 dark:hover:bg-rose-950/40"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function FolderCard({ folder, actions }: { folder: ApiProjectFolder; actions: RowActions }) {
  return (
    <button
      type="button"
      onClick={() => {
        actions.onOpenFolder(folder);
      }}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-brand-gold/50 hover:bg-accent/40"
    >
      <Folder className="size-8 fill-brand-gold/20 text-brand-gold" />
      <span className="truncate text-[13px] font-medium text-foreground">{folder.name}</span>
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {folder.team_name ? (
          <>
            <Users2 className="size-3" /> {folder.team_name}
          </>
        ) : (
          countLabel(folder)
        )}
      </span>
    </button>
  );
}

function FileCard({ file, actions }: { file: ApiProjectFile; actions: RowActions }) {
  const { Icon, tint } = fileIconFor(file.content_type);
  return (
    <button
      type="button"
      onClick={() => {
        actions.onPreview(file);
      }}
      className="group flex flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-brand-gold/50 hover:bg-accent/40"
    >
      <Icon className={cn("size-8", tint)} />
      <span className="truncate text-[13px] text-foreground">{file.name}</span>
      <span className="flex items-center justify-between gap-1 text-[11px] text-muted-foreground">
        <span>{formatFileSize(file.size_bytes)}</span>
        {file.delivery && (
          <span className="rounded-full bg-brand-gold/15 px-1.5 font-bold text-brand-gold-dark dark:text-brand-gold">
            V{file.delivery.version_number}
          </span>
        )}
      </span>
    </button>
  );
}

// ── Archivador ─────────────────────────────────────────────────────────────

/**
 * Archivador del proyecto, con una navegación tipo gestor de archivos (Drive):
 * una carpeta a la vez, ruta de migas para volver, y las subcarpetas y los
 * archivos como filas (o cuadrícula) con su propietario, tamaño y fecha.
 *
 * La forma del primer nivel es de diseño: la raíz es del proyecto y solo admite
 * la carpeta de un equipo —una por equipo, la abre quien lo lidera— y a partir
 * de ahí cada equipo organiza lo suyo.
 *
 * Los permisos NO se deducen aquí: cada carpeta llega con su `can_write` ya
 * resuelto por el servidor, así que la vista no puede contradecir a la política.
 */
export function ProjectFilesBrowser({ projectId }: { projectId: string }) {
  const query = useProjectFiles(projectId);
  const createFolder = useCreateFolder(projectId);
  const deleteFolder = useDeleteFolder(projectId);
  const uploadFile = useUploadFile(projectId);
  const deleteFile = useDeleteFile(projectId);

  const inputRef = useRef<HTMLInputElement>(null);
  const [pathIds, setPathIds] = useState<string[]>([]);
  const [view, setView] = useState<ViewMode>(readViewMode);
  const [term, setTerm] = useState("");
  const [preview, setPreview] = useState<PreviewableFile | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<ApiProjectFolder | null>(null);
  const [pendingFileDelete, setPendingFileDelete] = useState<ApiProjectFile | null>(null);

  const root = query.data?.root;

  // Al cargar (o si cambia el proyecto) arrancamos en la raíz.
  useEffect(() => {
    if (root) {
      setPathIds([root.id]);
    }
  }, [root?.id]);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [view]);

  const chain = useMemo(
    () => (root ? resolvePath(root, pathIds.length ? pathIds : [root.id]) : []),
    [root, pathIds],
  );
  const current = chain[chain.length - 1] ?? null;
  const atRoot = chain.length <= 1;

  const busy =
    createFolder.isPending ||
    deleteFolder.isPending ||
    uploadFile.isPending ||
    deleteFile.isPending;

  const opError = useMemo(() => {
    const failed = [createFolder, deleteFolder, uploadFile, deleteFile].find((m) => m.isError);
    return failed ? getErrorMessage(failed.error, "No se pudo completar la operación") : null;
  }, [createFolder, deleteFolder, uploadFile, deleteFile]);

  const q = term.trim().toLowerCase();
  const folders = useMemo(() => {
    const list = current?.children ?? [];
    return [...list]
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [current, q]);
  const files = useMemo(() => {
    const list = current?.files ?? [];
    return [...list]
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [current, q]);

  const canWrite = current?.can_write ?? false;

  const openFolder = (folder: ApiProjectFolder) => {
    setTerm("");
    setPathIds((prev) => [...prev, folder.id]);
  };
  const goTo = (index: number) => {
    setTerm("");
    setPathIds((prev) => prev.slice(0, index + 1));
  };

  const doUpload = (files: FileList | null) => {
    const file = files?.[0];
    if (file && current) {
      uploadFile.mutate({ folderId: current.id, file });
    }
  };

  const actions: RowActions = {
    projectId,
    canWrite,
    busy,
    onOpenFolder: openFolder,
    onPreview: (file) => {
      setPreview({
        projectId,
        fileId: file.id,
        name: file.name,
        contentType: file.content_type,
        sizeBytes: file.size_bytes,
      });
    },
    onDeleteFolder: setPendingFolderDelete,
    onDeleteFile: setPendingFileDelete,
  };

  if (query.isLoading) {
    return <LoadingSkeleton rows={6} />;
  }
  if (query.isError || !query.data || !root || !current) {
    return (
      <ErrorState title="No se pudieron cargar los archivos" onRetry={() => void query.refetch()} />
    );
  }

  const teamsWithoutFolder = query.data.teams_without_folder;
  const empty = folders.length === 0 && files.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {preview && (
        <FilePreviewModal
          file={preview}
          onClose={() => {
            setPreview(null);
          }}
        />
      )}
      {showNewFolder && (
        <NewFolderDialog
          parentName={current.is_root ? "el proyecto" : current.name}
          pending={createFolder.isPending}
          error={
            createFolder.isError
              ? getErrorMessage(createFolder.error, "No se pudo crear la carpeta")
              : null
          }
          onCreate={(name) => {
            createFolder.mutate(
              { name, parent_id: current.id },
              {
                onSuccess: () => {
                  setShowNewFolder(false);
                },
              },
            );
          }}
          onClose={() => {
            setShowNewFolder(false);
          }}
        />
      )}
      {pendingFolderDelete && (
        <ConfirmDialog
          destructive
          title="Borrar carpeta"
          message={`¿Borrar "${pendingFolderDelete.name}" y todo lo que contiene?`}
          confirmLabel="Borrar"
          loading={deleteFolder.isPending}
          onConfirm={() => {
            deleteFolder.mutate(pendingFolderDelete.id, {
              onSuccess: () => {
                setPendingFolderDelete(null);
              },
            });
          }}
          onCancel={() => {
            setPendingFolderDelete(null);
          }}
        />
      )}
      {pendingFileDelete && (
        <ConfirmDialog
          destructive
          title="Borrar archivo"
          message={`¿Borrar "${pendingFileDelete.name}"?`}
          confirmLabel="Borrar"
          loading={deleteFile.isPending}
          onConfirm={() => {
            deleteFile.mutate(pendingFileDelete.id, {
              onSuccess: () => {
                setPendingFileDelete(null);
              },
            });
          }}
          onCancel={() => {
            setPendingFileDelete(null);
          }}
        />
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          doUpload(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Barra: migas + acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Ruta" className="flex min-w-0 flex-1 items-center gap-1 text-[13px]">
          {chain.map((folder, i) => {
            const isLast = i === chain.length - 1;
            return (
              <span key={folder.id} className="flex min-w-0 items-center gap-1">
                {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" />}
                <button
                  type="button"
                  onClick={() => {
                    goTo(i);
                  }}
                  disabled={isLast}
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 transition-colors",
                    isLast
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {i === 0 ? (
                    <>
                      <Home className="size-3.5" />
                      <span className="hidden sm:inline">Archivos del proyecto</span>
                    </>
                  ) : (
                    <span className="max-w-[180px] truncate">{folder.name}</span>
                  )}
                </button>
              </span>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <label className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={term}
              onChange={(e) => {
                setTerm(e.target.value);
              }}
              placeholder="Buscar aquí…"
              className="w-28 bg-transparent text-[13px] outline-none sm:w-40"
            />
          </label>

          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => {
                setView("list");
              }}
              title="Ver como lista"
              className={cn(
                "rounded-md p-1.5 transition-colors",
                view === "list"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <ListIcon className="size-3.5" />
            </button>
            <button
              type="button"
              aria-pressed={view === "grid"}
              onClick={() => {
                setView("grid");
              }}
              title="Ver como cuadrícula"
              className={cn(
                "rounded-md p-1.5 transition-colors",
                view === "grid"
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Grid2x2 className="size-3.5" />
            </button>
          </div>

          {canWrite && (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowNewFolder(true);
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-accent"
              >
                <FolderPlus className="size-3.5" />{" "}
                <span className="hidden sm:inline">Nueva carpeta</span>
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploadFile.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-brand-gold-dark disabled:opacity-50"
              >
                <Upload className="size-3.5" />
                {uploadFile.isPending ? "Subiendo…" : "Subir"}
              </button>
            </>
          )}
        </div>
      </div>

      {opError && (
        <p
          role="alert"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
        >
          {opError}
        </p>
      )}

      {!query.data.sees_whole_project && (
        <p className="rounded-lg border border-border bg-accent/40 px-3 py-2 text-[12px] text-muted-foreground">
          Estás viendo las carpetas de tus equipos. La jerarquía completa del proyecto la ve quien
          lo coordina, lo supervisa o la administración.
        </p>
      )}

      {atRoot && teamsWithoutFolder.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5">
          <span className="text-[12px] text-muted-foreground">Equipos sin carpeta todavía:</span>
          {teamsWithoutFolder.map((team) => (
            <button
              key={team.id}
              type="button"
              disabled={busy}
              onClick={() => {
                createFolder.mutate({ name: team.name, team_id: team.id });
              }}
              className="flex items-center gap-1.5 rounded-lg border border-brand-gold/40 bg-brand-gold/10 px-2.5 py-1 text-[12px] font-semibold text-brand-gold-dark transition-colors hover:bg-brand-gold/20 dark:text-brand-gold"
            >
              <FolderPlus className="size-3.5" /> Crear la de {team.name}
            </button>
          ))}
        </div>
      )}

      {/* Contenido de la carpeta actual */}
      <div
        onDragOver={(e) => {
          if (canWrite) {
            e.preventDefault();
            setDragOver(true);
          }
        }}
        onDragLeave={() => {
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (canWrite) {
            doUpload(e.dataTransfer.files);
          }
        }}
        className={cn(
          "relative min-h-0 flex-1 overflow-y-auto rounded-2xl border border-border bg-card",
          dragOver && "border-brand-gold ring-2 ring-brand-gold/30",
        )}
      >
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-brand-gold/5 text-sm font-semibold text-brand-gold-dark dark:text-brand-gold">
            Suelta el archivo para subirlo a «{current.is_root ? "el proyecto" : current.name}»
          </div>
        )}

        {empty ? (
          <div className="flex h-full items-center justify-center p-8">
            <EmptyState
              icon={Folder}
              title={q ? "Nada coincide con la búsqueda" : "Carpeta vacía"}
              hint={
                q
                  ? "Prueba con otro término."
                  : canWrite
                    ? "Sube un archivo o crea una subcarpeta."
                    : atRoot
                      ? "En la raíz del proyecto solo se crean carpetas de equipo, y las abre su líder o supervisor."
                      : "Todavía no hay nada aquí."
              }
            />
          </div>
        ) : view === "list" ? (
          <div className="p-2">
            <div className="hidden grid-cols-[minmax(0,1fr)_140px_120px_80px] gap-3 border-b border-border px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
              <span>Nombre</span>
              <span>Propietario</span>
              <span>Fecha</span>
              <span className="text-right">Tamaño</span>
            </div>
            {folders.map((folder) => (
              <FolderListRow key={folder.id} folder={folder} actions={actions} />
            ))}
            {files.map((file) => (
              <FileListRow key={file.id} file={file} actions={actions} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {folders.map((folder) => (
              <FolderCard key={folder.id} folder={folder} actions={actions} />
            ))}
            {files.map((file) => (
              <FileCard key={file.id} file={file} actions={actions} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
