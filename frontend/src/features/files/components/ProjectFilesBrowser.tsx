import { useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  File as FileIcon,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  Trash2,
  Upload,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, LoadingSkeleton } from "@/components/common/AsyncStates";
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

interface FolderActions {
  projectId: string;
  onNewFolder: (parent: ApiProjectFolder) => void;
  onUpload: (folder: ApiProjectFolder) => void;
  onDeleteFolder: (folder: ApiProjectFolder) => void;
  onDeleteFile: (file: ApiProjectFile) => void;
  busy: boolean;
}

function FileRow({ file, actions }: { file: ApiProjectFile; actions: FolderActions }) {
  return (
    <li className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/50">
      <FileIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{file.name}</span>
      <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
        {file.uploaded_by_name ?? "—"}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {formatFileSize(file.size_bytes)}
      </span>
      <button
        type="button"
        onClick={() => void filesApi.download(actions.projectId, file)}
        title="Descargar"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Download className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          actions.onDeleteFile(file);
        }}
        disabled={actions.busy}
        title="Borrar archivo"
        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-950/40"
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}

function FolderNode({
  folder,
  depth,
  actions,
}: {
  folder: ApiProjectFolder;
  depth: number;
  actions: FolderActions;
}) {
  const [open, setOpen] = useState(depth < 2);
  const count = folder.files.length + folder.children.length;

  return (
    <div className={cn(depth > 0 && "ml-4 border-l border-border pl-3")}>
      <div className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-accent/40">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
          }}
          aria-expanded={open}
          className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
        {open ? (
          <FolderOpen className="size-4 shrink-0 text-brand-gold" />
        ) : (
          <FolderClosed className="size-4 shrink-0 text-brand-gold" />
        )}
        <span className="truncate text-[14px] font-medium text-foreground">{folder.name}</span>
        {folder.team_name && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand-teal/10 px-2 py-0.5 text-[11px] font-semibold text-brand-teal-dark dark:text-brand-teal">
            <Users2 className="size-2.5" /> {folder.team_name}
          </span>
        )}
        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{count}</span>

        {folder.can_write && (
          <span className="ml-auto flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              onClick={() => {
                actions.onUpload(folder);
              }}
              disabled={actions.busy}
              title="Subir un archivo aquí"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Upload className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                actions.onNewFolder(folder);
              }}
              title="Nueva carpeta aquí"
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <FolderPlus className="size-3.5" />
            </button>
            {!folder.is_root && (
              <button
                type="button"
                onClick={() => {
                  actions.onDeleteFolder(folder);
                }}
                disabled={actions.busy}
                title="Borrar la carpeta y su contenido"
                className="rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </span>
        )}
      </div>

      {open && (
        <div className="ml-2">
          {folder.children.map((child) => (
            <FolderNode key={child.id} folder={child} depth={depth + 1} actions={actions} />
          ))}
          {folder.files.length > 0 && (
            <ul className="ml-4 flex flex-col border-l border-border pl-3">
              {folder.files.map((file) => (
                <FileRow key={file.id} file={file} actions={actions} />
              ))}
            </ul>
          )}
          {count === 0 && (
            <p className="ml-6 py-1 text-[12px] italic text-muted-foreground">
              {folder.can_write ? "Vacía — sube algo o crea una subcarpeta." : "Vacía."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Archivador del proyecto.
 *
 * La forma del primer nivel es la decisión de diseño: la raíz es del proyecto y
 * solo admite la carpeta de un equipo —una por equipo, la abre quien lo lidera—
 * y a partir de ahí cada equipo organiza lo suyo. Sin esa regla la raíz se
 * convierte en un cajón de sastre en cuestión de semanas.
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

  // Un solo input de archivo reutilizado: se apunta a la carpeta destino justo
  // antes de abrirlo.
  const inputRef = useRef<HTMLInputElement>(null);
  const targetFolder = useRef<string | null>(null);

  const busy =
    createFolder.isPending ||
    deleteFolder.isPending ||
    uploadFile.isPending ||
    deleteFile.isPending;

  const error = useMemo(() => {
    const failed = [createFolder, deleteFolder, uploadFile, deleteFile].find((m) => m.isError);
    return failed ? getErrorMessage(failed.error, "No se pudo completar la operación") : null;
  }, [createFolder, deleteFolder, uploadFile, deleteFile]);

  const actions: FolderActions = {
    projectId,
    busy,
    onUpload: (folder) => {
      targetFolder.current = folder.id;
      inputRef.current?.click();
    },
    onNewFolder: (parent) => {
      const name = window.prompt(`Nueva carpeta dentro de "${parent.name}"`);
      if (name?.trim()) {
        createFolder.mutate({ name: name.trim(), parent_id: parent.id });
      }
    },
    onDeleteFolder: (folder) => {
      if (window.confirm(`¿Borrar "${folder.name}" y todo lo que contiene?`)) {
        deleteFolder.mutate(folder.id);
      }
    },
    onDeleteFile: (file) => {
      if (window.confirm(`¿Borrar "${file.name}"?`)) {
        deleteFile.mutate(file.id);
      }
    },
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const folderId = targetFolder.current;
          if (file && folderId) {
            uploadFile.mutate({ folderId, file });
          }
          // Se limpia para que subir el MISMO archivo dos veces vuelva a
          // disparar el evento `change`.
          e.target.value = "";
        }}
      />

      {query.isLoading ? (
        <LoadingSkeleton rows={5} />
      ) : query.isError ? (
        <ErrorState
          title="No se pudieron cargar los archivos"
          onRetry={() => void query.refetch()}
        />
      ) : !query.data ? null : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300"
            >
              {error}
            </p>
          )}

          {query.data.teams_without_folder.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5">
              <span className="text-[12px] text-muted-foreground">
                Equipos sin carpeta todavía:
              </span>
              {query.data.teams_without_folder.map((team) => (
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

          <div className="rounded-2xl border border-border p-3">
            <FolderNode folder={query.data.root} depth={0} actions={actions} />
          </div>

          {query.data.root.children.length === 0 &&
            query.data.teams_without_folder.length === 0 && (
              <EmptyState
                icon={FolderClosed}
                title="Todavía no hay carpetas"
                hint="En la raíz del proyecto solo se crean carpetas de equipo, y las abre su líder o supervisor."
              />
            )}
        </div>
      )}
    </>
  );
}
