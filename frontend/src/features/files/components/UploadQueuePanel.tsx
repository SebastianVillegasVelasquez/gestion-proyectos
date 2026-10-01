import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/utils/get-error-message";
import { filesApi } from "../api/files.api";
import { formatFileSize } from "../utils/format-size";
import { projectFilesKey } from "../hooks/use-project-files";

interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
}

const CONCURRENCY = 3;

/**
 * Cola de subida con tope de concurrencia: lanzar los N archivos de una
 * entrega grande a la vez satura la conexión y hace que todos avancen a paso
 * de tortuga; tres a la vez mantiene la barra de progreso de cada uno con
 * movimiento real sin tirar el resto de la app abajo.
 */
export function useUploadQueue(projectId: string) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const queueRef = useRef<{ file: File; folderId: string; id: string }[]>([]);
  const activeRef = useRef(0);
  const qc = useQueryClient();

  const pump = () => {
    while (activeRef.current < CONCURRENCY && queueRef.current.length > 0) {
      const next = queueRef.current.shift();
      if (!next) {
        break;
      }
      activeRef.current += 1;
      void runUpload(next);
    }
  };

  const runUpload = async (job: { file: File; folderId: string; id: string }) => {
    setItems((prev) => prev.map((it) => (it.id === job.id ? { ...it, status: "uploading" } : it)));
    try {
      await filesApi.upload(projectId, job.folderId, job.file, {
        onProgress: (pct) => {
          setItems((prev) => prev.map((it) => (it.id === job.id ? { ...it, progress: pct } : it)));
        },
      });
      setItems((prev) =>
        prev.map((it) => (it.id === job.id ? { ...it, status: "done", progress: 100 } : it)),
      );
      void qc.invalidateQueries({ queryKey: projectFilesKey(projectId) });
    } catch (err) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === job.id
            ? { ...it, status: "error", error: getErrorMessage(err, "No se pudo subir") }
            : it,
        ),
      );
    } finally {
      activeRef.current -= 1;
      pump();
    }
  };

  const enqueue = (folderId: string, files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) {
      return;
    }
    const newItems: UploadItem[] = list.map((f) => ({
      id: `${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      size: f.size,
      progress: 0,
      status: "queued",
    }));
    setItems((prev) => [...prev, ...newItems]);
    list.forEach((file, i) => {
      queueRef.current.push({ file, folderId, id: newItems[i].id });
    });
    pump();
  };

  const dismiss = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };
  const clearFinished = () => {
    setItems((prev) => prev.filter((it) => it.status === "queued" || it.status === "uploading"));
  };

  const isUploading = items.some((it) => it.status === "uploading" || it.status === "queued");

  return { items, enqueue, dismiss, clearFinished, isUploading };
}

/** Panel flotante con el progreso de cada archivo en subida, uno por fila. */
export function UploadQueuePanel({
  items,
  onDismiss,
  onClearFinished,
}: {
  items: UploadItem[];
  onDismiss: (id: string) => void;
  onClearFinished: () => void;
}) {
  if (items.length === 0) {
    return null;
  }
  const pending = items.filter((it) => it.status === "queued" || it.status === "uploading").length;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
          <FileUp className="size-3.5 text-brand-gold-dark dark:text-brand-gold" />
          {pending > 0
            ? `Subiendo ${String(pending)} archivo${pending === 1 ? "" : "s"}…`
            : "Subidas"}
        </span>
        <button
          type="button"
          onClick={onClearFinished}
          disabled={pending === items.length}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
          title="Limpiar completados"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto">
        {items.map((it) => (
          <div
            key={it.id}
            className="flex items-start gap-2 border-b border-border/60 px-3 py-2 last:border-0"
          >
            <div className="mt-0.5 shrink-0">
              {it.status === "done" ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : it.status === "error" ? (
                <AlertCircle className="size-4 text-rose-500" />
              ) : (
                <Loader2 className="size-4 animate-spin text-brand-gold-dark dark:text-brand-gold" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[12px] font-medium text-foreground">{it.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatFileSize(it.size)}
                </span>
              </div>
              {it.status === "error" ? (
                <p className="mt-0.5 truncate text-[11px] text-rose-600 dark:text-rose-400">
                  {it.error}
                </p>
              ) : (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-accent">
                  <div
                    className={cn(
                      "h-full rounded-full bg-brand-gold transition-all",
                      it.status === "done" && "bg-emerald-500",
                    )}
                    style={{ width: `${String(it.status === "queued" ? 0 : it.progress)}%` }}
                  />
                </div>
              )}
            </div>
            {(it.status === "done" || it.status === "error") && (
              <button
                type="button"
                onClick={() => {
                  onDismiss(it.id);
                }}
                className="shrink-0 rounded-md p-0.5 text-muted-foreground hover:bg-accent"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
