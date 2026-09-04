import { useEffect, useState } from "react";
import { Download, FileWarning, X } from "lucide-react";
import { LoadingSkeleton } from "@/components/common/AsyncStates";
import { getErrorMessage } from "@/utils/get-error-message";
import { filesApi } from "../api/files.api";
import { formatFileSize } from "../utils/format-size";
import { previewKind } from "../utils/preview";

export interface PreviewableFile {
  projectId: string;
  fileId: string;
  name: string;
  contentType?: string;
  sizeBytes?: number;
}

/** El contenido pedido con la sesión y publicado como URL de objeto local.
 *  Las rutas del archivador van autenticadas: un `<img src>` apuntando a la
 *  API llegaría sin token y devolvería un 401. */
function useObjectUrl(file: PreviewableFile, enabled: boolean) {
  const [state, setState] = useState<{ url: string | null; error: string | null }>({
    url: null,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;

    void filesApi
      .blob(file.projectId, file.fileId, "view")
      .then((blob) => {
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ url: null, error: getErrorMessage(error, "No se pudo abrir el archivo.") });
        }
      });

    return () => {
      cancelled = true;
      // Sin esto el blob se queda en memoria mientras viva la pestaña.
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file.projectId, file.fileId, enabled]);

  return state;
}

function Viewer({ file, url }: { file: PreviewableFile; url: string }) {
  const frame = "h-full w-full rounded-lg border border-border bg-card";
  switch (previewKind(file.contentType)) {
    case "image":
      return (
        <div className="inline-block rounded-xl border border-border bg-card p-3 shadow-lg">
          <img
            src={url}
            alt={file.name}
            className="max-h-[75vh] max-w-full rounded-md object-contain"
          />
        </div>
      );
    case "video":
      return (
        <div className="inline-block rounded-xl border border-border bg-card p-3 shadow-lg">
          <video src={url} controls className="max-h-[75vh] max-w-full rounded-md" />
        </div>
      );
    case "audio":
      return <audio src={url} controls className="w-full" />;
    case "pdf":
    case "text":
      return <iframe src={url} title={file.name} className={frame} />;
    default:
      return null;
  }
}

/**
 * Abre un archivo del proyecto SIN salir de la aplicación: imágenes, PDF,
 * texto, audio y vídeo se muestran aquí mismo.
 *
 * Word, Excel y PowerPoint no los pinta ningún navegador y no hay forma de
 * hacerlo sin mandar el archivo a un servicio externo (el visor de Office
 * necesita una URL pública, y estos archivos son privados del proyecto): para
 * esos, el modal lo dice y ofrece la descarga, que es la respuesta honesta.
 */
export function FilePreviewModal({
  file,
  onClose,
}: {
  file: PreviewableFile;
  onClose: () => void;
}) {
  const supported = previewKind(file.contentType) !== "unsupported";
  const { url, error } = useObjectUrl(file, supported);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={file.name}
    >
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
            {file.sizeBytes !== undefined && (
              <p className="text-[11px] text-muted-foreground">{formatFileSize(file.sizeBytes)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void filesApi.download(file.projectId, file.fileId, file.name)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <Download className="size-3.5" /> Descargar
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black/[0.06] p-4 dark:bg-black/40">
          {!supported || error !== null ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <FileWarning className="size-7 text-amber-500" />
              <p className="text-sm font-medium text-foreground">
                {error ?? "Este formato no se puede ver en el navegador"}
              </p>
              <p className="max-w-sm text-[12px] text-muted-foreground">
                {error === null &&
                  "Los documentos de Office (Word, Excel, PowerPoint) se abren con su programa: descárgalo para verlo."}
              </p>
            </div>
          ) : url === null ? (
            <LoadingSkeleton rows={6} />
          ) : (
            <Viewer file={file} url={url} />
          )}
        </div>
      </div>
    </div>
  );
}
