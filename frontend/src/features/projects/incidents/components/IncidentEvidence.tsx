import { useRef, useState } from "react";
import { FileText, ImageIcon, Paperclip, X } from "lucide-react";
import { getErrorMessage } from "@/utils/get-error-message";
import { formatFileSize } from "@/features/files/utils/format-size";
import {
  FilePreviewModal,
  type PreviewableFile,
} from "@/features/files/components/FilePreviewModal";
import { incidentsApi } from "../incidents.api";
import { useRemoveIncidentAttachment, useUploadIncidentAttachment } from "../use-incidents";
import type { IncidentAttachment, ProjectIncident } from "../types";

function AttachmentIcon({ contentType }: { contentType: string }) {
  if (contentType.startsWith("image/")) {
    return <ImageIcon className="size-3.5 shrink-0 text-brand-teal" />;
  }
  if (contentType === "application/pdf" || contentType.startsWith("text/")) {
    return <FileText className="size-3.5 shrink-0 text-brand-gold-dark" />;
  }
  return <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />;
}

/**
 * Evidencia de un incidente: se abre en el visor de la app (imágenes, PDF,
 * texto), se descarga, se añade más o se quita.
 */
export function IncidentEvidence({
  projectId,
  incident,
}: {
  projectId: string;
  incident: ProjectIncident;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewableFile | null>(null);
  const upload = useUploadIncidentAttachment(projectId);
  const remove = useRemoveIncidentAttachment(projectId);

  const open = (attachment: IncidentAttachment) => {
    setPreview({
      projectId,
      fileId: attachment.id,
      name: attachment.name,
      contentType: attachment.content_type,
      sizeBytes: attachment.size_bytes,
      loadBlob: () => incidentsApi.attachmentBlob(projectId, incident.id, attachment.id, "view"),
      download: () => incidentsApi.downloadAttachment(projectId, incident.id, attachment),
    });
  };

  const error = upload.error ?? remove.error;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {incident.attachments.map((attachment) => (
          <span
            key={attachment.id}
            className="group/evidence flex max-w-full items-center gap-1.5 rounded-lg border border-border bg-accent/30 py-1 pl-2 pr-1 text-xs"
          >
            <AttachmentIcon contentType={attachment.content_type} />
            <button
              type="button"
              onClick={() => {
                open(attachment);
              }}
              title={`${attachment.name} · ${formatFileSize(attachment.size_bytes)}`}
              className="max-w-[12rem] truncate font-medium text-foreground hover:underline"
            >
              {attachment.name}
            </button>
            <button
              type="button"
              aria-label={`Quitar ${attachment.name}`}
              disabled={remove.isPending}
              onClick={() => {
                remove.mutate({ id: incident.id, attachmentId: attachment.id });
              }}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <Paperclip className="size-3.5" />
          {upload.isPending ? "Subiendo…" : "Adjuntar evidencia"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            for (const file of Array.from(event.target.files ?? [])) {
              upload.mutate({ id: incident.id, file });
            }
            event.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="text-xs text-rose-600 dark:text-rose-400">
          {getErrorMessage(error, "No se pudo actualizar la evidencia")}
        </p>
      )}
      {preview && (
        <FilePreviewModal
          file={preview}
          onClose={() => {
            setPreview(null);
          }}
        />
      )}
    </div>
  );
}
