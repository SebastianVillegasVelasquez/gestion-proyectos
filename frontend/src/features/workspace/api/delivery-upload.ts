import http from "@/lib/http";

export interface NewFileVersionBody {
  file: File;
  note?: string;
  observations?: string;
  /** Entrega continua: por defecto `true` (cierra la entrega, como siempre).
   *  `false` registra la versión y deja la tarea abierta para seguir entregando. */
  markDelivered?: boolean;
  /** Subcarpeta elegida dentro del archivador del equipo. Sin ella, el
   *  servidor usa (o crea) la carpeta del equipo tal cual. */
  folderId?: string;
}

/**
 * Entrega un ARCHIVO como nueva versión de un entregable.
 *
 * Vive fuera de las dos APIs que lo usan (equipo y personal) porque lo único
 * que cambia entre ellas es la ruta: el multipart y el trato especial del
 * tiempo de espera son los mismos, y duplicarlos garantizaba que uno de los
 * dos se quedara atrás.
 */
export function postDeliveryFile<T>(
  url: string,
  body: NewFileVersionBody,
  options?: { onProgress?: (pct: number) => void },
) {
  const form = new FormData();
  form.append("file", body.file);
  if (body.note) {
    form.append("note", body.note);
  }
  if (body.observations) {
    form.append("observations", body.observations);
  }
  if (body.markDelivered !== undefined) {
    form.append("mark_delivered", String(body.markDelivered));
  }
  if (body.folderId) {
    form.append("folder_id", body.folderId);
  }
  return http
    .post<T>(url, form, {
      // Subir tarda mucho más que una llamada normal: el timeout global (10 s)
      // cortaría un archivo grande a media transferencia.
      timeout: 120_000,
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!options?.onProgress || !event.total) {
          return;
        }
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      },
    })
    .then((r) => r.data);
}
